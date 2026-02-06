"use client";

import { useCallback } from "react";
import {
  useChatContext,
  createUserMessage,
  createBotMessage,
} from "@/contexts/chat-context";
import { processMessageApi, type ChatHistoryMessage } from "@/lib/chat/actions";
import type { ChatProcessResult } from "@/lib/services/chat";
import type { Message } from "@/lib/chat/types";

/**
 * Chat 훅 반환 타입
 */
interface UseChatReturn {
  // 상태
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  // 액션
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
}

/**
 * Chat 훅
 *
 * Context 상태와 Server Action을 조합하여 채팅 기능을 제공합니다.
 * SRP: UI 로직(메시지 생성, 상태 업데이트)만 담당
 * 비즈니스 로직은 Server Action(ChatService)으로 위임
 *
 * @example
 * const { messages, isLoading, sendMessage } = useChat();
 */
export function useChat(): UseChatReturn {
  const { state, dispatch } = useChatContext();

  /**
   * 메시지 전송
   * 1. 사용자 메시지 추가
   * 2. Server Action 호출 (최근 대화 기록 포함)
   * 3. 응답에 따른 봇 메시지 생성
   */
  const sendMessage = useCallback(
    async (content: string) => {
      // 에러 초기화
      dispatch({ type: "SET_ERROR", payload: null });

      // 최근 6개 메시지 추출 (3턴) - 현재 메시지 추가 전 상태
      const recentHistory: ChatHistoryMessage[] = state.messages
        .slice(-6)
        .map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.content,
        }));

      // 1. 사용자 메시지 추가
      const userMessage = createUserMessage(content);
      dispatch({ type: "ADD_MESSAGE", payload: userMessage });
      dispatch({ type: "SET_LOADING", payload: true });

      try {
        // 2. Server Action 호출 (대화 기록 포함)
        const result = await processMessageApi(content, recentHistory);

        // 3. 결과에 따른 봇 메시지 생성
        const botMessage = createBotMessageFromResult(result);
        dispatch({ type: "ADD_MESSAGE", payload: botMessage });

        // 에러가 있으면 설정
        if (!result.success && result.error) {
          dispatch({ type: "SET_ERROR", payload: result.error });
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "알 수 없는 오류가 발생했습니다.";
        dispatch({ type: "SET_ERROR", payload: errorMessage });

        // 에러 메시지 추가
        const errorBotMessage = createBotMessage(
          "죄송합니다. 처리 중 오류가 발생했습니다.",
        );
        dispatch({ type: "ADD_MESSAGE", payload: errorBotMessage });
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    },
    [dispatch, state.messages],
  );

  /**
   * 모든 메시지 초기화
   */
  const clearMessages = useCallback(() => {
    dispatch({ type: "CLEAR_ALL" });
  }, [dispatch]);

  return {
    messages: state.messages,
    isLoading: state.isLoading,
    error: state.error,
    sendMessage,
    clearMessages,
  };
}

// ==================== 헬퍼 함수 ====================

/**
 * 서비스 결과로부터 봇 메시지 생성
 */
function createBotMessageFromResult(result: ChatProcessResult): Message {
  // 에러
  if (!result.success) {
    return createBotMessage("죄송합니다. 처리 중 오류가 발생했습니다.");
  }

  // 차단됨
  if (result.blocked) {
    return createBotMessage(
      result.blockMessage || "요청을 처리할 수 없습니다.",
      {
        blocked: true,
        blockType: result.blockType,
      },
    );
  }

  // 추가 정보 필요
  if (result.needsMoreInfo) {
    return createBotMessage(
      result.followUpQuestion || "추가 정보가 필요합니다.",
      {
        classification: result.classification,
      },
    );
  }

  // 역산 결과 (Phase 2)
  if (result.reverseCalculationResult) {
    return createBotMessage(result.message || "필요 용량을 계산했습니다.", {
      classification: result.classification,
      reverseCalculationResult: result.reverseCalculationResult,
    });
  }

  // 정방향 계산 결과
  if (result.calculationResult) {
    return createBotMessage(result.message || "예상 수익을 계산했습니다.", {
      classification: result.classification,
      calculationResult: result.calculationResult,
    });
  }

  // 발전량 추이 조회 결과
  if (result.generationTrendResult) {
    return createBotMessage(result.message || "발전량 추이를 조회했습니다.", {
      classification: result.classification,
      generationTrendResult: result.generationTrendResult,
    });
  }

  // 일반 응답
  return createBotMessage(result.message || "응답을 생성했습니다.", {
    classification: result.classification,
    citations: result.citations,
  });
}
