/**
 * GENERATION_TREND 인텐트 처리 서비스
 * Multi-step Prompting (3단계): 엔티티 추출 → 스키마 매칭 → SQL 생성
 */

import { db, Prisma } from "@/lib/db";
import {
  extractEntities,
  matchSchema,
  generateSql,
  type ExtractedEntities,
} from "@/lib/llm/steps/generation-trend";
import {
  normalizeRegionNames,
  isAmbiguousRegion,
  getAmbiguousRegionMessage,
} from "@/constants/region-aliases";
import { isSido } from "@/constants/regions";
import {
  getCurrentSeason,
  getCurrentYear,
  getSeasonFromMonth,
  type SeasonKr,
} from "@/lib/utils/date";

// ==================== 타입 정의 (re-export from chat/types.ts) ====================

// 타입을 chat/types.ts에서 가져와서 re-export
import type {
  AggregationType,
  GenerationDataType,
  DisplayMode,
  OutputFormat,
} from "@/lib/chat/types";

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
  if (dataCount <= 1) return "text";
  if (dataCount <= 3) return "list";
  return "chart";
}

/**
 * 영어 계절명을 한글로 변환
 */
function seasonToKorean(season: string): string {
  const map: Record<string, string> = {
    SPRING: "봄",
    SUMMER: "여름",
    FALL: "가을",
    WINTER: "겨울",
  };
  return map[season] || season;
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
  chartType?: "bar" | "line" | null;
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
 * 년도 기본값 결정 (계절 조건 포함)
 *
 * 로직:
 * 1. 완전한 연도 데이터(12개월)가 있는 가장 최근 연도 우선
 * 2. 없으면 데이터가 있는 가장 최근 연도 반환
 * 모두 없으면 null 반환 (데이터 없음 처리)
 *
 * @param regionName 지역명
 * @param isEstimated 추정 데이터 여부
 * @param season 계절 (선택사항 - 특정 계절 데이터 확인 시)
 * @returns 데이터가 있는 년도 또는 null
 */
async function resolveDefaultYear(
  regionName: string,
  isEstimated: boolean,
  season?: SeasonKr,
): Promise<number | null> {
  const currentYear = getCurrentYear();
  const yearsToCheck = [currentYear, currentYear - 1, currentYear - 2];

  // 1단계: 완전한 연도 데이터(12개월 또는 해당 계절 전체)가 있는 연도 찾기
  for (const year of yearsToCheck) {
    const hasCompleteData = await checkCompleteYearData(
      regionName,
      year,
      isEstimated,
      season,
    );
    if (hasCompleteData) {
      return year;
    }
  }

  // 2단계: 완전한 데이터가 없으면 부분 데이터라도 있는 연도 반환
  for (const year of yearsToCheck) {
    const hasData = await checkDataExists(
      regionName,
      year,
      isEstimated,
      season,
    );
    if (hasData) {
      return year;
    }
  }

  return null;
}

/**
 * 완전한 연도 데이터 존재 여부 확인
 * - 계절 없음: 12개월 데이터 모두 있는지
 * - 계절 있음: 해당 계절 3개월 데이터 모두 있는지
 */
async function checkCompleteYearData(
  regionName: string,
  year: number,
  isEstimated: boolean,
  season?: SeasonKr,
): Promise<boolean> {
  const seasonMonths: Record<SeasonKr, number[]> = {
    봄: [3, 4, 5],
    여름: [6, 7, 8],
    가을: [9, 10, 11],
    겨울: [12, 1, 2],
  };

  if (season) {
    // 계절이 지정된 경우: 해당 계절 3개월 데이터 모두 있는지 확인
    const months = seasonMonths[season];
    const result = await db.$queryRaw<{ month_count: bigint }[]>`
      SELECT COUNT(DISTINCT EXTRACT(MONTH FROM rg.trade_date)) as month_count
      FROM raw_generation rg
      JOIN regions r ON rg.region_id = r.id
      WHERE r.name = ${regionName}
        AND EXTRACT(YEAR FROM rg.trade_date) = ${year}
        AND EXTRACT(MONTH FROM rg.trade_date) IN (${Prisma.join(months)})
        AND rg.is_estimated = ${isEstimated}
    `;
    return Number(result[0]?.month_count ?? 0) >= 3;
  }

  // 계절이 없는 경우: 12개월 데이터 모두 있는지 확인
  const result = await db.$queryRaw<{ month_count: bigint }[]>`
    SELECT COUNT(DISTINCT EXTRACT(MONTH FROM rg.trade_date)) as month_count
    FROM raw_generation rg
    JOIN regions r ON rg.region_id = r.id
    WHERE r.name = ${regionName}
      AND EXTRACT(YEAR FROM rg.trade_date) = ${year}
      AND rg.is_estimated = ${isEstimated}
  `;
  return Number(result[0]?.month_count ?? 0) >= 12;
}

/**
 * 특정 조건으로 데이터 존재 여부 확인 (계절 조건 포함)
 */
async function checkDataExists(
  regionName: string,
  year: number,
  isEstimated: boolean,
  season?: SeasonKr,
): Promise<boolean> {
  // 계절별 월 매핑
  const seasonMonths: Record<SeasonKr, number[]> = {
    봄: [3, 4, 5],
    여름: [6, 7, 8],
    가을: [9, 10, 11],
    겨울: [12, 1, 2],
  };

  // 계절이 지정된 경우 해당 월의 데이터만 확인
  if (season) {
    const months = seasonMonths[season];
    const result = await db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM raw_generation rg
      JOIN regions r ON rg.region_id = r.id
      WHERE r.name = ${regionName}
        AND EXTRACT(YEAR FROM rg.trade_date) = ${year}
        AND EXTRACT(MONTH FROM rg.trade_date) IN (${Prisma.join(months)})
        AND rg.is_estimated = ${isEstimated}
      LIMIT 1
    `;
    return Number(result[0]?.count ?? 0) > 0;
  }

  // 계절이 없으면 연도 전체 데이터 확인
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

// ==================== 시군구 발전량 런타임 추정 ====================

/**
 * 시군구의 상위 광역시도 정보 조회
 */
async function getParentProvince(
  cityName: string,
): Promise<{ id: number; name: string; cityId: number } | null> {
  const result = await db.$queryRaw<
    { parent_id: number; parent_name: string; city_id: number }[]
  >`
    SELECT
      p.id as parent_id,
      p.name as parent_name,
      c.id as city_id
    FROM regions c
    JOIN regions p ON c.parent_id = p.id
    WHERE c.name = ${cityName}
      AND c.type = 'CITY'
    LIMIT 1
  `;

  if (!result[0]) return null;

  return {
    id: Number(result[0].parent_id),
    name: result[0].parent_name,
    cityId: Number(result[0].city_id),
  };
}

/**
 * 상위 광역시도 데이터가 있는 년도 찾기 (계절 조건 포함)
 * 완전한 데이터가 있는 연도를 우선 반환
 */
async function findYearWithParentData(
  parentName: string,
  season?: SeasonKr,
): Promise<number | null> {
  const currentYear = getCurrentYear();
  const yearsToCheck = [currentYear, currentYear - 1, currentYear - 2];

  // 1단계: 완전한 데이터가 있는 연도 찾기
  for (const year of yearsToCheck) {
    const hasCompleteData = await checkCompleteYearData(
      parentName,
      year,
      false,
      season,
    );
    if (hasCompleteData) {
      return year;
    }
  }

  // 2단계: 부분 데이터라도 있는 연도 반환
  for (const year of yearsToCheck) {
    const hasData = await checkDataExists(parentName, year, false, season);
    if (hasData) {
      return year;
    }
  }
  return null;
}

/**
 * 시군구 발전량 런타임 추정 (hourly)
 *
 * 공식: 시군구 발전량 = 상위 광역시도 발전량 × (시군구 일사량 / 광역시도 전체 일사량)
 *
 * @param cityName 시군구명
 * @param year 년도
 * @param season 계절
 */
async function estimateCityGenerationHourly(
  cityName: string,
  year: number,
  season: SeasonKr,
): Promise<{
  data: Record<string, unknown>[];
  sql: string;
  explanation: string;
} | null> {
  // 상위 광역시도 조회
  const parent = await getParentProvince(cityName);
  if (!parent) return null;

  // 계절 → 월 매핑
  const seasonMonths: Record<SeasonKr, number[]> = {
    봄: [3, 4, 5],
    여름: [6, 7, 8],
    가을: [9, 10, 11],
    겨울: [12, 1, 2],
  };
  const months = seasonMonths[season];

  // 런타임 추정 SQL:
  // 1. 상위 광역시도의 시간별 평균 발전량 조회
  // 2. 시군구 일사량 / 광역시도 전체 일사량 비율 계산
  // 3. 비율 적용하여 추정값 계산
  const result = await db.$queryRaw<
    { hour: number; avg_kwh: number; min_kwh: number; max_kwh: number }[]
  >`
    WITH province_generation AS (
      -- 상위 광역시도 시간별 발전량
      SELECT
        rg.hour,
        AVG(rg.generation_kwh) as avg_kwh,
        MIN(rg.generation_kwh) as min_kwh,
        MAX(rg.generation_kwh) as max_kwh
      FROM raw_generation rg
      WHERE rg.region_id = ${parent.id}
        AND EXTRACT(YEAR FROM rg.trade_date) = ${year}
        AND EXTRACT(MONTH FROM rg.trade_date) IN (${Prisma.join(months)})
        AND rg.is_estimated = false
      GROUP BY rg.hour
    ),
    city_irradiance AS (
      -- 시군구 시간별 일사량 (UTC→KST 변환)
      SELECT
        EXTRACT(HOUR FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')::int as hour,
        SUM(ri.ghi) as total_ghi
      FROM raw_irradiance ri
      WHERE ri.region_id = ${parent.cityId}
        AND EXTRACT(YEAR FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul') = ${year}
        AND EXTRACT(MONTH FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul') IN (${Prisma.join(months)})
      GROUP BY EXTRACT(HOUR FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')
    ),
    province_irradiance AS (
      -- 광역시도 전체 시간별 일사량 (UTC→KST 변환)
      SELECT
        EXTRACT(HOUR FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')::int as hour,
        SUM(ri.ghi) as total_ghi
      FROM raw_irradiance ri
      WHERE ri.region_id IN (
        SELECT id FROM regions
        WHERE id = ${parent.id} OR parent_id = ${parent.id}
      )
        AND EXTRACT(YEAR FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul') = ${year}
        AND EXTRACT(MONTH FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul') IN (${Prisma.join(months)})
      GROUP BY EXTRACT(HOUR FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')
    )
    SELECT
      pg.hour,
      ROUND((pg.avg_kwh * COALESCE(ci.total_ghi / NULLIF(pi.total_ghi, 0), 0))::numeric, 3) as avg_kwh,
      ROUND((pg.min_kwh * COALESCE(ci.total_ghi / NULLIF(pi.total_ghi, 0), 0))::numeric, 3) as min_kwh,
      ROUND((pg.max_kwh * COALESCE(ci.total_ghi / NULLIF(pi.total_ghi, 0), 0))::numeric, 3) as max_kwh
    FROM province_generation pg
    LEFT JOIN city_irradiance ci ON pg.hour = ci.hour
    LEFT JOIN province_irradiance pi ON pg.hour = pi.hour
    ORDER BY pg.hour
  `;

  if (!result || result.length === 0) return null;

  // 결과 변환
  const data = result.map((row) => ({
    hour: Number(row.hour),
    avg_kwh: Number(row.avg_kwh),
    min_kwh: Number(row.min_kwh),
    max_kwh: Number(row.max_kwh),
  }));

  return {
    data,
    sql: `[런타임 추정] ${parent.name} 발전량 × (${cityName} 일사량 / ${parent.name} 전체 일사량)`,
    explanation: `${cityName}의 ${year}년 ${season}철 시간별 발전량 (${parent.name} 기준 추정)`,
  };
}

/**
 * 시군구 발전량 런타임 추정 (daily)
 */
async function estimateCityGenerationDaily(
  cityName: string,
  year: number,
  season: SeasonKr,
): Promise<{
  data: Record<string, unknown>[];
  sql: string;
  explanation: string;
} | null> {
  const parent = await getParentProvince(cityName);
  if (!parent) return null;

  const seasonMonths: Record<SeasonKr, number[]> = {
    봄: [3, 4, 5],
    여름: [6, 7, 8],
    가을: [9, 10, 11],
    겨울: [12, 1, 2],
  };
  const months = seasonMonths[season];

  const result = await db.$queryRaw<
    { date: Date; total_kwh: number; avg_kwh: number }[]
  >`
    WITH province_daily AS (
      SELECT
        ad.date,
        ad.total_kwh,
        ad.avg_kwh
      FROM agg_daily ad
      WHERE ad.region_id = ${parent.id}
        AND EXTRACT(YEAR FROM ad.date) = ${year}
        AND EXTRACT(MONTH FROM ad.date) IN (${Prisma.join(months)})
        AND ad.is_estimated = false
    ),
    city_daily_irradiance AS (
      SELECT
        DATE(ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul') as date,
        SUM(ri.ghi) as total_ghi
      FROM raw_irradiance ri
      WHERE ri.region_id = ${parent.cityId}
        AND EXTRACT(YEAR FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul') = ${year}
        AND EXTRACT(MONTH FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul') IN (${Prisma.join(months)})
      GROUP BY DATE(ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')
    ),
    province_daily_irradiance AS (
      SELECT
        DATE(ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul') as date,
        SUM(ri.ghi) as total_ghi
      FROM raw_irradiance ri
      WHERE ri.region_id IN (
        SELECT id FROM regions
        WHERE id = ${parent.id} OR parent_id = ${parent.id}
      )
        AND EXTRACT(YEAR FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul') = ${year}
        AND EXTRACT(MONTH FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul') IN (${Prisma.join(months)})
      GROUP BY DATE(ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')
    )
    SELECT
      pd.date,
      ROUND((pd.total_kwh * COALESCE(cdi.total_ghi / NULLIF(pdi.total_ghi, 0), 0))::numeric, 3) as total_kwh,
      ROUND((pd.avg_kwh * COALESCE(cdi.total_ghi / NULLIF(pdi.total_ghi, 0), 0))::numeric, 3) as avg_kwh
    FROM province_daily pd
    LEFT JOIN city_daily_irradiance cdi ON pd.date = cdi.date
    LEFT JOIN province_daily_irradiance pdi ON pd.date = pdi.date
    ORDER BY pd.date
  `;

  if (!result || result.length === 0) return null;

  const data = result.map((row) => ({
    date: row.date.toISOString(),
    total_kwh: Number(row.total_kwh),
    avg_kwh: Number(row.avg_kwh),
  }));

  return {
    data,
    sql: `[런타임 추정] ${parent.name} 일별 발전량 × (${cityName} 일사량 / ${parent.name} 전체 일사량)`,
    explanation: `${cityName}의 ${year}년 ${season}철 일별 발전량 (${parent.name} 기준 추정)`,
  };
}

/**
 * 시군구 발전량 런타임 추정 (monthly)
 */
async function estimateCityGenerationMonthly(
  cityName: string,
  year: number,
  season?: SeasonKr,
): Promise<{
  data: Record<string, unknown>[];
  sql: string;
  explanation: string;
} | null> {
  const parent = await getParentProvince(cityName);
  if (!parent) return null;

  // 계절 → 월 매핑
  const seasonMonths: Record<SeasonKr, number[]> = {
    봄: [3, 4, 5],
    여름: [6, 7, 8],
    가을: [9, 10, 11],
    겨울: [12, 1, 2],
  };

  const result = await db.$queryRaw<
    { month: number; total_kwh: number; avg_kwh: number; season: string }[]
  >`
    WITH province_monthly AS (
      SELECT
        am.month,
        am.total_kwh,
        am.avg_kwh,
        am.season
      FROM agg_monthly am
      WHERE am.region_id = ${parent.id}
        AND am.year = ${year}
        AND am.is_estimated = false
        ${season ? Prisma.sql`AND am.month IN (${Prisma.join(seasonMonths[season])})` : Prisma.empty}
    ),
    city_monthly_irradiance AS (
      SELECT
        EXTRACT(MONTH FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')::int as month,
        SUM(ri.ghi) as total_ghi
      FROM raw_irradiance ri
      WHERE ri.region_id = ${parent.cityId}
        AND EXTRACT(YEAR FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul') = ${year}
        ${season ? Prisma.sql`AND EXTRACT(MONTH FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')::int IN (${Prisma.join(seasonMonths[season])})` : Prisma.empty}
      GROUP BY EXTRACT(MONTH FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')
    ),
    province_monthly_irradiance AS (
      SELECT
        EXTRACT(MONTH FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')::int as month,
        SUM(ri.ghi) as total_ghi
      FROM raw_irradiance ri
      WHERE ri.region_id IN (
        SELECT id FROM regions
        WHERE id = ${parent.id} OR parent_id = ${parent.id}
      )
        AND EXTRACT(YEAR FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul') = ${year}
        ${season ? Prisma.sql`AND EXTRACT(MONTH FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')::int IN (${Prisma.join(seasonMonths[season])})` : Prisma.empty}
      GROUP BY EXTRACT(MONTH FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')
    )
    SELECT
      pm.month,
      ROUND((pm.total_kwh * COALESCE(cmi.total_ghi / NULLIF(pmi.total_ghi, 0), 0))::numeric, 3) as total_kwh,
      ROUND((pm.avg_kwh * COALESCE(cmi.total_ghi / NULLIF(pmi.total_ghi, 0), 0))::numeric, 3) as avg_kwh,
      pm.season
    FROM province_monthly pm
    LEFT JOIN city_monthly_irradiance cmi ON pm.month = cmi.month
    LEFT JOIN province_monthly_irradiance pmi ON pm.month = pmi.month
    ORDER BY pm.month
  `;

  if (!result || result.length === 0) return null;

  const data = result.map((row) => ({
    month: Number(row.month),
    total_kwh: Number(row.total_kwh),
    avg_kwh: Number(row.avg_kwh),
    season: seasonToKorean(row.season), // 한글로 변환
  }));

  const seasonLabel = season ? `${season}철 ` : "";
  return {
    data,
    sql: `[런타임 추정] ${parent.name} ${seasonLabel}월별 발전량 × (${cityName} 일사량 / ${parent.name} 전체 일사량)`,
    explanation: `${cityName}의 ${year}년 ${seasonLabel}월별 발전량 (${parent.name} 기준 추정)`,
  };
}

/**
 * 시군구 발전량 런타임 추정 (weekly)
 */
async function estimateCityGenerationWeekly(
  cityName: string,
  year: number,
  month?: number,
  season?: SeasonKr,
): Promise<{
  data: Record<string, unknown>[];
  sql: string;
  explanation: string;
} | null> {
  const parent = await getParentProvince(cityName);
  if (!parent) return null;

  // 계절 → 월 매핑
  const seasonMonths: Record<SeasonKr, number[]> = {
    봄: [3, 4, 5],
    여름: [6, 7, 8],
    가을: [9, 10, 11],
    겨울: [12, 1, 2],
  };

  // 월이 지정된 경우 해당 월의 주차 범위 계산
  let monthLabel = "";
  if (month) {
    monthLabel = `${month}월 `;
  }

  // 계절이 지정된 경우
  let seasonLabel = "";
  if (season && !month) {
    seasonLabel = `${season}철 `;
  }

  const result = await db.$queryRaw<
    {
      week_no: number;
      start_date: Date;
      end_date: Date;
      total_kwh: number;
      avg_kwh: number;
    }[]
  >`
    WITH province_weekly AS (
      SELECT
        aw.week_no,
        aw.start_date,
        aw.end_date,
        aw.total_kwh,
        aw.avg_kwh
      FROM agg_weekly aw
      WHERE aw.region_id = ${parent.id}
        AND aw.year = ${year}
        AND aw.is_estimated = false
        ${month ? Prisma.sql`AND aw.week_no BETWEEN ${getWeekNumber(new Date(year, month - 1, 1))} AND ${getWeekNumber(new Date(year, month, 0))}` : Prisma.empty}
        ${season && !month ? Prisma.sql`AND EXTRACT(MONTH FROM aw.start_date)::int IN (${Prisma.join(seasonMonths[season])})` : Prisma.empty}
    ),
    city_weekly_irradiance AS (
      SELECT
        EXTRACT(WEEK FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')::int as week_no,
        SUM(ri.ghi) as total_ghi
      FROM raw_irradiance ri
      WHERE ri.region_id = ${parent.cityId}
        AND EXTRACT(YEAR FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul') = ${year}
        ${month ? Prisma.sql`AND EXTRACT(MONTH FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul') = ${month}` : Prisma.empty}
        ${season && !month ? Prisma.sql`AND EXTRACT(MONTH FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')::int IN (${Prisma.join(seasonMonths[season])})` : Prisma.empty}
      GROUP BY EXTRACT(WEEK FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')
    ),
    province_weekly_irradiance AS (
      SELECT
        EXTRACT(WEEK FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')::int as week_no,
        SUM(ri.ghi) as total_ghi
      FROM raw_irradiance ri
      WHERE ri.region_id IN (
        SELECT id FROM regions
        WHERE id = ${parent.id} OR parent_id = ${parent.id}
      )
        AND EXTRACT(YEAR FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul') = ${year}
        ${month ? Prisma.sql`AND EXTRACT(MONTH FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul') = ${month}` : Prisma.empty}
        ${season && !month ? Prisma.sql`AND EXTRACT(MONTH FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')::int IN (${Prisma.join(seasonMonths[season])})` : Prisma.empty}
      GROUP BY EXTRACT(WEEK FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')
    )
    SELECT
      pw.week_no,
      pw.start_date,
      pw.end_date,
      ROUND((pw.total_kwh * COALESCE(cwi.total_ghi / NULLIF(pwi.total_ghi, 0), 0))::numeric, 3) as total_kwh,
      ROUND((pw.avg_kwh * COALESCE(cwi.total_ghi / NULLIF(pwi.total_ghi, 0), 0))::numeric, 3) as avg_kwh
    FROM province_weekly pw
    LEFT JOIN city_weekly_irradiance cwi ON pw.week_no = cwi.week_no
    LEFT JOIN province_weekly_irradiance pwi ON pw.week_no = pwi.week_no
    ORDER BY pw.week_no
  `;

  if (!result || result.length === 0) return null;

  // 월이 지정된 경우: 주의 시작일이 해당 월에 속하는 경우만 포함
  // 예: 3월 → 시작일이 3월인 주만 (2/23~3/1 주는 제외, 3/2~3/8부터 포함)
  let filteredResult = result;
  if (month) {
    filteredResult = result.filter((row) => {
      const startDate = new Date(row.start_date);
      return startDate.getMonth() + 1 === month;
    });
  } else if (season) {
    // 계절이 지정된 경우: 주의 시작일이 해당 계절 월에 속하는 경우만 포함
    const months = seasonMonths[season];
    filteredResult = result.filter((row) => {
      const startDate = new Date(row.start_date);
      return months.includes(startDate.getMonth() + 1);
    });
  }

  if (filteredResult.length === 0) return null;

  // 월별 주차 카운터 (각 월의 몇 주차인지 계산)
  const monthWeekCounter: Record<number, number> = {};

  const data = filteredResult.map((row) => {
    const startDate = new Date(row.start_date);
    const startMonth = startDate.getMonth() + 1;

    // 해당 월의 주차 카운트
    if (!monthWeekCounter[startMonth]) {
      monthWeekCounter[startMonth] = 1;
    } else {
      monthWeekCounter[startMonth]++;
    }

    const weekInMonth = monthWeekCounter[startMonth];
    const weekLabel = `${startMonth}월 ${weekInMonth}주차`;

    return {
      week_no: Number(row.week_no),
      week_label: weekLabel, // "3월 1주차" 형태
      start_date: row.start_date.toISOString(),
      end_date: row.end_date.toISOString(),
      total_kwh: Number(row.total_kwh),
      avg_kwh: Number(row.avg_kwh),
    };
  });

  return {
    data,
    sql: `[런타임 추정] ${parent.name} ${monthLabel}${seasonLabel}주별 발전량 × (${cityName} 일사량 / ${parent.name} 전체 일사량)`,
    explanation: `${cityName}의 ${year}년 ${monthLabel}${seasonLabel}주별 발전량 (${parent.name} 기준 추정)`,
  };
}

/**
 * ISO 주차 계산
 */
function getWeekNumber(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * 시군구 발전량 런타임 추정 (day_of_week)
 */
async function estimateCityGenerationDayOfWeek(
  cityName: string,
  year: number,
  season: SeasonKr,
): Promise<{
  data: Record<string, unknown>[];
  sql: string;
  explanation: string;
} | null> {
  const parent = await getParentProvince(cityName);
  if (!parent) return null;

  const seasonMonths: Record<SeasonKr, number[]> = {
    봄: [3, 4, 5],
    여름: [6, 7, 8],
    가을: [9, 10, 11],
    겨울: [12, 1, 2],
  };
  const months = seasonMonths[season];

  const dayNames = [
    "일요일",
    "월요일",
    "화요일",
    "수요일",
    "목요일",
    "금요일",
    "토요일",
  ];

  const result = await db.$queryRaw<{ day_of_week: number; avg_kwh: number }[]>`
    WITH province_dow AS (
      SELECT
        EXTRACT(DOW FROM rg.trade_date)::int as day_of_week,
        AVG(rg.generation_kwh) as avg_kwh
      FROM raw_generation rg
      WHERE rg.region_id = ${parent.id}
        AND EXTRACT(YEAR FROM rg.trade_date) = ${year}
        AND EXTRACT(MONTH FROM rg.trade_date) IN (${Prisma.join(months)})
        AND rg.is_estimated = false
      GROUP BY EXTRACT(DOW FROM rg.trade_date)
    ),
    city_dow_irradiance AS (
      SELECT
        EXTRACT(DOW FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')::int as day_of_week,
        SUM(ri.ghi) as total_ghi
      FROM raw_irradiance ri
      WHERE ri.region_id = ${parent.cityId}
        AND EXTRACT(YEAR FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul') = ${year}
        AND EXTRACT(MONTH FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul') IN (${Prisma.join(months)})
      GROUP BY EXTRACT(DOW FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')
    ),
    province_dow_irradiance AS (
      SELECT
        EXTRACT(DOW FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')::int as day_of_week,
        SUM(ri.ghi) as total_ghi
      FROM raw_irradiance ri
      WHERE ri.region_id IN (
        SELECT id FROM regions
        WHERE id = ${parent.id} OR parent_id = ${parent.id}
      )
        AND EXTRACT(YEAR FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul') = ${year}
        AND EXTRACT(MONTH FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul') IN (${Prisma.join(months)})
      GROUP BY EXTRACT(DOW FROM ri.datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')
    )
    SELECT
      pd.day_of_week,
      ROUND((pd.avg_kwh * COALESCE(cdi.total_ghi / NULLIF(pdi.total_ghi, 0), 0))::numeric, 3) as avg_kwh
    FROM province_dow pd
    LEFT JOIN city_dow_irradiance cdi ON pd.day_of_week = cdi.day_of_week
    LEFT JOIN province_dow_irradiance pdi ON pd.day_of_week = pdi.day_of_week
    ORDER BY pd.day_of_week
  `;

  if (!result || result.length === 0) return null;

  const data = result.map((row) => ({
    day_of_week: Number(row.day_of_week),
    day_name: dayNames[Number(row.day_of_week)],
    avg_kwh: Number(row.avg_kwh),
  }));

  return {
    data,
    sql: `[런타임 추정] ${parent.name} 요일별 발전량 × (${cityName} 일사량 / ${parent.name} 전체 일사량)`,
    explanation: `${cityName}의 ${year}년 ${season}철 요일별 발전량 (${parent.name} 기준 추정)`,
  };
}

/**
 * 시군구 발전량 런타임 추정 (yearly)
 * 월별 추정 데이터를 연도별로 집계
 */
async function estimateCityGenerationYearly(
  cityName: string,
  endYear: number,
  yearRange: number,
): Promise<{
  data: Record<string, unknown>[];
  sql: string;
  explanation: string;
} | null> {
  const parent = await getParentProvince(cityName);
  if (!parent) return null;

  const startYear = endYear - yearRange + 1;
  const years: number[] = [];
  for (let y = startYear; y <= endYear; y++) {
    years.push(y);
  }

  const results: { year: number; total_kwh: number; avg_kwh: number }[] = [];

  for (const year of years) {
    const monthlyResult = await estimateCityGenerationMonthly(cityName, year);
    if (monthlyResult && monthlyResult.data.length > 0) {
      const totalKwh = monthlyResult.data.reduce(
        (sum, row) => sum + (row.total_kwh as number),
        0,
      );
      const avgKwh =
        monthlyResult.data.reduce(
          (sum, row) => sum + (row.avg_kwh as number),
          0,
        ) / monthlyResult.data.length;
      results.push({
        year,
        total_kwh: Number(totalKwh.toFixed(3)),
        avg_kwh: Number(avgKwh.toFixed(3)),
      });
    }
  }

  if (results.length === 0) return null;

  return {
    data: results,
    sql: `[런타임 추정] ${parent.name} 연도별 발전량 × (${cityName} 일사량 / ${parent.name} 전체 일사량)`,
    explanation: `${cityName}의 ${startYear}~${endYear}년 연도별 발전량 (${parent.name} 기준 추정)`,
  };
}

/**
 * 시군구 발전량 런타임 추정 (seasonal)
 * 월별 추정 데이터를 계절별로 집계
 */
async function estimateCityGenerationSeasonal(
  cityName: string,
  year: number,
): Promise<{
  data: Record<string, unknown>[];
  sql: string;
  explanation: string;
} | null> {
  const parent = await getParentProvince(cityName);
  if (!parent) return null;

  const monthlyResult = await estimateCityGenerationMonthly(cityName, year);
  if (!monthlyResult || monthlyResult.data.length === 0) return null;

  // 계절별로 집계
  const seasonData: Record<
    string,
    { total: number; avg: number; count: number }
  > = {
    SPRING: { total: 0, avg: 0, count: 0 },
    SUMMER: { total: 0, avg: 0, count: 0 },
    FALL: { total: 0, avg: 0, count: 0 },
    WINTER: { total: 0, avg: 0, count: 0 },
  };

  for (const row of monthlyResult.data) {
    const season = row.season as string;
    if (seasonData[season]) {
      seasonData[season].total += row.total_kwh as number;
      seasonData[season].avg += row.avg_kwh as number;
      seasonData[season].count += 1;
    }
  }

  // 계절 순서대로 정렬
  const seasonOrder = ["SPRING", "SUMMER", "FALL", "WINTER"];
  const results = Object.entries(seasonData)
    .filter(([, data]) => data.count > 0)
    .sort(([a], [b]) => seasonOrder.indexOf(a) - seasonOrder.indexOf(b))
    .map(([season, data]) => ({
      season: seasonToKorean(season), // 한글로 변환
      total_kwh: Number(data.total.toFixed(3)),
      avg_kwh: Number((data.avg / data.count).toFixed(3)),
    }));

  if (results.length === 0) return null;

  return {
    data: results,
    sql: `[런타임 추정] ${parent.name} 계절별 발전량 × (${cityName} 일사량 / ${parent.name} 전체 일사량)`,
    explanation: `${cityName}의 ${year}년 계절별 발전량 (${parent.name} 기준 추정)`,
  };
}

/**
 * 시군구 발전량 런타임 추정 (집계 유형별 분기)
 */
async function estimateCityGeneration(
  cityName: string,
  year: number,
  season: SeasonKr,
  aggregation: AggregationType,
  yearRange?: number,
  month?: number,
  seasonFilter?: SeasonKr, // 명시적 계절 필터 (사용자가 지정한 경우)
): Promise<{
  data: Record<string, unknown>[];
  sql: string;
  explanation: string;
} | null> {
  switch (aggregation) {
    case "hourly":
      return estimateCityGenerationHourly(cityName, year, season);
    case "daily":
      return estimateCityGenerationDaily(cityName, year, season);
    case "weekly":
      return estimateCityGenerationWeekly(cityName, year, month, seasonFilter);
    case "monthly":
      return estimateCityGenerationMonthly(cityName, year, seasonFilter);
    case "yearly":
      return estimateCityGenerationYearly(cityName, year, yearRange ?? 3);
    case "seasonal":
      return estimateCityGenerationSeasonal(cityName, year);
    case "day_of_week":
      return estimateCityGenerationDayOfWeek(cityName, year, season);
    default:
      return estimateCityGenerationHourly(cityName, year, season);
  }
}

// ==================== 메인 핸들러 ====================

/**
 * GENERATION_TREND 인텐트 처리
 * @param question 사용자 질문
 */
export async function handleGenerationTrend(
  question: string,
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
          "지역 정보가 필요합니다. 다음과 같이 질문해주세요:\n" +
          '예) "고흥군 봄철 시간별 발전량 보여줘"\n' +
          '예) "전라남도 여름 발전량 추이"',
      };
    }

    // ========================================
    // 모호한 지역명 체크 (전라도, 경상도, 충청도)
    // ========================================
    const ambiguousRegions = entities.regions.filter(isAmbiguousRegion);
    const specificRegions = entities.regions.filter(
      (r) => !isAmbiguousRegion(r),
    );

    // 모호한 지역명만 있는 경우 → 질문
    if (ambiguousRegions.length > 0 && specificRegions.length === 0) {
      const message = getAmbiguousRegionMessage(ambiguousRegions[0]);
      return {
        success: false,
        error: message ?? "지역을 더 구체적으로 말씀해주세요.",
      };
    }

    // 모호한 지역명 + 시군구 → 시군구만 사용
    const regionsToUse =
      specificRegions.length > 0 ? specificRegions : entities.regions;

    // ========================================
    // 지역명 정규화
    // ========================================
    const normalizedRegions = normalizeRegionNames(regionsToUse);

    // 집계 유형 결정
    const requestedAggregations =
      entities.aggregations.length > 0
        ? (entities.aggregations as AggregationType[])
        : (["monthly"] as AggregationType[]);

    const results: NonNullable<GenerationTrendResult["results"]> = [];

    // 각 집계 유형별로 처리
    for (const agg of requestedAggregations) {
      // 사용자가 명시적으로 지정한 계절 (후처리 필터링용)
      const userSeason = entities.season as SeasonKr | undefined;

      // 계절 결정:
      // - yearly/seasonal 집계: 계절 필터 없음 (전체 기간)
      // - weekly/monthly: 계절 필터 없이 전체 조회 후 후처리로 필터링
      // - 그 외: 1. 명시적 계절 → 2. 특정 월 → 3. 현재 계절
      let season: SeasonKr | undefined;
      if (agg === "yearly" || agg === "seasonal") {
        // yearly/seasonal은 계절 필터 불필요 (연도별 또는 계절별 전체 조회)
        season = undefined;
      } else if (agg === "monthly" || agg === "weekly") {
        // monthly/weekly는 계절 필터 없이 전체 조회 후 후처리로 필터링
        season = undefined;
      } else if (entities.season) {
        season = entities.season as SeasonKr;
      } else if (entities.month) {
        season = getSeasonFromMonth(entities.month);
      } else if (agg === "daily") {
        // daily는 계절 필터 없이 연간 전체 데이터 표시
        season = undefined;
      } else {
        season = getCurrentSeason();
      }

      // dataType 판별 (정규화된 지역명으로)
      const regionName = normalizedRegions[0];
      const isActual = isSido(regionName);
      const dataType: DataType = isActual ? "actual" : "estimated";
      const isEstimated = !isActual;

      // ========================================
      // 시군구 런타임 추정 (DB에 추정 데이터가 없는 경우)
      // ========================================
      if (isEstimated) {
        // 1. 먼저 DB에 추정 데이터가 있는지 확인 (계절 조건 포함)
        const hasEstimatedData = entities.year
          ? await checkDataExists(regionName, entities.year, true, season)
          : (await resolveDefaultYear(regionName, true, season)) !== null;

        // 2. DB에 추정 데이터가 없으면 런타임 추정 수행
        if (!hasEstimatedData) {
          // 상위 광역시도 데이터가 있는 년도 찾기 (계절 조건 포함)
          const parent = await getParentProvince(regionName);
          if (!parent) {
            return {
              success: false,
              error: `${regionName}의 상위 광역시도 정보를 찾을 수 없습니다.`,
            };
          }

          const yearForEstimation =
            entities.year ??
            (await findYearWithParentData(parent.name, season));
          if (yearForEstimation === null) {
            const seasonLabel = season ? `${season}철 ` : "";
            return {
              success: false,
              error:
                `${regionName}의 ${seasonLabel}발전량 데이터가 없습니다.\n` +
                `상위 광역시도(${parent.name})의 최근 3년간(${getCurrentYear() - 2}~${getCurrentYear()}년) 데이터를 찾을 수 없습니다.`,
            };
          }

          // season이 없는 경우 현재 계절로 대체 (런타임 추정은 계절 필수)
          const estimationSeason = season ?? getCurrentSeason();

          // 런타임 추정 실행 (yearly의 경우 yearRange, weekly의 경우 month, 계절 필터 전달)
          const estimatedResult = await estimateCityGeneration(
            regionName,
            yearForEstimation,
            estimationSeason,
            agg,
            entities.yearRange ?? 3,
            entities.month ?? undefined,
            userSeason, // 사용자가 명시적으로 지정한 계절
          );

          if (!estimatedResult || estimatedResult.data.length === 0) {
            const seasonLabel = season ? `${season}철 ` : "";
            return {
              success: false,
              error:
                `${regionName}의 ${yearForEstimation}년 ${seasonLabel}발전량을 추정할 수 없습니다.\n` +
                `일사량 데이터가 부족합니다.`,
            };
          }

          // displayMode 결정: 그래프/차트/추이 요청 시 강제 chart
          const forceChartEstimated =
            entities.outputFormat === "chart" ||
            question.includes("그래프") ||
            question.includes("차트") ||
            question.includes("추이");
          const displayMode = forceChartEstimated
            ? "chart"
            : getDisplayMode(estimatedResult.data.length);

          results.push({
            data: estimatedResult.data,
            metadata: {
              region: regionName,
              season: season ?? getCurrentSeason(),
              year: yearForEstimation,
              month: entities.month,
              aggregations: [agg],
              sql: estimatedResult.sql,
              explanation: estimatedResult.explanation,
              dataType: "estimated",
              disclaimer: `※ 해당 데이터는 ${parent.name} 발전량과 일사량 비율을 기반으로 런타임 추정된 값으로 실제와 다를 수 있습니다.`,
              chartType: entities.chartType,
              displayMode,
              outputFormat: entities.outputFormat,
              showOnlyAverage: entities.showOnlyAverage,
            },
          });

          continue; // 다음 aggregation으로
        }
      }

      // ========================================
      // 기존 로직: DB에서 데이터 조회
      // ========================================

      // 년도 결정: 사용자 지정 연도 우선, 없으면 폴백
      let year: number | null;
      if (entities.year !== null) {
        // 사용자가 명시적으로 연도를 지정한 경우 해당 연도 데이터 존재 확인
        const hasData = await checkDataExists(
          regionName,
          entities.year,
          isEstimated,
          season,
        );
        if (!hasData) {
          const seasonLabel = season ? `${season}철 ` : "";
          return {
            success: false,
            error:
              `${regionName}의 ${entities.year}년 ${seasonLabel}데이터가 없습니다.\n` +
              `(데이터 제공 기간: 2022년~현재)`,
          };
        }
        year = entities.year;
      } else if (agg === "yearly") {
        // yearly: endYear 결정 (최근 데이터 있는 연도)
        year = await resolveDefaultYear(regionName, isEstimated);
      } else {
        year = await resolveDefaultYear(regionName, isEstimated, season);
      }

      // 데이터가 없는 경우
      if (year === null) {
        const seasonLabel = season ? `${season}철 ` : "";
        return {
          success: false,
          error:
            `${regionName}의 ${seasonLabel}발전량 데이터가 없습니다.\n` +
            `최근 3년간(${getCurrentYear() - 2}~${getCurrentYear()}년) 해당 조건의 데이터를 찾을 수 없습니다.`,
        };
      }

      // 엔티티에 정규화/폴백값 반영
      const enrichedEntities: ExtractedEntities = {
        ...entities,
        regions: normalizedRegions,
        season: season ?? null,
        year,
        yearRange: agg === "yearly" ? (entities.yearRange ?? 3) : null, // yearly일 때 yearRange 포함
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
        ...sqlResult.params,
      )) as Record<string, unknown>[];

      // 결과 변환 (BigInt → Number)
      let serializedData = data.map((row) => {
        const converted: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(row)) {
          if (typeof value === "bigint") {
            converted[key] = Number(value);
          } else if (value instanceof Date) {
            converted[key] = value.toISOString();
          } else if (
            typeof value === "object" &&
            value !== null &&
            "toNumber" in value
          ) {
            converted[key] = (value as { toNumber: () => number }).toNumber();
          } else {
            converted[key] = value;
          }
        }
        return converted;
      });

      // weekly 쿼리에서 월 또는 계절이 지정된 경우 필터링
      if (agg === "weekly" && serializedData.length > 0) {
        const seasonMonths: Record<SeasonKr, number[]> = {
          봄: [3, 4, 5],
          여름: [6, 7, 8],
          가을: [9, 10, 11],
          겨울: [12, 1, 2],
        };

        if (entities.month) {
          // 월이 지정된 경우: 해당 월에 시작하는 주만 필터링
          const targetMonth = entities.month;
          serializedData = serializedData.filter((row) => {
            const startDate = new Date(row.start_date as string);
            return startDate.getMonth() + 1 === targetMonth;
          });
        } else if (entities.season) {
          // 계절이 지정된 경우: 해당 계절 월에 시작하는 주만 필터링
          const months = seasonMonths[entities.season as SeasonKr];
          serializedData = serializedData.filter((row) => {
            const startDate = new Date(row.start_date as string);
            return months.includes(startDate.getMonth() + 1);
          });
        }

        // 주별 데이터에 week_label 추가 ("3월 1주차" 형태)
        const monthWeekCounter: Record<number, number> = {};
        serializedData = serializedData.map((row) => {
          const startDate = new Date(row.start_date as string);
          const startMonth = startDate.getMonth() + 1;

          if (!monthWeekCounter[startMonth]) {
            monthWeekCounter[startMonth] = 1;
          } else {
            monthWeekCounter[startMonth]++;
          }

          const weekInMonth = monthWeekCounter[startMonth];
          return {
            ...row,
            week_label: `${startMonth}월 ${weekInMonth}주차`,
          };
        });
      }

      // monthly 쿼리에서 계절이 지정된 경우 필터링 + season 한글 변환
      if (agg === "monthly" && serializedData.length > 0) {
        const seasonMonths: Record<SeasonKr, number[]> = {
          봄: [3, 4, 5],
          여름: [6, 7, 8],
          가을: [9, 10, 11],
          겨울: [12, 1, 2],
        };

        // 계절 필터링
        if (entities.season) {
          const months = seasonMonths[entities.season as SeasonKr];
          serializedData = serializedData.filter((row) => {
            return months.includes(row.month as number);
          });
        }

        // season 한글 변환
        serializedData = serializedData.map((row) => ({
          ...row,
          season: row.season
            ? seasonToKorean(row.season as string)
            : row.season,
        }));
      }

      // seasonal 쿼리에서 season 한글 변환 및 정렬
      if (agg === "seasonal" && serializedData.length > 0) {
        const seasonOrderKr = ["봄", "여름", "가을", "겨울"];
        serializedData = serializedData
          .map((row) => ({
            ...row,
            season: row.season
              ? seasonToKorean(row.season as string)
              : row.season,
          }))
          .sort((a, b) => {
            const aIdx = seasonOrderKr.indexOf(a.season as string);
            const bIdx = seasonOrderKr.indexOf(b.season as string);
            return aIdx - bIdx;
          });
      }

      // disclaimer 생성 (시군구인 경우)
      const disclaimer =
        dataType === "estimated"
          ? `※ 해당 데이터는 광역시도 발전량 기반으로 추정된 값으로 실제와 다를 수 있습니다.`
          : undefined;

      // displayMode 결정:
      // 1. 사용자가 "그래프"/"차트"를 명시적으로 요청하면 강제로 chart
      // 2. 그 외에는 데이터 개수에 따라 결정 (1개: text, 2-3개: list, 4개 이상: chart)
      const forceChart =
        entities.outputFormat === "chart" ||
        question.includes("그래프") ||
        question.includes("차트") ||
        question.includes("추이");
      const displayMode = forceChart
        ? "chart"
        : getDisplayMode(serializedData.length);

      // yearly의 경우 year range를 표시하기 위한 설명 보정
      const metadataSeason = season ?? getCurrentSeason();

      results.push({
        data: serializedData,
        metadata: {
          region: regionName,
          season: metadataSeason,
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
    const hasAnyData = results.some((r) => r.data.length > 0);
    if (!hasAnyData) {
      const regionName = normalizedRegions[0];
      const firstSeason = results[0]?.metadata.season ?? "해당";
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
        error instanceof Error ? error.message : "처리 중 오류가 발생했습니다.",
    };
  }
}
