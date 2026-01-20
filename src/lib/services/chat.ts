/**
 * 채팅 처리 통합 서비스
 * 의도 분류 → 핸들러 라우팅 → 응답 생성
 */

import type {
  ClassificationResult,
  RevenueCalculationResult,
  ReverseCalculationResult,
  GuardrailType,
  IntentType,
  ConfidenceLevel,
} from "@/lib/chat/types";
import { GUARDRAIL_MESSAGES } from "@/lib/chat/types";
import { classifyIntent } from "@/lib/chat/intent-classifier";
import { handleCalculatorIntent, type CalculatorHandlerResult } from "./calculator";

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
      console.error("ChatService 처리 오류:", error);
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

    // CALCULATOR 단독 의도
    if (isCalculatorOnly) {
      return this.handleCalculator(message, classification);
    }

    // 기타 의도 (GENERATION_TREND, PROCEDURE, GENERAL, 복합 의도)
    return this.handleOtherIntents(classification);
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
   * 기타 의도 처리 (추후 구현 예정)
   */
  private handleOtherIntents(
    classification: ClassificationResult
  ): ChatProcessResult {
    const intentNames = classification.intents?.join(", ") || "GENERAL";
    const isMultiText = classification.isMulti ? " (복합 의도)" : "";

    return {
      success: true,
      message:
        `질문이 [${intentNames}]${isMultiText}로 분류되었습니다.\n\n` +
        `${classification.reason ? `📝 ${classification.reason}` : ""}\n\n` +
        `(응답 생성 기능은 추후 구현 예정입니다)`,
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
