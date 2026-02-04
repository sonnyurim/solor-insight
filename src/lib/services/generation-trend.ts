/**
 * GENERATION_TREND 인텐트 처리 서비스
 * Multi-step Prompting (3단계): 엔티티 추출 → 스키마 매칭 → SQL 생성
 */

import { db } from '@/lib/db';
import {
  extractEntities,
  matchSchema,
  generateSql,
  type ExtractedEntities,
} from '@/lib/llm/steps/generation-trend';
import { normalizeRegionNames, isAmbiguousRegion, getAmbiguousRegionMessage } from '@/constants/region-aliases';
import { isSido } from '@/constants/regions';
import { getCurrentSeason, getCurrentYear, getSeasonFromMonth, type SeasonKr } from '@/lib/utils/date';

// ==================== 타입 정의 (re-export from chat/types.ts) ====================

// 타입을 chat/types.ts에서 가져와서 re-export
import type {
  AggregationType,
  GenerationDataType,
  DisplayMode,
  OutputFormat,
} from '@/lib/chat/types';

export type { AggregationType, DisplayMode, OutputFormat };

// DataType은 GenerationDataType과 동일 (호환성을 위해 별칭 사용)
export type DataType = GenerationDataType;

/**
 * 데이터 개수에 따른 표시 모드 결정
 * - 1개: text (숫자로 직접 알려줌)
 * - 2-3개: list (간단한 목록)
 * - 4개 이상: chart (그래프)
 */
function getDisplayMode(dataCount: number): DisplayMode {
  if (dataCount <= 1) return 'text';
  if (dataCount <= 3) return 'list';
  return 'chart';
}

export interface GenerationTrendMetadata {
  region: string;
  season: string;
  year: number;
  month?: number | null;
  aggregations: AggregationType[];
  sql: string;
  explanation: string;
  dataType: DataType;
  displayMode: DisplayMode;
  disclaimer?: string;
  chartType?: 'bar' | 'line' | null;
  outputFormat?: OutputFormat; // 사용자 지정 출력 형식
  showOnlyAverage?: boolean; // 평균만 표시 여부
}

export interface GenerationTrendResult {
  success: boolean;
  results?: Array<{
    data: Record<string, unknown>[];
    metadata: GenerationTrendMetadata;
  }>;
  error?: string;
}

// ==================== 년도 기본값 해결 ====================

/**
 * 년도 기본값 결정
 * 
 * 로직: 올해 → 작년 → 재작년 순서로 데이터 확인
 * 모두 없으면 null 반환 (데이터 없음 처리)
 * 
 * @param regionName 지역명
 * @param isEstimated 추정 데이터 여부
 * @returns 데이터가 있는 년도 또는 null
 */
async function resolveDefaultYear(
  regionName: string,
  isEstimated: boolean
): Promise<number | null> {
  const currentYear = getCurrentYear();
  const yearsToCheck = [currentYear, currentYear - 1, currentYear - 2];
  
  for (const year of yearsToCheck) {
    const hasData = await checkDataExists(regionName, year, isEstimated);
    if (hasData) {
      return year;
    }
  }

  return null;
}

/**
 * 특정 조건으로 데이터 존재 여부 확인
 */
async function checkDataExists(
  regionName: string,
  year: number,
  isEstimated: boolean
): Promise<boolean> {
  const result = await db.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count
    FROM raw_generation rg
    JOIN regions r ON rg.region_id = r.id
    WHERE r.name = ${regionName}
      AND EXTRACT(YEAR FROM rg.trade_date) = ${year}
      AND rg.is_estimated = ${isEstimated}
    LIMIT 1
  `;
  return Number(result[0]?.count ?? 0) > 0;
}


// ==================== 메인 핸들러 ====================

/**
 * GENERATION_TREND 인텐트 처리
 * @param question 사용자 질문
 */
export async function handleGenerationTrend(
  question: string
): Promise<GenerationTrendResult> {
  try {
    // ========================================
    // Step 1: 엔티티 추출
    // ========================================
    const entities = await extractEntities(question);

    // ========================================
    // 엔티티 검증 (멀티턴 미지원 → 에러 + 안내)
    // ========================================
    if (entities.regions.length === 0) {
      return {
        success: false,
        error:
          '지역 정보가 필요합니다. 다음과 같이 질문해주세요:\n' +
          '예) "고흥군 봄철 시간별 발전량 보여줘"\n' +
          '예) "전라남도 여름 발전량 추이"',
      };
    }

    // ========================================
    // 모호한 지역명 체크 (전라도, 경상도, 충청도)
    // ========================================
    const ambiguousRegions = entities.regions.filter(isAmbiguousRegion);
    const specificRegions = entities.regions.filter(r => !isAmbiguousRegion(r));
    
    // 모호한 지역명만 있는 경우 → 질문
    if (ambiguousRegions.length > 0 && specificRegions.length === 0) {
      const message = getAmbiguousRegionMessage(ambiguousRegions[0]);
      return {
        success: false,
        error: message ?? '지역을 더 구체적으로 말씀해주세요.',
      };
    }
    
    // 모호한 지역명 + 시군구 → 시군구만 사용
    const regionsToUse = specificRegions.length > 0 ? specificRegions : entities.regions;

    // ========================================
    // 지역명 정규화
    // ========================================
    const normalizedRegions = normalizeRegionNames(regionsToUse);

    // 집계 유형 결정
    const requestedAggregations =
      entities.aggregations.length > 0
        ? (entities.aggregations as AggregationType[])
        : (['hourly'] as AggregationType[]);

    const results: NonNullable<GenerationTrendResult['results']> = [];

    // 각 집계 유형별로 처리
    for (const agg of requestedAggregations) {
      // 계절 결정: 
      // 1. 명시적 계절이 있으면 사용
      // 2. 특정 월이 있으면 해당 월의 계절로 설정
      // 3. 둘 다 없으면 현재 계절
      let season: SeasonKr;
      if (entities.season) {
        season = entities.season as SeasonKr;
      } else if (entities.month) {
        season = getSeasonFromMonth(entities.month);
      } else {
        season = getCurrentSeason();
      }

      // dataType 판별 (정규화된 지역명으로)
      const regionName = normalizedRegions[0];
      const isActual = isSido(regionName);
      const dataType: DataType = isActual ? 'actual' : 'estimated';
      const isEstimated = !isActual;
      
      // 년도 폴백: 올해 → 작년 → 재작년 순서로 데이터 확인
      const year = entities.year ?? await resolveDefaultYear(regionName, isEstimated);

      // 데이터가 없는 경우
      if (year === null) {
        return {
          success: false,
          error: `${regionName}의 ${season}철 발전량 데이터가 없습니다.\n` +
            `최근 3년간(${getCurrentYear()-2}~${getCurrentYear()}년) 해당 조건의 데이터를 찾을 수 없습니다.`,
        };
      }

      // 엔티티에 정규화/폴백값 반영
      const enrichedEntities: ExtractedEntities = {
        ...entities,
        regions: normalizedRegions,
        season,
        year,
        aggregations: [agg], // 현재 루프의 집계 단위만 전달
      };

      // ========================================
      // Step 2: 스키마 매칭
      // ========================================
      const schema = await matchSchema(enrichedEntities);

      // ========================================
      // Step 3: SQL 생성
      // ========================================
      const sqlResult = await generateSql(question, enrichedEntities, schema);

      // ========================================
      // SQL 실행
      // ========================================
      const data = (await db.$queryRawUnsafe(
        sqlResult.sql,
        ...sqlResult.params
      )) as Record<string, unknown>[];

      // 결과 변환 (BigInt → Number)
      const serializedData = data.map((row) => {
        const converted: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(row)) {
          if (typeof value === 'bigint') {
            converted[key] = Number(value);
          } else if (value instanceof Date) {
            converted[key] = value.toISOString();
          } else if (typeof value === 'object' && value !== null && 'toNumber' in value) {
            converted[key] = (value as { toNumber: () => number }).toNumber();
          } else {
            converted[key] = value;
          }
        }
        return converted;
      });

      // disclaimer 생성 (시군구인 경우)
      const disclaimer =
        dataType === 'estimated'
          ? `※ 해당 데이터는 광역시도 발전량 기반으로 추정된 값으로 실제와 다를 수 있습니다.`
          : undefined;

      // displayMode 결정: 데이터 개수에 따라
      // 1개: text (숫자로 직접 알려줌)
      // 2-3개: list (간단한 목록)
      // 4개 이상: chart (그래프)
      const displayMode = getDisplayMode(serializedData.length);

      results.push({
        data: serializedData,
        metadata: {
          region: regionName,
          season,
          year,
          month: entities.month,
          aggregations: [agg],
          sql: sqlResult.sql,
          explanation: sqlResult.explanation,
          dataType,
          disclaimer,
          chartType: entities.chartType,
          displayMode,
          outputFormat: entities.outputFormat,
          showOnlyAverage: entities.showOnlyAverage,
        },
      });
    }

    // 모든 결과가 빈 경우 에러 반환
    const hasAnyData = results.some(r => r.data.length > 0);
    if (!hasAnyData) {
      const regionName = normalizedRegions[0];
      const firstSeason = results[0]?.metadata.season ?? '해당';
      const firstYear = results[0]?.metadata.year ?? getCurrentYear();
      return {
        success: false,
        error: `${regionName}의 ${firstYear}년 ${firstSeason}철 발전량 데이터가 없습니다.`,
      };
    }

    return {
      success: true,
      results,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : '처리 중 오류가 발생했습니다.',
    };
  }
}
