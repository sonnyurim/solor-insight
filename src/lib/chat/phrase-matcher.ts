import type { IntentType, PhraseMatchResult } from "@/lib/chat/types";
import { PHRASE_MAP, ALL_PHRASES } from "@/constants/chat/phrases";

/**
 * 강한 구문 매칭
 * 정규화된 텍스트에서 확실한 패턴을 빠르게 처리
 * 매칭 시 즉시 해당 시나리오 확정 (신뢰도 HIGH)
 */
export function matchPhrase(normalizedText: string): PhraseMatchResult {
  // 모든 강한 구문을 순회하며 포함 여부 확인
  for (const phrase of ALL_PHRASES) {
    if (normalizedText.includes(phrase)) {
      const intent = PHRASE_MAP.get(phrase);
      if (intent) {
        return {
          matched: true,
          intent: intent as IntentType,
        };
      }
    }
  }

  return { matched: false };
}
