import type { ClassificationResult } from "./types";
import { checkGuardrail } from "./guardrail";
import { preprocess } from "./preprocessor";
import { matchPhrase } from "./phrase-matcher";
import { calculateWeightScore } from "./weight-scorer";
import { classifyWithLLM } from "./llm-classifier";

/**
 * 통합 의도 분류기
 * 파이프라인: 가드레일 → 전처리 → 강한 구문 매칭 → 가중치 점수화 → LLM 분류
 */
export async function classifyIntent(
  input: string
): Promise<ClassificationResult> {
  try {
    // Step 1: 가드레일 검사 (원본 입력 대상)
    const guardrailResult = checkGuardrail(input);
    if (guardrailResult.blocked) {
      return {
        success: true,
        blocked: true,
        blockMessage: guardrailResult.message,
        blockType: guardrailResult.type,
      };
    }

    // Step 2: 전처리
    const normalizedText = preprocess(input);

    // Step 3: 강한 구문 매칭
    const phraseResult = matchPhrase(normalizedText);
    if (phraseResult.matched && phraseResult.intent) {
      return {
        success: true,
        isMulti: false,
        intents: [phraseResult.intent],
        confidence: "HIGH",
        reason: "강한 구문 매칭",
      };
    }

    // Step 4: 가중치 점수화
    const weightResult = calculateWeightScore(normalizedText);

    // HIGH 신뢰도면 바로 반환
    if (weightResult.confidence === "HIGH") {
      return {
        success: true,
        isMulti: false,
        intents: [weightResult.topIntent],
        confidence: "HIGH",
        scores: weightResult.scores,
        reason: "가중치 점수화 (HIGH)",
      };
    }

    // Step 5: LLM 분류 (MEDIUM/LOW 신뢰도)
    try {
      const llmResult = await classifyWithLLM(
        normalizedText,
        input,
        weightResult.candidates
      );

      return {
        success: true,
        isMulti: llmResult.isMulti,
        intents: llmResult.intents,
        confidence: "HIGH", // LLM 결과는 HIGH로 취급
        scores: weightResult.scores,
        reason: llmResult.reason,
      };
    } catch {
      // LLM 실패 시 가중치 점수화의 candidates를 fallback으로 사용
      console.warn("LLM 분류 실패, fallback 사용");

      if (weightResult.candidates.length > 0) {
        return {
          success: true,
          isMulti: weightResult.candidates.length > 1,
          intents: weightResult.candidates,
          confidence: weightResult.confidence,
          scores: weightResult.scores,
          reason: "가중치 점수화 (LLM fallback)",
        };
      }

      // candidates도 없으면 GENERAL
      return {
        success: true,
        isMulti: false,
        intents: ["GENERAL"],
        confidence: "LOW",
        scores: weightResult.scores,
        reason: "기본값 (GENERAL)",
      };
    }
  } catch (error) {
    console.error("의도 분류 실패:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}
