/**
 * Step 1: 엔티티 추출
 * 사용자 질문에서 발전량 조회에 필요한 엔티티를 추출
 */

import { invokeBedrockModel } from '@/lib/bedrock/client';
import { BEDROCK_MODELS } from '@/lib/bedrock/models';

// 재시도 설정
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

// 유효한 데이터 범위 상수
const MIN_VALID_YEAR = 2016;
const VALID_SEASONS = ['봄', '여름', '가을', '겨울'];

export interface ExtractedEntities {
  regions: string[];
  season: string | null;
  year: number | null;
  month: number | null;
  yearRange: number | null; // "3년" → 3, "5년" → 5 (N년 발전량 추이)
  aggregations: string[];
  isWeekend: boolean | null;
  chartType: 'bar' | 'line' | null;
  showOnlyAverage: boolean;
  outputFormat: 'chart' | 'table' | null;
}

const STEP1_SYSTEM_PROMPT = `당신은 태양광 발전량 조회 시스템의 엔티티 추출기입니다.

## 역할
사용자 질문에서 발전량 조회에 필요한 엔티티를 추출합니다.

## 엔티티 추출 규칙
1. regions: 지역명 배열 (시군구 또는 광역시도)
   - 축약어도 그대로 추출: "전남", "고흥", "서울" 등
   - 여러 지역 가능: ["고흥", "여수"]

2. season: 계절 (없으면 null)
   - 봄, 여름, 가을, 겨울
   - "봄철", "봄시즌" → "봄"
   - "겨울철" → "겨울"

3. year: 연도 숫자 (없으면 null)
   - "작년" → 현재년도-1
   - "올해" → 현재년도
   - 명시적 연도: 2024, 2025 등
   - ⚠️ "N년 추이/발전량" (예: "3년 발전량 추이")에서 N은 year가 아니라 yearRange에 넣어야 합니다

4. month: 월 숫자 (없으면 null)
   - "3월", "3월달" → 3
   - "12월" → 12

5. yearRange: N년간 데이터 조회 (없으면 null)
   - "3년 발전량 추이" → 3
   - "5년 추이" → 5
   - "최근 3년" → 3
   - 특정 연도(예: "2019년 발전량")는 yearRange가 아닌 year에 넣습니다.

6. aggregations: 집계 단위 배열
   - 시간별/시간대별/24시간 → "hourly"
   - 일별/매일 → "daily"
   - 주별/주간별/매주 → "weekly"
   - 월별/월간별/매월 → "monthly"
   - 연별/연간별/연도별 → "yearly"
   - 계절별/분기별/시즌별 → "seasonal"
   - 요일별/요일단위 → "day_of_week"
   - ⚠️ 중요한 판별 규칙:
     - "2019년 발전량 그래프 추이" → 특정 연도 1년의 데이터 → aggregations: ["monthly"], year: 2019
     - "3년 발전량 그래프 추이" → N년간 연도별 데이터 → aggregations: ["yearly"], yearRange: 3
     - "월별 발전량 추이" → aggregations: ["monthly"]
     - "시간별 발전량 추이" → aggregations: ["hourly"]
     - "계절별 발전량 추이" → aggregations: ["seasonal"]
     - "겨울철 발전량 추이" → season: "겨울", aggregations: ["monthly"] (특정 계절의 월별 데이터)
   - 없으면 ["monthly"] 기본값

7. isWeekend: 주말/평일 필터
   - 주말 → true
   - 평일 → false
   - 없으면 null

8. chartType: 그래프 유형 (없으면 null)
   - 막대 그래프/바 차트/막대 → "bar"
   - 선 그래프/라인 차트/선 → "line"

9. showOnlyAverage: 평균만 표시 여부 (기본값 false)
   - "평균 발전량", "평균만", "평균값" → true
   - 그 외 → false

10. outputFormat: 출력 형식 (없으면 null)
   - "표로", "테이블로", "리스트로", "목록으로" → "table"
   - "그래프로", "차트로", "시각화" → "chart"
   - 없으면 null

## 출력 형식 (JSON만 출력, 설명 없이)
{
  "regions": ["고흥"],
  "season": "봄",
  "year": null,
  "month": null,
  "yearRange": null,
  "aggregations": ["hourly"],
  "isWeekend": null,
  "chartType": null,
  "showOnlyAverage": false,
  "outputFormat": null
}`;

const STEP1_USER_PROMPT = `## 사용자 질문
{question}

## JSON 응답`;

/**
 * LLM 응답에서 JSON을 파싱하는 헬퍼 함수
 */
function parseResponse(response: string): ExtractedEntities {
  // JSON 파싱 (코드 블록 제거)
  const jsonStr = response.replace(/```json\n?|\n?```/g, '').trim();

  // <think> 태그 제거 (Qwen3의 thinking 출력)
  const cleanedStr = jsonStr.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  // JSON 부분만 추출 (앞뒤 텍스트 제거)
  const jsonMatch = cleanedStr.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('JSON을 찾을 수 없습니다');
  }

  return JSON.parse(jsonMatch[0]);
}

/**
 * 추출된 엔티티 유효성 검증 및 정제
 * - 연도: 2016 ~ 현재연도 범위 체크
 * - 월: 1~12 범위 체크
 * - 계절: 유효한 값인지 체크
 */
function validateAndSanitizeEntities(entities: ExtractedEntities): ExtractedEntities {
  const currentYear = new Date().getFullYear();

  // 연도 검증: 2016 ~ 현재연도
  let year = entities.year;
  if (year !== null) {
    if (year < MIN_VALID_YEAR || year > currentYear) {
      year = null;
    }
  }

  // 월 검증: 1~12
  let month = entities.month;
  if (month !== null) {
    if (month < 1 || month > 12) {
      month = null;
    }
  }

  // 계절 검증
  let season = entities.season;
  if (season !== null) {
    if (!VALID_SEASONS.includes(season)) {
      season = null;
    }
  }

  // yearRange 검증: 1~10 범위
  let yearRange = entities.yearRange ?? null;
  if (yearRange !== null) {
    if (yearRange < 1 || yearRange > 10) {
      yearRange = null;
    }
  }

  return {
    ...entities,
    year,
    month,
    season,
    yearRange,
  };
}

/**
 * 기본 엔티티 반환 (모든 재시도 실패 시)
 */
function getDefaultEntities(): ExtractedEntities {
  return {
    regions: [],
    season: null,
    year: null,
    month: null,
    yearRange: null,
    aggregations: ['monthly'],
    isWeekend: null,
    chartType: null,
    showOnlyAverage: false,
    outputFormat: null,
  };
}

/**
 * 지연 헬퍼 함수
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function extractEntities(question: string): Promise<ExtractedEntities> {
  const prompt = STEP1_USER_PROMPT.replace('{question}', question);

  // 재시도 로직 (최대 MAX_RETRIES회)
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        await delay(RETRY_DELAY_MS);
      }

      const response = await invokeBedrockModel(
        prompt,
        STEP1_SYSTEM_PROMPT,
        BEDROCK_MODELS.CLASSIFIER
      );

      const entities = parseResponse(response);

      // 유효성 검증 및 정제
      return validateAndSanitizeEntities(entities);
    } catch {
      // 재시도
    }
  }

  // 모든 재시도 실패
  return getDefaultEntities();
}
