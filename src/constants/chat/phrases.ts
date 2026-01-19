import type { IntentType } from "@/lib/chat/types";

// 강한 구문 정의
// 이 구문이 포함되면 즉시 해당 시나리오로 확정 (신뢰도 HIGH)
export const STRONG_PHRASES: Record<
  Exclude<IntentType, "GENERAL">,
  string[]
> = {
  GENERATION_TREND: [
    "발전량 추이",
    "발전량 그래프",
    "발전량 현황",
    "출력 추이",
    "발전량 얼마",
    "발전량 비교",
  ],
  CALCULATOR: [
    "수익 계산",
    "수익 얼마",
    "rec 얼마",
    "smp 얼마",
    "rec 단가",
    "smp 단가",
    "rec 가격",
    "smp 가격",
  ],
  PROCEDURE: [
    "참여 방법",
    "참여 절차",
    "등록 방법",
    "등록 절차",
    "신청 방법",
    "신청 절차",
    "어떻게 참여",
    "어떻게 등록",
    "rec 발급",
  ],
};

/**
 * 모든 강한 구문을 의도와 매핑
 */
export function createPhraseMap(): Map<string, Exclude<IntentType, "GENERAL">> {
  const map = new Map<string, Exclude<IntentType, "GENERAL">>();

  for (const [intent, phrases] of Object.entries(STRONG_PHRASES)) {
    for (const phrase of phrases) {
      map.set(phrase, intent as Exclude<IntentType, "GENERAL">);
    }
  }

  return map;
}

// 전역 구문 맵 (캐싱)
export const PHRASE_MAP = createPhraseMap();

// 모든 강한 구문 목록 (검색용)
export const ALL_PHRASES = Object.values(STRONG_PHRASES).flat();
