import type {
  ExtractedParameters,
  ParameterExtractionResult,
} from "./types";
import {
  DEFAULT_UTILIZATION_RATE,
  DEFAULT_REC_WEIGHT,
  REQUIRED_PARAMS,
  PARAM_LABELS,
} from "@/constants/chat/calculator";

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
 * 텍스트에서 모든 파라미터 추출
 */
export function extractParameters(text: string): ExtractedParameters {
  const normalizedText = text.toLowerCase();

  return {
    rec_price: extractRecPrice(normalizedText) ?? undefined,
    smp_price: extractSmpPrice(normalizedText) ?? undefined,
    capacity_kw: extractCapacity(normalizedText) ?? undefined,
    utilization_rate: extractUtilizationRate(normalizedText) ?? undefined,
    rec_weight: extractRecWeight(normalizedText) ?? undefined,
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
