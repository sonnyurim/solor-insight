import type { IntentType } from "@/lib/chat/types";

// 키워드 점수
export const KEYWORD_SCORES = {
  CORE: 3, // 핵심 키워드
  SUPPORT: 1, // 보조 키워드
} as const;

// 시나리오별 키워드 정의
export interface KeywordDefinition {
  core: string[]; // 핵심 키워드 (3점)
  support: string[]; // 보조 키워드 (1점)
}

export const INTENT_KEYWORDS: Record<
  Exclude<IntentType, "GENERAL">,
  KeywordDefinition
> = {
  GENERATION_TREND: {
    core: ["발전량", "출력"],
    support: ["추이", "그래프", "현황", "변화", "월별", "연도별", "비교"],
  },
  CALCULATOR: {
    core: ["수익", "계산", "rec", "smp"],
    support: ["얼마", "단가", "가격", "kw", "mw", "용량"],
  },
  PROCEDURE: {
    core: ["절차", "방법", "등록", "신청", "참여"],
    support: ["서류", "기간", "필요", "어떻게", "과정"],
  },
};

/**
 * 모든 키워드를 의도별로 점수와 함께 가져오기
 */
export function getKeywordScoreMap(): Map<
  string,
  { intent: Exclude<IntentType, "GENERAL">; score: number }[]
> {
  const map = new Map<
    string,
    { intent: Exclude<IntentType, "GENERAL">; score: number }[]
  >();

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    const intentType = intent as Exclude<IntentType, "GENERAL">;

    // 핵심 키워드 추가
    for (const keyword of keywords.core) {
      const existing = map.get(keyword) || [];
      existing.push({ intent: intentType, score: KEYWORD_SCORES.CORE });
      map.set(keyword, existing);
    }

    // 보조 키워드 추가
    for (const keyword of keywords.support) {
      const existing = map.get(keyword) || [];
      existing.push({ intent: intentType, score: KEYWORD_SCORES.SUPPORT });
      map.set(keyword, existing);
    }
  }

  return map;
}

// 전역 키워드 점수 맵 (캐싱)
export const KEYWORD_SCORE_MAP = getKeywordScoreMap();
