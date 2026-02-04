/**
 * 채팅 처리 통합 서비스
 * 의도 분류 → 핸들러 라우팅 → 응답 생성
 */

import type {
  ClassificationResult,
  RevenueCalculationResult,
  ReverseCalculationResult,
  GenerationTrendResultData,
  GuardrailType,
  IntentType,
  ConfidenceLevel,
} from "@/lib/chat/types";
import { GUARDRAIL_MESSAGES } from "@/lib/chat/types";
import { classifyIntent } from "@/lib/chat/intent-classifier";
import { handleCalculatorIntent, type CalculatorHandlerResult } from "./calculator";
import { handleGenerationTrend } from "./generation-trend";
import { queryKnowledgeBase } from "./knowledge-base";

// ==================== 타입 정의 ====================

/**
 * 채팅 처리 결과
 */
export interface ChatProcessResult {
  success: boolean;
  // 차단된 경우
  blocked?: boolean;
  blockMessage?: string;
  blockType?: GuardrailType;
  // 일반 응답
  message?: string;
  // 계산 결과
  calculationResult?: RevenueCalculationResult;
  // 역산 결과 (Phase 2)
  reverseCalculationResult?: ReverseCalculationResult;
  // 발전량 추이 조회 결과
  generationTrendResult?: GenerationTrendResultData;
  // 추가 정보 필요
  needsMoreInfo?: boolean;
  followUpQuestion?: string;
  // 분류 정보
  classification?: {
    isMulti: boolean;
    intents: IntentType[];
    confidence: ConfidenceLevel;
    reason?: string;
  };
  // 에러
  error?: string;
}

// ==================== 인터페이스 정의 (DIP) ====================

/**
 * 채팅 서비스 인터페이스
 */
export interface IChatService {
  processMessage(message: string): Promise<ChatProcessResult>;
}

// ==================== 서비스 구현 ====================

/**
 * 채팅 서비스 구현체
 * 의도 분류 결과에 따라 적절한 핸들러로 라우팅
 */
export class ChatService implements IChatService {
  /**
   * 메시지 처리 메인 진입점
   */
  async processMessage(message: string): Promise<ChatProcessResult> {
    try {
      // 1. 의도 분류
      const classificationResult = await classifyIntent(message);

      // 2. 분류 실패
      if (!classificationResult.success) {
        return {
          success: false,
          error: classificationResult.error || "분류 실패",
        };
      }

      // 3. 차단된 경우
      if (classificationResult.blocked) {
        return {
          success: true,
          blocked: true,
          blockMessage:
            classificationResult.blockMessage ||
            GUARDRAIL_MESSAGES[classificationResult.blockType!],
          blockType: classificationResult.blockType,
        };
      }

      // 4. 의도에 따른 처리
      return this.routeByIntent(message, classificationResult);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "처리 중 오류 발생",
      };
    }
  }

  /**
   * 의도에 따른 핸들러 라우팅
   */
  private async routeByIntent(
    message: string,
    classification: ClassificationResult
  ): Promise<ChatProcessResult> {
    const intents = classification.intents || ["GENERAL"];
    const isCalculatorOnly =
      intents.includes("CALCULATOR") && intents.length === 1;
    const isGenerationTrendOnly =
      intents.includes("GENERATION_TREND") && intents.length === 1;

    // CALCULATOR 단독 의도
    if (isCalculatorOnly) {
      return this.handleCalculator(message, classification);
    }

    // GENERATION_TREND 단독 의도
    if (isGenerationTrendOnly) {
      return this.handleGenerationTrendIntent(message, classification);
    }

    // 기타 의도 (PROCEDURE, GENERAL, 복합 의도)
    return this.handleOtherIntents(message, classification);
  }

  /**
   * CALCULATOR 의도 처리
   */
  private async handleCalculator(
    message: string,
    classification: ClassificationResult
  ): Promise<ChatProcessResult> {
    const calcResult: CalculatorHandlerResult =
      await handleCalculatorIntent(message);

    // 추가 정보 필요
    if (calcResult.type === "question") {
      return {
        success: true,
        needsMoreInfo: true,
        followUpQuestion: calcResult.message,
        classification: {
          isMulti: false,
          intents: ["CALCULATOR"],
          confidence: classification.confidence || "HIGH",
          reason: "필수 파라미터 누락",
        },
      };
    }

    // 역산 결과 (Phase 2)
    if (calcResult.type === "reverse_result") {
      return {
        success: true,
        message: "필요 용량을 계산했습니다.",
        reverseCalculationResult: calcResult.reverseData,
        classification: {
          isMulti: false,
          intents: ["CALCULATOR"],
          confidence: classification.confidence || "HIGH",
          reason: "역산 계산 (목표 수익 → 필요 용량)",
        },
      };
    }

    // 정방향 계산 완료
    return {
      success: true,
      message: "예상 수익을 계산했습니다.",
      calculationResult: calcResult.data,
      classification: {
        isMulti: false,
        intents: ["CALCULATOR"],
        confidence: classification.confidence || "HIGH",
        reason: classification.reason,
      },
    };
  }

  /**
   * GENERATION_TREND 의도 처리
   */
  private async handleGenerationTrendIntent(
    message: string,
    classification: ClassificationResult
  ): Promise<ChatProcessResult> {
    const result = await handleGenerationTrend(message);

    // 에러 발생 시 (지역 누락 등)
    if (!result.success) {
      return {
        success: true, // 시스템은 정상 동작
        needsMoreInfo: true,
        followUpQuestion: result.error,
        classification: {
          isMulti: false,
          intents: ["GENERATION_TREND"],
          confidence: classification.confidence || "HIGH",
          reason: "필수 정보 누락",
        },
      };
    }

    // 성공
    const firstResult = result.results![0];
    return {
      success: true,
      message: `${firstResult.metadata.region} ${firstResult.metadata.season}철 발전량 추이입니다.`,
      generationTrendResult: {
        results: result.results!,
      },
      classification: {
        isMulti: false,
        intents: ["GENERATION_TREND"],
        confidence: classification.confidence || "HIGH",
        reason: firstResult.metadata.explanation,
      },
    };
  }

  /**
   * 기타 의도 처리 (PROCEDURE, GENERAL, 복합 의도)
   * Knowledge Base RAG를 통해 응답 생성
   */
  private async handleOtherIntents(
    message: string,
    classification: ClassificationResult
  ): Promise<ChatProcessResult> {
    // Knowledge Base에 질의
    const ragResponse = await queryKnowledgeBase(message);

    // RAG 실패 시 폴백 응답
    if (!ragResponse.success) {
      return this.createFallbackResponse(classification);
    }

    return {
      success: true,
      message: ragResponse.answer,
      classification: {
        isMulti: classification.isMulti || false,
        intents: classification.intents || ["GENERAL"],
        confidence: classification.confidence || "MEDIUM",
        reason: classification.reason,
      },
    };
  }

  /**
   * RAG 실패 시 폴백 응답 생성
   */
  private createFallbackResponse(
    classification: ClassificationResult
  ): ChatProcessResult {
    const intentNames = classification.intents?.join(", ") || "GENERAL";

    return {
      success: true,
      message:
        `죄송합니다. 현재 해당 질문에 대한 답변을 제공하기 어렵습니다.\n\n` +
        `질문이 [${intentNames}]으로 분류되었으나, 관련 정보를 찾지 못했습니다.\n\n` +
        `다른 방식으로 질문해 주시거나, 태양광 발전 수익 계산이나 발전량 추이에 대해 문의해 주세요.`,
      classification: {
        isMulti: classification.isMulti || false,
        intents: classification.intents || ["GENERAL"],
        confidence: classification.confidence || "LOW",
        reason: classification.reason,
      },
    };
  }
}

// ==================== 기본 인스턴스 ====================

export const chatService = new ChatService();
