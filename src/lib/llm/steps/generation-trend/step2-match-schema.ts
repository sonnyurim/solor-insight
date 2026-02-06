/**
 * Step 2: 스키마 매칭
 * 엔티티 추출 결과를 바탕으로 필요한 테이블과 컬럼을 선택
 */

import { invokeBedrockModel } from '@/lib/bedrock/client';
import { BEDROCK_MODELS } from '@/lib/bedrock/models';
import { DB_SCHEMA } from '@/constants/db-schema';
import type { ExtractedEntities } from './step1-extract-entities';

export interface SchemaMatchResult {
  tables: string[];
  columns: string[];
  joins: string[];
  filters: string[];
}

const STEP2_SYSTEM_PROMPT = `당신은 SQL 스키마 매칭 전문가입니다.

## 역할
엔티티 추출 결과를 바탕으로 필요한 테이블과 컬럼을 선택합니다.

## 데이터베이스 스키마
${DB_SCHEMA}

## ⚠️ 테이블 선택 우선순위 규칙 (필수)
집계 단위(aggregations)에 따라 적절한 테이블을 선택하세요:

| 집계 단위 | 사용 테이블 | 조인 |
|----------|------------|------|
| hourly | raw_generation | JOIN regions |
| daily | agg_daily | JOIN regions |
| weekly | agg_weekly | JOIN regions |
| monthly | agg_monthly | JOIN regions |
| yearly | agg_monthly | JOIN regions (연도별 SUM 집계) |
| seasonal | agg_monthly | JOIN regions (계절별 SUM 집계) |
| day_of_week | raw_generation | JOIN regions (EXTRACT(DOW FROM trade_date) 사용) |

## ⚠️ 중요: 지역 필터 규칙
- regions 테이블의 name 컬럼으로 지역 필터링
- 광역시도인 경우: r.type = 'PROVINCE' AND r.name = ?
- 시군구인 경우: r.type = 'CITY' AND r.name = ?

## ⚠️ 중요: 데이터 타입 규칙
- 광역시도: is_estimated = false (실제 데이터)
- 시군구: is_estimated = true (추정 데이터)

## 규칙
1. 집계 단위에 맞는 테이블 선택 (위 우선순위 필수 준수)
2. 필요한 컬럼만 선택
3. regions 조인 조건 명시
4. WHERE 조건 힌트 제공

## 출력 형식 (JSON만 출력, 설명 없이)
{
  "tables": ["raw_generation", "regions"],
  "columns": ["hour", "generation_kwh", "r.name"],
  "joins": ["JOIN regions r ON rg.region_id = r.id"],
  "filters": ["r.name = ?", "rg.trade_date BETWEEN ? AND ?", "rg.is_estimated = ?"]
}`;

const STEP2_USER_PROMPT = `## 추출된 엔티티
{entities}

## JSON 응답`;

export async function matchSchema(entities: ExtractedEntities): Promise<SchemaMatchResult> {
  const prompt = STEP2_USER_PROMPT.replace(
    '{entities}',
    JSON.stringify(entities, null, 2)
  );

  const response = await invokeBedrockModel(
    prompt,
    STEP2_SYSTEM_PROMPT,
    BEDROCK_MODELS.CLASSIFIER
  );

  // JSON 파싱 (코드 블록 제거)
  const jsonStr = response.replace(/```json\n?|\n?```/g, '').trim();

  // <think> 태그 제거
  const cleanedStr = jsonStr.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  try {
    const jsonMatch = cleanedStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('JSON을 찾을 수 없습니다');
    }

    return JSON.parse(jsonMatch[0]);
  } catch {
    return getDefaultSchema(entities.aggregations);
  }
}

/**
 * 집계 단위 기반 기본 스키마 선택 (fallback)
 */
function getDefaultSchema(aggregations: string[]): SchemaMatchResult {
  const agg = aggregations[0] || 'monthly';

  if (agg === 'daily') {
    return {
      tables: ['agg_daily', 'regions'],
      columns: ['ad.date', 'ad.total_kwh', 'ad.avg_kwh', 'ad.max_kwh', 'ad.max_hour', 'r.name'],
      joins: ['JOIN regions r ON ad.region_id = r.id'],
      filters: ['r.name = ?', 'EXTRACT(YEAR FROM ad.date) = ?', 'ad.is_estimated = ?'],
    };
  }

  if (agg === 'weekly') {
    return {
      tables: ['agg_weekly', 'regions'],
      columns: ['aw.year', 'aw.week_no', 'aw.total_kwh', 'aw.avg_kwh', 'r.name'],
      joins: ['JOIN regions r ON aw.region_id = r.id'],
      filters: ['r.name = ?', 'aw.year = ?', 'aw.is_estimated = ?'],
    };
  }

  if (agg === 'monthly') {
    return {
      tables: ['agg_monthly', 'regions'],
      columns: ['am.year', 'am.month', 'am.total_kwh', 'am.avg_kwh', 'am.season', 'r.name'],
      joins: ['JOIN regions r ON am.region_id = r.id'],
      filters: ['r.name = ?', 'am.year = ?', 'am.is_estimated = ?'],
    };
  }

  if (agg === 'yearly') {
    return {
      tables: ['agg_monthly', 'regions'],
      columns: ['am.year', 'SUM(am.total_kwh)', 'AVG(am.avg_kwh)', 'r.name'],
      joins: ['JOIN regions r ON am.region_id = r.id'],
      filters: ['r.name = ?', 'am.year IN (...)', 'am.is_estimated = ?'],
    };
  }

  if (agg === 'seasonal') {
    return {
      tables: ['agg_monthly', 'regions'],
      columns: ['am.season', 'SUM(am.total_kwh)', 'AVG(am.avg_kwh)', 'r.name'],
      joins: ['JOIN regions r ON am.region_id = r.id'],
      filters: ['r.name = ?', 'am.year = ?', 'am.is_estimated = ?'],
    };
  }

  // hourly (default)
  return {
    tables: ['raw_generation', 'regions'],
    columns: ['rg.hour', 'rg.generation_kwh', 'r.name'],
    joins: ['JOIN regions r ON rg.region_id = r.id'],
    filters: ['r.name = ?', 'EXTRACT(YEAR FROM rg.trade_date) = ?', 'rg.is_estimated = ?'],
  };
}
