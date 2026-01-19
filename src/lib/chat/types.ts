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
}

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
    monthly_kwh: number;
    yearly_kwh: number;
  };
  revenue: {
    monthly: { smp: number; rec: number; total: number };
    yearly: { smp: number; rec: number; total: number };
  };
  unit_price_per_kwh: number;
  disclaimer: string;
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
