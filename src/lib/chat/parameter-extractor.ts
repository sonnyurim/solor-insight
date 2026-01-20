import type {
  ExtractedParameters,
  ParameterExtractionResult,
  PeriodInfo,
  CalculationMode,
  CalculatorSubIntent,
  ReverseTarget,
} from "./types";
import {
  DEFAULT_UTILIZATION_RATE,
  DEFAULT_REC_WEIGHT,
  REQUIRED_PARAMS,
  PARAM_LABELS,
} from "@/constants/chat/calculator";
import { REVERSE_KEYWORDS } from "@/constants/chat/keywords";
import { REVERSE_PHRASES } from "@/constants/chat/phrases";

/**
 * 숫자 추출 (만원 단위 변환 포함)
 * "4만원" → 40000, "4만" → 40000, "40000원" → 40000
 */
function extractNumberWithUnit(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);
  if (!match) return null;

  const numStr = match[1];
  const unit = match[2]?.toLowerCase() || "";

  let value = parseFloat(numStr.replace(/,/g, ""));
  if (isNaN(value)) return null;

  // 만원 단위 변환
  if (unit.includes("만")) {
    value *= 10000;
  }

  return value;
}

/**
 * REC 단가 추출
 * "REC 4만원", "rec 40000원", "REC단가 4만"
 */
function extractRecPrice(text: string): number | null {
  // "REC 4만원", "rec 4만", "REC단가 40000원"
  const patterns = [
    /rec\s*(?:단가)?\s*([\d,.]+)\s*(만원?|원)?/i,
    /렉\s*(?:단가)?\s*([\d,.]+)\s*(만원?|원)?/i,
  ];

  for (const pattern of patterns) {
    const result = extractNumberWithUnit(text, pattern);
    if (result !== null) return result;
  }

  return null;
}

/**
 * SMP 단가 추출
 * "SMP 110원", "smp단가 110"
 */
function extractSmpPrice(text: string): number | null {
  const patterns = [
    /smp\s*(?:단가)?\s*([\d,.]+)\s*(원)?/i,
    /에스엠피\s*(?:단가)?\s*([\d,.]+)\s*(원)?/i,
  ];

  for (const pattern of patterns) {
    const result = extractNumberWithUnit(text, pattern);
    if (result !== null) return result;
  }

  return null;
}

/**
 * 설비용량 추출
 * "100kW", "1MW", "100킬로와트"
 */
function extractCapacity(text: string): number | null {
  const patterns = [
    // kW 단위
    /(\d+(?:,\d+)?(?:\.\d+)?)\s*(?:kw|킬로와트)/i,
    // MW 단위 (1000배)
    /(\d+(?:,\d+)?(?:\.\d+)?)\s*(?:mw|메가와트)/i,
  ];

  // kW 패턴
  const kwMatch = text.match(patterns[0]);
  if (kwMatch) {
    return parseFloat(kwMatch[1].replace(/,/g, ""));
  }

  // MW 패턴 (1000배 변환)
  const mwMatch = text.match(patterns[1]);
  if (mwMatch) {
    return parseFloat(mwMatch[1].replace(/,/g, "")) * 1000;
  }

  // "용량 100" 같은 패턴 (단위 없음, kW로 가정)
  const capacityMatch = text.match(/용량\s*(\d+(?:,\d+)?(?:\.\d+)?)/i);
  if (capacityMatch) {
    return parseFloat(capacityMatch[1].replace(/,/g, ""));
  }

  return null;
}

/**
 * 이용률 추출
 * "이용률 15%", "이용률 0.15"
 */
function extractUtilizationRate(text: string): number | null {
  const patterns = [
    /이용률\s*(\d+(?:\.\d+)?)\s*%/i,
    /이용률\s*(\d+(?:\.\d+)?)/i,
  ];

  // 퍼센트 패턴
  const percentMatch = text.match(patterns[0]);
  if (percentMatch) {
    return parseFloat(percentMatch[1]) / 100;
  }

  // 소수점 패턴
  const decimalMatch = text.match(patterns[1]);
  if (decimalMatch) {
    const value = parseFloat(decimalMatch[1]);
    // 1보다 크면 퍼센트로 간주
    return value > 1 ? value / 100 : value;
  }

  return null;
}

/**
 * REC 가중치 추출
 * "가중치 1.2", "REC가중치 1.0"
 */
function extractRecWeight(text: string): number | null {
  const patterns = [
    /(?:rec\s*)?가중치\s*(\d+(?:\.\d+)?)/i,
    /가중\s*(\d+(?:\.\d+)?)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseFloat(match[1]);
    }
  }

  return null;
}

/**
 * 기간 정보 추출 (Phase 1)
 * "월 수익" → { type: 'monthly', count: 1 }
 * "하루 매출" → { type: 'daily', count: 1 }
 * "20년 총 수익" → { type: 'yearly', count: 20 }
 * "10년간" → { type: 'yearly', count: 10 }
 */
export function extractPeriod(text: string): PeriodInfo | null {
  const normalizedText = text.toLowerCase();

  // N년 패턴: "20년", "10년간", "5년 동안"
  const yearPatterns = [
    /(\d+)\s*년\s*(?:간|동안|총)?/,
    /(\d+)\s*(?:개)?년/,
  ];
  for (const pattern of yearPatterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      return { type: "yearly", count: parseInt(match[1], 10) };
    }
  }

  // N개월 패턴: "3개월", "6개월간"
  const monthPatterns = [
    /(\d+)\s*개월\s*(?:간|동안)?/,
  ];
  for (const pattern of monthPatterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      return { type: "monthly", count: parseInt(match[1], 10) };
    }
  }

  // N일 패턴: "30일", "7일간"
  const dayPatterns = [
    /(\d+)\s*일\s*(?:간|동안)?/,
  ];
  for (const pattern of dayPatterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      return { type: "daily", count: parseInt(match[1], 10) };
    }
  }

  // 단순 키워드 패턴
  if (/하루|일간|일일|매일/.test(normalizedText)) {
    return { type: "daily", count: 1 };
  }
  if (/월간|한달|월\s*수익|월\s*매출/.test(normalizedText)) {
    return { type: "monthly", count: 1 };
  }
  if (/연간|연\s*수익|연\s*매출|1년/.test(normalizedText)) {
    return { type: "yearly", count: 1 };
  }

  return null;
}

/**
 * 계산 모드 추출 (Phase 1)
 * "SMP 수익만" → 'smp_only'
 * "REC 수익만" → 'rec_only'
 * "REC 비중" → 'rec_ratio'
 */
export function extractCalculationMode(text: string): CalculationMode {
  const normalizedText = text.toLowerCase();

  // SMP만 계산
  if (/smp\s*(?:수익|매출)?\s*만|smp만/.test(normalizedText)) {
    return "smp_only";
  }

  // REC만 계산
  if (/rec\s*(?:수익|매출)?\s*만|rec만|렉\s*(?:수익|매출)?\s*만/.test(normalizedText)) {
    return "rec_only";
  }

  // REC 비중 계산
  if (/rec\s*비중|렉\s*비중|비율|비중/.test(normalizedText)) {
    return "rec_ratio";
  }

  return "full";
}

// ==================== Phase 2: 역산형 추출 ====================

/**
 * 역산형 감지 (Phase 2)
 * "연 3천만원 벌려면" → REVERSE
 * "100kW 수익 계산해줘" → FORWARD
 */
export function detectSubIntent(text: string): CalculatorSubIntent {
  const normalizedText = text.toLowerCase();

  // 강한 구문 매칭
  for (const phrase of REVERSE_PHRASES) {
    if (normalizedText.includes(phrase)) {
      return "REVERSE";
    }
  }

  // 키워드 매칭
  for (const keyword of REVERSE_KEYWORDS) {
    if (normalizedText.includes(keyword)) {
      return "REVERSE";
    }
  }

  return "FORWARD";
}

/**
 * 목표 수익 추출 (Phase 2)
 * "연 3천만원 벌려면" → { targetRevenue: 30000000, period: { type: 'yearly', count: 1 } }
 * "월 500만원 목표" → { targetRevenue: 5000000, period: { type: 'monthly', count: 1 } }
 */
export function extractTargetRevenue(text: string): ReverseTarget | null {
  const normalizedText = text.toLowerCase();

  // 패턴: "연 3천만원", "연간 3000만원", "1년에 3천만원"
  const yearlyPatterns = [
    /(?:연간?|1년(?:에)?|매년)\s*([\d,]+)\s*(천만원?|만원?|백만원?|억원?)?/i,
    /([\d,]+)\s*(천만원?|만원?|백만원?|억원?)\s*(?:연간?|\/년|1년)/i,
  ];

  // 패턴: "월 500만원", "월간 500만원", "한달에 500만원"
  const monthlyPatterns = [
    /(?:월간?|한달(?:에)?|매월)\s*([\d,]+)\s*(천만원?|만원?|백만원?|억원?)?/i,
    /([\d,]+)\s*(천만원?|만원?|백만원?|억원?)\s*(?:월간?|\/월|한달)/i,
  ];

  // 연간 패턴 매칭
  for (const pattern of yearlyPatterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      const revenue = parseRevenueAmount(match[1], match[2]);
      if (revenue !== null) {
        return {
          targetRevenue: revenue,
          period: { type: "yearly", count: 1 },
        };
      }
    }
  }

  // 월간 패턴 매칭
  for (const pattern of monthlyPatterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      const revenue = parseRevenueAmount(match[1], match[2]);
      if (revenue !== null) {
        return {
          targetRevenue: revenue,
          period: { type: "monthly", count: 1 },
        };
      }
    }
  }

  return null;
}

/**
 * 금액 파싱 헬퍼 (천만원, 만원, 백만원, 억원 단위 처리)
 * "3천만" → 30000000
 * "500만" → 5000000
 * "1억" → 100000000
 */
function parseRevenueAmount(numStr: string, unitStr?: string): number | null {
  const num = parseFloat(numStr.replace(/,/g, ""));
  if (isNaN(num)) return null;

  const unit = unitStr?.toLowerCase() || "";

  if (unit.includes("억")) {
    return num * 100000000;
  }
  if (unit.includes("천만")) {
    return num * 10000000;
  }
  if (unit.includes("백만")) {
    return num * 1000000;
  }
  if (unit.includes("만")) {
    return num * 10000;
  }

  // 단위 없으면 원 그대로
  return num;
}

/**
 * 텍스트에서 모든 파라미터 추출
 */
export function extractParameters(text: string): ExtractedParameters {
  const normalizedText = text.toLowerCase();

  // 서브 인텐트 감지 (Phase 2)
  const subIntent = detectSubIntent(normalizedText);

  // 역산형이면 목표 수익 추출
  const reverseTarget =
    subIntent === "REVERSE" ? extractTargetRevenue(normalizedText) : undefined;

  return {
    rec_price: extractRecPrice(normalizedText) ?? undefined,
    smp_price: extractSmpPrice(normalizedText) ?? undefined,
    capacity_kw: extractCapacity(normalizedText) ?? undefined,
    utilization_rate: extractUtilizationRate(normalizedText) ?? undefined,
    rec_weight: extractRecWeight(normalizedText) ?? undefined,
    period: extractPeriod(normalizedText) ?? undefined,
    calculationMode: extractCalculationMode(normalizedText),
    subIntent,
    reverseTarget: reverseTarget ?? undefined,
  };
}

/**
 * 누락된 필수 파라미터 확인
 */
function getMissingParams(extracted: ExtractedParameters): string[] {
  const missing: string[] = [];

  for (const param of REQUIRED_PARAMS) {
    if (extracted[param] === undefined) {
      missing.push(param);
    }
  }

  return missing;
}

/**
 * 추가 질문 메시지 생성
 */
function generateFollowUpQuestion(missing: string[]): string {
  const missingLabels = missing.map((p) => PARAM_LABELS[p] || p);

  // 설비용량만 누락된 경우 (일반적인 케이스)
  if (missing.length === 1 && missing[0] === "capacity_kw") {
    return (
      "설비 용량을 알려주세요!\n\n" +
      "📌 필수: 설비 용량 (예: 100kW)\n" +
      "📌 선택: REC 단가, SMP 단가, 지역(제주/육지)\n\n" +
      "▶ 예시\n" +
      "• \"100kW 수익 계산해줘\" → 육지 기준, 최신 시세로 계산\n" +
      "• \"100kW 제주 계산해줘\" → 제주 기준, 최신 시세로 계산\n" +
      "• \"REC 4만원, SMP 110원으로 100kW 계산해줘\" → 입력한 단가로 계산"
    );
  }

  if (missing.length === 1) {
    return `수익 계산을 위해 ${missingLabels[0]}을(를) 알려주세요.`;
  }

  const lastLabel = missingLabels.pop();
  return `수익 계산을 위해 ${missingLabels.join(", ")}과(와) ${lastLabel}을(를) 알려주세요.`;
}

/**
 * 파라미터 추출 및 완전성 검사
 */
export function extractAndValidateParameters(
  text: string
): ParameterExtractionResult {
  const extracted = extractParameters(text);
  const missing = getMissingParams(extracted);

  if (missing.length > 0) {
    return {
      complete: false,
      missing,
      extracted,
      followUpQuestion: generateFollowUpQuestion(missing),
    };
  }

  // 모든 필수값이 있으면 기본값 적용
  return {
    complete: true,
    params: {
      rec_price: extracted.rec_price!,
      smp_price: extracted.smp_price!,
      capacity_kw: extracted.capacity_kw!,
      utilization_rate: extracted.utilization_rate ?? DEFAULT_UTILIZATION_RATE,
      rec_weight: extracted.rec_weight ?? DEFAULT_REC_WEIGHT,
    },
  };
}
