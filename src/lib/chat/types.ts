// ==================== 기본 타입 정의 ====================

// 가드레일 차단 유형
export type GuardrailType =
  | "out_of_data_range"
  | "future_prediction"
  | "equipment_consult"
  | "legal_tax"
  | "direct_task"
  | "illegal"
  | "private_data"
  | "abuse";

// 의도 유형
export type IntentType =
  | "GENERATION_TREND"
  | "CALCULATOR"
  | "PROCEDURE"
  | "GENERAL";

// 신뢰도 레벨
export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

// 가드레일 차단 메시지 매핑
export const GUARDRAIL_MESSAGES: Record<GuardrailType, string> = {
  out_of_data_range: "2016년 이전 데이터는 제공하지 않습니다.",
  future_prediction: "미래 예측은 제공하지 않습니다.",
  equipment_consult:
    "설비 관련 문의는 한국에너지공단(1670-8757)으로 연락해 주세요.",
  legal_tax: "세금 및 법적 문제는 전문가 상담을 권장합니다.",
  direct_task: "직접적인 작업 수행은 불가하며, 절차 안내만 가능합니다.",
  illegal: "불법적인 내용에 대해서는 안내해 드릴 수 없습니다.",
  private_data: "타인의 개인정보는 제공해 드릴 수 없습니다.",
  abuse:
    "부적절한 표현이 포함되어 있습니다. 정중한 표현으로 다시 질문해 주세요.",
};

// ==================== 내부 서비스용 타입 ====================

// 메시지 역할
export type MessageRole = "user" | "assistant";

// 분류 결과 (메시지에 첨부)
export interface ClassificationInfo {
  isMulti: boolean;
  intents: IntentType[];
  confidence: ConfidenceLevel;
  scores?: Record<IntentType, number>;
  reason?: string;
}

// 채팅 메시지 (UI용)
export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  classification?: ClassificationInfo;
  blocked?: boolean;
  blockType?: GuardrailType;
  calculationResult?: RevenueCalculationResult;
  reverseCalculationResult?: ReverseCalculationResult; // Phase 2: 역산 결과
  generationTrendResult?: GenerationTrendResultData; // 발전량 추이 조회 결과
}

// 분류 결과 (Server Action 반환)
export interface ClassificationResult {
  success: boolean;
  blocked?: boolean;
  blockMessage?: string;
  blockType?: GuardrailType;
  isMulti?: boolean;
  intents?: IntentType[];
  confidence?: ConfidenceLevel;
  scores?: Record<IntentType, number>;
  reason?: string;
  error?: string;
}

// 가드레일 검사 결과
export interface GuardrailResult {
  blocked: boolean;
  type?: GuardrailType;
  message?: string;
}

// 강한 구문 매칭 결과
export interface PhraseMatchResult {
  matched: boolean;
  intent?: IntentType;
}

// 가중치 점수화 결과
export interface WeightScoreResult {
  scores: Record<IntentType, number>;
  topIntent: IntentType;
  confidence: ConfidenceLevel;
  candidates: IntentType[];
}

// LLM 분류 결과
export interface LLMClassificationResult {
  isMulti: boolean;
  intents: IntentType[];
  reason: string;
}

// ==================== 수익 계산기 타입 ====================

// 기간 타입 (Phase 1)
export type PeriodType = "daily" | "monthly" | "yearly";

export interface PeriodInfo {
  type: PeriodType;
  count: number; // 몇 일/월/년
}

// 계산 모드 (Phase 1) - 부분 계산 지원
export type CalculationMode = "full" | "smp_only" | "rec_only" | "rec_ratio";

// 계산기 서브 인텐트 (Phase 2) - 정방향/역방향 구분
export type CalculatorSubIntent = "FORWARD" | "REVERSE";

// 역산 목표 타입 (Phase 2)
export interface ReverseTarget {
  targetRevenue: number; // 목표 수익 (원)
  period: PeriodInfo; // 수익 기간 (연/월/일)
}

// 계산기 입력값
export interface CalculatorInput {
  rec_price: number;
  smp_price: number;
  capacity_kw: number;
  utilization_rate: number;
  rec_weight: number;
}

// 파라미터 추출 결과
export interface ExtractedParameters {
  rec_price?: number;
  smp_price?: number;
  capacity_kw?: number;
  utilization_rate?: number;
  rec_weight?: number;
  userInput?: string; // 원본 사용자 입력 (지역 판별용)
  period?: PeriodInfo; // 기간 정보 (Phase 1)
  calculationMode?: CalculationMode; // 계산 모드 (Phase 1)
  subIntent?: CalculatorSubIntent; // 서브 인텐트 (Phase 2)
  reverseTarget?: ReverseTarget; // 역산 목표 (Phase 2)
}

// 데이터 출처 정보
export interface DataSources {
  smp: SourceInfo;
  rec: SourceInfo;
}

export interface SourceInfo {
  type: "user" | "db" | "api" | "default";
  label: string; // UI 표시용 (예: "최근 7일 평균", "현물시장 최신가")
  date?: string; // 데이터 기준일 (YYYYMMDD 또는 YYYY-MM-DD)
}

// 폴백 적용된 파라미터 (계산 준비 완료)
export interface ResolvedCalculatorParams {
  capacityKw: number;
  smpPrice: number;
  recPrice: number;
  utilizationRate: number;
  recWeight: number;
  region: "육지" | "제주";
  sources: DataSources;
}

// 파라미터 해결 결과
export type ResolveResult =
  | { success: true; params: ResolvedCalculatorParams }
  | { success: false; question: string };

// 누락된 파라미터 결과
export interface MissingParamsResult {
  complete: false;
  missing: string[];
  extracted: ExtractedParameters;
  followUpQuestion: string;
}

// 완전한 파라미터 결과
export interface CompleteParamsResult {
  complete: true;
  params: CalculatorInput;
}

// 파라미터 추출 통합 결과
export type ParameterExtractionResult = MissingParamsResult | CompleteParamsResult;

// 수익 계산 결과
export interface RevenueCalculationResult {
  input: {
    rec_price: number;
    smp_price: number;
    capacity_kw: number;
    utilization_rate: number;
    rec_weight: number;
  };
  generation: {
    daily_kwh?: number; // 일간 발전량 (Phase 1)
    monthly_kwh: number;
    yearly_kwh: number;
    custom_kwh?: number; // 사용자 지정 기간 발전량 (Phase 1)
  };
  revenue: {
    daily?: { smp: number; rec: number; total: number }; // 일간 수익 (Phase 1)
    monthly: { smp: number; rec: number; total: number };
    yearly: { smp: number; rec: number; total: number };
    custom?: { smp: number; rec: number; total: number; periodLabel: string }; // 사용자 지정 기간 (Phase 1)
  };
  unit_price_per_kwh: number;
  disclaimer: string;
  region?: "육지" | "제주"; // 계산 기준 지역
  sources?: DataSources; // 데이터 출처 정보 (폴백 적용 시)
  calculationMode?: CalculationMode; // 계산 모드 (Phase 1)
  ratio?: { smp_percent: number; rec_percent: number }; // 수익 비중 (Phase 1)
}

// 역산 계산 결과 (Phase 2)
export interface ReverseCalculationResult {
  requiredCapacityKw: number; // 필요 용량 (kW)
  targetRevenue: number; // 목표 수익
  targetPeriod: PeriodInfo; // 목표 기간
  input: {
    rec_price: number;
    smp_price: number;
    utilization_rate: number;
    rec_weight: number;
  };
  disclaimer: string;
  region?: "육지" | "제주";
  sources?: DataSources;
}

// ==================== 발전량 추이 조회 타입 ====================

// 집계 유형
export type AggregationType = "hourly" | "daily" | "weekly" | "monthly" | "day_of_week";

// 데이터 유형 (실측/추정)
export type GenerationDataType = "actual" | "estimated";

// 표시 모드 (데이터 개수에 따라 결정)
export type DisplayMode = "text" | "list" | "chart";

// 출력 형식 (사용자 지정)
export type OutputFormat = "chart" | "table" | null;

// 발전량 추이 메타데이터
export interface GenerationTrendMetadata {
  region: string;
  season: string;
  year: number;
  month?: number | null;
  aggregations: AggregationType[];
  sql: string;
  explanation: string;
  dataType: GenerationDataType;
  disclaimer?: string;
  chartType?: 'bar' | 'line' | null;
  displayMode: DisplayMode; // 데이터 개수에 따른 표시 모드
  outputFormat?: OutputFormat; // 사용자 지정 출력 형식 (table/chart)
  showOnlyAverage?: boolean; // 평균만 표시 여부
}

// 발전량 추이 결과 데이터 (UI용)
export interface GenerationTrendResultData {
  results: Array<{
    data: Record<string, unknown>[];
    metadata: GenerationTrendMetadata;
  }>;
}

// ==================== API 요청/응답 타입 ====================

// 계산기 처리 결과 (Server Action 반환)
export interface CalculatorProcessResult {
  success: boolean;
  needsMoreInfo?: boolean;
  followUpQuestion?: string;
  extracted?: ExtractedParameters;
  result?: RevenueCalculationResult;
  error?: string;
}

// ==================== RAG (Knowledge Base) 타입 ====================

// RAG 인용 정보
export interface RAGCitation {
  text: string;
  sourceUri?: string;
}

// RAG 응답
export interface RAGResponse {
  success: boolean;
  answer?: string;
  citations?: RAGCitation[];
  error?: string;
}
