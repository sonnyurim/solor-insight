/**
 * 에러 및 안내 메시지 상수
 * 여러 파일에 흩어져 있는 한글 메시지를 중앙에서 관리
 */

// ==================== 지역 관련 메시지 ====================

export const REGION_MESSAGES = {
  /** 지역 정보가 없을 때 안내 메시지 */
  REGION_REQUIRED:
    '지역 정보가 필요합니다. 다음과 같이 질문해주세요:\n' +
    '예) "고흥군 봄철 시간별 발전량 보여줘"\n' +
    '예) "전라남도 여름 발전량 추이"',

  /** 모호한 지역명 기본 안내 */
  AMBIGUOUS_REGION_DEFAULT: '지역을 더 구체적으로 말씀해주세요.',

  /** 데이터 없음 - 특정 조건 */
  NO_DATA_FOR_CONDITION: (region: string, season: string, year: number) =>
    `${region}의 ${year}년 ${season}철 발전량 데이터가 없습니다.`,

  /** 데이터 없음 - 3년간 데이터 없음 */
  NO_DATA_RECENT_YEARS: (region: string, season: string, startYear: number, endYear: number) =>
    `${region}의 ${season}철 발전량 데이터가 없습니다.\n` +
    `최근 3년간(${startYear}~${endYear}년) 해당 조건의 데이터를 찾을 수 없습니다.`,
} as const;

// ==================== LLM 처리 관련 메시지 ====================

export const LLM_MESSAGES = {
  /** JSON 파싱 실패 */
  JSON_PARSE_FAILED: 'JSON을 찾을 수 없습니다',

  /** SQL 생성 실패 */
  SQL_GENERATION_FAILED: 'SQL 생성 실패',

  /** 위험한 키워드 감지 */
  DANGEROUS_SQL_KEYWORDS: 'Invalid SQL: 위험한 키워드 감지',

  /** 파라미터 불일치 */
  PARAMS_MISMATCH: 'Invalid SQL: 파라미터 개수/순서 불일치',

  /** 화이트리스트 검증 실패 */
  WHITELIST_VALIDATION_FAILED: 'Invalid SQL: 허용되지 않은 테이블 또는 패턴',
} as const;

// ==================== 계산기 관련 메시지 ====================

export const CALCULATOR_MESSAGES = {
  /** 용량 필요 */
  CAPACITY_REQUIRED: '설비 용량(kW) 정보가 필요합니다.',

  /** 계산 결과 disclaimer */
  DISCLAIMER_ACTUAL:
    '※ 실제 발전량은 일사량, 설비 효율 등에 따라 달라질 수 있습니다.',

  /** 추정 데이터 disclaimer */
  DISCLAIMER_ESTIMATED:
    '※ 해당 데이터는 광역시도 발전량 기반으로 추정된 값으로 실제와 다를 수 있습니다.',
} as const;

// ==================== 일반 에러 메시지 ====================

export const ERROR_MESSAGES = {
  /** 처리 중 오류 */
  PROCESSING_ERROR: '처리 중 오류가 발생했습니다.',

  /** 환경변수 미설정 */
  ENV_NOT_SET: (envName: string) => `${envName} 환경변수가 설정되지 않았습니다.`,
} as const;

// ==================== 검증 관련 메시지 ====================

export const VALIDATION_MESSAGES = {
  /** 유효하지 않은 연도 */
  INVALID_YEAR: (year: number) => `유효하지 않은 연도: ${year}, null로 설정`,

  /** 유효하지 않은 월 */
  INVALID_MONTH: (month: number) => `유효하지 않은 월: ${month}, null로 설정`,

  /** 유효하지 않은 계절 */
  INVALID_SEASON: (season: string) => `유효하지 않은 계절: ${season}, null로 설정`,
} as const;
