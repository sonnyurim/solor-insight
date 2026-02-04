/**
 * Step 3: SQL 생성
 * 엔티티와 스키마 정보를 바탕으로 안전한 SQL을 생성
 */

import { invokeBedrockModel } from '@/lib/bedrock/client';
import { BEDROCK_MODELS } from '@/lib/bedrock/models';
import type { ExtractedEntities } from './step1-extract-entities';
import type { SchemaMatchResult } from './step2-match-schema';

// 재시도 설정
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

// 허용된 테이블 화이트리스트
const ALLOWED_TABLES = ['raw_generation', 'agg_daily', 'agg_weekly', 'agg_monthly', 'regions'];

// 계절 → 월 매핑
const SEASON_MONTHS: Record<string, number[]> = {
  '봄': [3, 4, 5],
  '여름': [6, 7, 8],
  '가을': [9, 10, 11],
  '겨울': [12, 1, 2],
};

export interface SqlGenerationResult {
  sql: string;
  params: (string | number | boolean)[];
  explanation: string;
}

const STEP3_SYSTEM_PROMPT = `당신은 PostgreSQL 쿼리 생성 전문가입니다.

## 역할
엔티티와 스키마 정보를 바탕으로 안전한 SQL을 생성합니다.

## SQL 생성 규칙
1. SELECT 문만 생성 (읽기 전용)
2. 파라미터는 $1, $2, $3 형식 사용
3. 집계 함수: AVG, SUM, MIN, MAX
4. GROUP BY 필수 (집계 시)
5. ORDER BY로 정렬
6. 숫자는 ROUND(...::numeric, 3) 적용

## ⚠️ 중요: 새 테이블 구조
- regions: 지역 마스터 (name으로 필터링)
- raw_generation: 시간별 발전량 (region_id, trade_date, hour, generation_kwh, is_estimated)
- agg_daily: 일별 집계 (region_id, date, total_kwh, avg_kwh, max_kwh, is_estimated)
- agg_weekly: 주별 집계 (region_id, year, week_no, total_kwh, avg_kwh, is_estimated)
- agg_monthly: 월별 집계 (region_id, year, month, total_kwh, avg_kwh, season, is_estimated)

## ⚠️ 중요: is_estimated 규칙
- 광역시도 (서울특별시, 전라남도 등): is_estimated = false
- 시군구 (고흥군, 여수시 등): is_estimated = true

## ⚠️ 중요: params 배열 순서 규칙 (필수)
- params 배열의 순서는 반드시 SQL 내의 $1, $2, $3... 순서와 정확히 일치해야 합니다.

## 집계 유형별 SQL 패턴

### hourly (시간별)
SELECT rg.hour, 
  ROUND(AVG(rg.generation_kwh)::numeric, 3) as avg_kwh,
  ROUND(MIN(rg.generation_kwh)::numeric, 3) as min_kwh,
  ROUND(MAX(rg.generation_kwh)::numeric, 3) as max_kwh
FROM raw_generation rg
JOIN regions r ON rg.region_id = r.id
WHERE r.name = $1 
  AND EXTRACT(YEAR FROM rg.trade_date) = $2
  AND rg.is_estimated = $3
GROUP BY rg.hour
ORDER BY rg.hour

### hourly (showOnlyAverage: true)
SELECT rg.hour, 
  ROUND(AVG(rg.generation_kwh)::numeric, 3) as avg_kwh
FROM raw_generation rg
JOIN regions r ON rg.region_id = r.id
WHERE r.name = $1 
  AND EXTRACT(YEAR FROM rg.trade_date) = $2
  AND rg.is_estimated = $3
GROUP BY rg.hour
ORDER BY rg.hour

### hourly (계절 필터)
SELECT rg.hour, 
  ROUND(AVG(rg.generation_kwh)::numeric, 3) as avg_kwh
FROM raw_generation rg
JOIN regions r ON rg.region_id = r.id
WHERE r.name = $1 
  AND EXTRACT(YEAR FROM rg.trade_date) = $2
  AND EXTRACT(MONTH FROM rg.trade_date) IN (3, 4, 5)  -- 봄: 3,4,5 / 여름: 6,7,8 / 가을: 9,10,11 / 겨울: 12,1,2
  AND rg.is_estimated = $3
GROUP BY rg.hour
ORDER BY rg.hour

### daily (일별)
SELECT ad.date,
  ROUND(ad.total_kwh::numeric, 3) as total_kwh,
  ROUND(ad.avg_kwh::numeric, 3) as avg_kwh
FROM agg_daily ad
JOIN regions r ON ad.region_id = r.id
WHERE r.name = $1 
  AND EXTRACT(YEAR FROM ad.date) = $2
  AND ad.is_estimated = $3
ORDER BY ad.date

### weekly (주별)
SELECT aw.week_no,
  aw.start_date,
  aw.end_date,
  ROUND(aw.total_kwh::numeric, 3) as total_kwh,
  ROUND(aw.avg_kwh::numeric, 3) as avg_kwh
FROM agg_weekly aw
JOIN regions r ON aw.region_id = r.id
WHERE r.name = $1 
  AND aw.year = $2
  AND aw.is_estimated = $3
ORDER BY aw.week_no

### monthly (월별)
SELECT am.month,
  ROUND(am.total_kwh::numeric, 3) as total_kwh,
  ROUND(am.avg_kwh::numeric, 3) as avg_kwh,
  am.season
FROM agg_monthly am
JOIN regions r ON am.region_id = r.id
WHERE r.name = $1 
  AND am.year = $2
  AND am.is_estimated = $3
ORDER BY am.month

### day_of_week (요일별)
SELECT EXTRACT(DOW FROM rg.trade_date)::int as day_of_week,
  CASE EXTRACT(DOW FROM rg.trade_date)::int
    WHEN 0 THEN '일요일'
    WHEN 1 THEN '월요일'
    WHEN 2 THEN '화요일'
    WHEN 3 THEN '수요일'
    WHEN 4 THEN '목요일'
    WHEN 5 THEN '금요일'
    WHEN 6 THEN '토요일'
  END as day_name,
  ROUND(AVG(rg.generation_kwh)::numeric, 3) as avg_kwh
FROM raw_generation rg
JOIN regions r ON rg.region_id = r.id
WHERE r.name = $1 
  AND EXTRACT(YEAR FROM rg.trade_date) = $2
  AND rg.is_estimated = $3
GROUP BY EXTRACT(DOW FROM rg.trade_date)
ORDER BY day_of_week

## 계절 → 월 매핑
- 봄 (SPRING): EXTRACT(MONTH FROM ...) IN (3, 4, 5)
- 여름 (SUMMER): EXTRACT(MONTH FROM ...) IN (6, 7, 8)
- 가을 (FALL): EXTRACT(MONTH FROM ...) IN (9, 10, 11)
- 겨울 (WINTER): EXTRACT(MONTH FROM ...) IN (12, 1, 2)

## 출력 형식 (JSON만 출력, 설명 없이)
{
  "sql": "SELECT rg.hour, ROUND(AVG(rg.generation_kwh)::numeric, 3) as avg_kwh FROM raw_generation rg JOIN regions r ON rg.region_id = r.id WHERE r.name = $1 AND EXTRACT(YEAR FROM rg.trade_date) = $2 AND rg.is_estimated = $3 GROUP BY rg.hour ORDER BY rg.hour",
  "params": ["전라남도", 2025, false],
  "explanation": "전라남도의 시간별 평균 발전량 조회"
}`;

const STEP3_USER_PROMPT = `## 원본 질문
{question}

## 추출된 엔티티
{entities}

## 스키마 매칭 결과
{schema}

## JSON 응답`;

/**
 * LLM 응답에서 SQL 결과를 파싱하고 검증
 */
function parseAndValidateSqlResponse(response: string): SqlGenerationResult {
  // JSON 파싱 (코드 블록 제거)
  const jsonStr = response.replace(/```json\n?|\n?```/g, '').trim();

  // <think> 태그 제거
  const cleanedStr = jsonStr.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  const jsonMatch = cleanedStr.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('JSON을 찾을 수 없습니다');
  }

  const result = JSON.parse(jsonMatch[0]) as SqlGenerationResult;

  // SQL 안전성 검증
  if (!isValidSql(result.sql)) {
    throw new Error('Invalid SQL: 위험한 키워드 감지');
  }

  // 화이트리스트 검증
  if (!validateWhitelist(result.sql)) {
    throw new Error('Invalid SQL: 허용되지 않은 테이블 또는 패턴');
  }

  // params 개수/순서 검증
  if (!validateParamsCount(result.sql, result.params)) {
    throw new Error('Invalid SQL: 파라미터 개수/순서 불일치');
  }

  return result;
}

export async function generateSql(
  question: string,
  entities: ExtractedEntities,
  schema: SchemaMatchResult
): Promise<SqlGenerationResult> {
  const prompt = STEP3_USER_PROMPT
    .replace('{question}', question)
    .replace('{entities}', JSON.stringify(entities, null, 2))
    .replace('{schema}', JSON.stringify(schema, null, 2));

  // 재시도 로직 (최대 MAX_RETRIES회)
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        await delay(RETRY_DELAY_MS);
      }

      const response = await invokeBedrockModel(
        prompt,
        STEP3_SYSTEM_PROMPT,
        BEDROCK_MODELS.CLASSIFIER
      );

      return parseAndValidateSqlResponse(response);
    } catch {
      // 재시도
    }
  }

  // 모든 재시도 실패 시 Fallback SQL 사용
  return getFallbackSql(entities, schema);
}

/**
 * SQL 안전성 검증
 * SELECT 문만 허용, 위험 키워드 차단
 */
function isValidSql(sql: string): boolean {
  const upperSql = sql.toUpperCase();

  // SELECT만 허용
  if (!upperSql.trim().startsWith('SELECT')) {
    return false;
  }

  // 위험 키워드 차단
  const dangerousKeywords = [
    'DROP',
    'DELETE',
    'UPDATE',
    'INSERT',
    'TRUNCATE',
    'ALTER',
    'CREATE',
    '--',
    ';',
  ];
  for (const keyword of dangerousKeywords) {
    if (upperSql.includes(keyword)) {
      return false;
    }
  }

  return true;
}

/**
 * params 개수/순서 검증
 */
function validateParamsCount(sql: string, params: unknown[]): boolean {
  // SQL에서 $1, $2, $3... 패턴 추출
  const placeholders = sql.match(/\$\d+/g) || [];

  // 중복 제거 후 개수 확인
  const uniquePlaceholders = [...new Set(placeholders)];

  if (uniquePlaceholders.length !== params.length) {
    return false;
  }

  // 순차적 번호 검증 ($1, $2, $3... 순서)
  const expectedNumbers = Array.from(
    { length: params.length },
    (_, i) => `$${i + 1}`
  );
  const sortedPlaceholders = uniquePlaceholders.sort((a, b) => {
    return parseInt(a.slice(1)) - parseInt(b.slice(1));
  });

  for (let i = 0; i < expectedNumbers.length; i++) {
    if (sortedPlaceholders[i] !== expectedNumbers[i]) {
      return false;
    }
  }

  return true;
}

/**
 * 테이블/컬럼 화이트리스트 검증
 * SQL에서 참조되는 테이블과 컬럼이 허용 목록에 있는지 확인
 */
function validateWhitelist(sql: string): boolean {
  const upperSql = sql.toUpperCase();

  // FROM/JOIN 절에서 테이블명 추출
  const tableMatches = sql.match(/(?:FROM|JOIN)\s+(\w+)/gi) || [];
  for (const match of tableMatches) {
    const tableName = match.replace(/(?:FROM|JOIN)\s+/i, '').toLowerCase();
    if (!ALLOWED_TABLES.includes(tableName)) {
      return false;
    }
  }

  // 기본적인 위험 패턴 체크 (서브쿼리, UNION 등)
  const dangerousPatterns = ['UNION', 'INTO', 'EXEC', 'EXECUTE', 'XP_'];
  for (const pattern of dangerousPatterns) {
    if (upperSql.includes(pattern)) {
      return false;
    }
  }

  return true;
}

/**
 * 지연 헬퍼 함수
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 집계 단위에 따른 Fallback SQL 생성
 * LLM 실패 시 기본 패턴 기반으로 안전한 SQL 생성
 */
function getFallbackSql(
  entities: ExtractedEntities,
  schema: SchemaMatchResult
): SqlGenerationResult {
  const regionName = entities.regions[0] || '';
  const year = entities.year || new Date().getFullYear();
  const isEstimated = schema.filters?.some(f => f.includes('is_estimated = true')) ?? false;
  const aggregation = entities.aggregations[0] || 'hourly';
  const season = entities.season;

  // 계절 필터 조건 생성
  let seasonCondition = '';
  if (season && SEASON_MONTHS[season]) {
    const months = SEASON_MONTHS[season];
    seasonCondition = ` AND EXTRACT(MONTH FROM rg.trade_date) IN (${months.join(', ')})`;
  }

  switch (aggregation) {
    case 'daily':
      return {
        sql: `SELECT ad.date, ROUND(ad.total_kwh::numeric, 3) as total_kwh, ROUND(ad.avg_kwh::numeric, 3) as avg_kwh FROM agg_daily ad JOIN regions r ON ad.region_id = r.id WHERE r.name = $1 AND EXTRACT(YEAR FROM ad.date) = $2 AND ad.is_estimated = $3 ORDER BY ad.date`,
        params: [regionName, year, isEstimated],
        explanation: `${regionName}의 ${year}년 일별 발전량 조회 (Fallback)`,
      };

    case 'weekly':
      return {
        sql: `SELECT aw.week_no, aw.start_date, aw.end_date, ROUND(aw.total_kwh::numeric, 3) as total_kwh, ROUND(aw.avg_kwh::numeric, 3) as avg_kwh FROM agg_weekly aw JOIN regions r ON aw.region_id = r.id WHERE r.name = $1 AND aw.year = $2 AND aw.is_estimated = $3 ORDER BY aw.week_no`,
        params: [regionName, year, isEstimated],
        explanation: `${regionName}의 ${year}년 주별 발전량 조회 (Fallback)`,
      };

    case 'monthly':
      return {
        sql: `SELECT am.month, ROUND(am.total_kwh::numeric, 3) as total_kwh, ROUND(am.avg_kwh::numeric, 3) as avg_kwh, am.season FROM agg_monthly am JOIN regions r ON am.region_id = r.id WHERE r.name = $1 AND am.year = $2 AND am.is_estimated = $3 ORDER BY am.month`,
        params: [regionName, year, isEstimated],
        explanation: `${regionName}의 ${year}년 월별 발전량 조회 (Fallback)`,
      };

    case 'day_of_week':
      return {
        sql: `SELECT EXTRACT(DOW FROM rg.trade_date)::int as day_of_week, CASE EXTRACT(DOW FROM rg.trade_date)::int WHEN 0 THEN '일요일' WHEN 1 THEN '월요일' WHEN 2 THEN '화요일' WHEN 3 THEN '수요일' WHEN 4 THEN '목요일' WHEN 5 THEN '금요일' WHEN 6 THEN '토요일' END as day_name, ROUND(AVG(rg.generation_kwh)::numeric, 3) as avg_kwh FROM raw_generation rg JOIN regions r ON rg.region_id = r.id WHERE r.name = $1 AND EXTRACT(YEAR FROM rg.trade_date) = $2 AND rg.is_estimated = $3${seasonCondition} GROUP BY EXTRACT(DOW FROM rg.trade_date) ORDER BY day_of_week`,
        params: [regionName, year, isEstimated],
        explanation: `${regionName}의 ${year}년${season ? ` ${season}` : ''} 요일별 평균 발전량 조회 (Fallback)`,
      };

    case 'hourly':
    default:
      return {
        sql: `SELECT rg.hour, ROUND(AVG(rg.generation_kwh)::numeric, 3) as avg_kwh, ROUND(MIN(rg.generation_kwh)::numeric, 3) as min_kwh, ROUND(MAX(rg.generation_kwh)::numeric, 3) as max_kwh FROM raw_generation rg JOIN regions r ON rg.region_id = r.id WHERE r.name = $1 AND EXTRACT(YEAR FROM rg.trade_date) = $2 AND rg.is_estimated = $3${seasonCondition} GROUP BY rg.hour ORDER BY rg.hour`,
        params: [regionName, year, isEstimated],
        explanation: `${regionName}의 ${year}년${season ? ` ${season}` : ''} 시간별 평균 발전량 조회 (Fallback)`,
      };
  }
}
