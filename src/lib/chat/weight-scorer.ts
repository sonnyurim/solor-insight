import type { IntentType, ConfidenceLevel, WeightScoreResult } from "@/lib/chat/types";
import { KEYWORD_SCORE_MAP } from "@/constants/chat/keywords";
import { tokenize } from "./preprocessor";

// 점수 기반 신뢰도 판정 기준
const CONFIDENCE_THRESHOLDS = {
  HIGH_MIN_SCORE: 4, // 1등이 최소 4점 이상
  HIGH_MIN_GAP: 2, // 1등과 2등의 차이가 최소 2점 이상
  MEDIUM_MIN_SCORE: 3, // MEDIUM을 위한 최소 점수
};

/**
 * 가중치 점수화
 * 키워드 기반으로 각 시나리오의 점수를 계산
 */
export function calculateWeightScore(
  normalizedText: string
): WeightScoreResult {
  const tokens = tokenize(normalizedText);

  // 시나리오별 점수 초기화
  const scores: Record<IntentType, number> = {
    GENERATION_TREND: 0,
    CALCULATOR: 0,
    PROCEDURE: 0,
    GENERAL: 0,
  };

  // 토큰별 점수 계산
  for (const token of tokens) {
    const keywordInfo = KEYWORD_SCORE_MAP.get(token);
    if (keywordInfo) {
      for (const { intent, score } of keywordInfo) {
        scores[intent] += score;
      }
    }
  }

  // 점수 정렬 (GENERAL 제외)
  const sortedIntents = (Object.entries(scores) as [IntentType, number][])
    .filter(([intent]) => intent !== "GENERAL")
    .sort((a, b) => b[1] - a[1]);

  const topIntent = sortedIntents[0]?.[0] || "GENERAL";
  const topScore = sortedIntents[0]?.[1] || 0;
  const secondScore = sortedIntents[1]?.[1] || 0;

  // 신뢰도 판정
  let confidence: ConfidenceLevel;
  const candidates: IntentType[] = [];

  if (
    topScore >= CONFIDENCE_THRESHOLDS.HIGH_MIN_SCORE &&
    topScore - secondScore >= CONFIDENCE_THRESHOLDS.HIGH_MIN_GAP
  ) {
    // 1등 >= 4점 AND 차이 >= 2점 → HIGH
    confidence = "HIGH";
    candidates.push(topIntent);
  } else if (
    topScore >= CONFIDENCE_THRESHOLDS.MEDIUM_MIN_SCORE &&
    secondScore >= CONFIDENCE_THRESHOLDS.MEDIUM_MIN_SCORE &&
    topScore - secondScore < CONFIDENCE_THRESHOLDS.HIGH_MIN_GAP
  ) {
    // 1등, 2등 모두 >= 3점 AND 차이 < 2점 → MEDIUM (복합 후보)
    confidence = "MEDIUM";
    candidates.push(topIntent);
    if (sortedIntents[1]) {
      candidates.push(sortedIntents[1][0]);
    }
  } else {
    // 그 외 → LOW
    confidence = "LOW";
    // 점수가 있는 모든 의도를 후보로
    for (const [intent, score] of sortedIntents) {
      if (score > 0) {
        candidates.push(intent);
      }
    }
  }

  // 후보가 없으면 GENERAL 추가
  if (candidates.length === 0) {
    candidates.push("GENERAL");
  }

  return {
    scores,
    topIntent: topScore > 0 ? topIntent : "GENERAL",
    confidence,
    candidates,
  };
}
