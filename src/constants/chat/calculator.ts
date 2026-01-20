// 수익 계산기 상수

// 기본값
export const DEFAULT_UTILIZATION_RATE = 0.15; // 기본 이용률 15%
export const DEFAULT_REC_WEIGHT = 1.2; // 기본 REC 가중치

// 폴백용 기본값
export const DEFAULT_SMP = 110; // 원/kWh (DB 조회 실패 시)
export const DEFAULT_REC = 70000; // 원/REC (API 조회 실패 시)

// 가중치 자동 판단 기준
export const REC_WEIGHT_THRESHOLD_KW = 100; // 기준 용량 (kW)
export const DEFAULT_REC_WEIGHT_SMALL = 1.2; // 100kW 미만
export const DEFAULT_REC_WEIGHT_LARGE = 1.0; // 100kW 이상

// 시간 상수
export const HOURS_PER_DAY = 24; // 일 시간
export const DAYS_PER_YEAR = 365; // 연 일수
export const MONTHS_PER_YEAR = 12; // 연 월수

// REC 상수
export const KWH_PER_REC = 1000; // REC 1개당 kWh

// 검증 범위
export const VALIDATION_RANGES = {
  utilization_rate: { min: 0, max: 1 }, // 이용률 0~100%
  rec_weight: { min: 0.5, max: 2.0 }, // REC 가중치 범위
  capacity_kw: { min: 1, max: 1000000 }, // 용량 1kW ~ 1GW
  rec_price: { min: 1, max: 1000000 }, // REC 단가 1원 ~ 100만원
  smp_price: { min: 1, max: 1000 }, // SMP 단가 1원 ~ 1000원/kWh
} as const;

// 고정 면책 조항
export const DISCLAIMER =
  "⚠️ 단순 참고용 계산이며 실제 수익을 보장하지 않습니다 (VAT 별도)";

// 필수 파라미터 목록 (폴백 로직 적용 - 용량만 필수)
export const REQUIRED_PARAMS = ["capacity_kw"] as const;

// 기존 필수 파라미터 목록 (폴백 미적용 시)
export const REQUIRED_PARAMS_LEGACY = [
  "rec_price",
  "smp_price",
  "capacity_kw",
] as const;

// 파라미터 한글 이름 매핑
export const PARAM_LABELS: Record<string, string> = {
  rec_price: "REC 단가",
  smp_price: "SMP 단가",
  capacity_kw: "설비용량",
  utilization_rate: "이용률",
  rec_weight: "REC 가중치",
};
