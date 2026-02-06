"use server";

/**
 * 채팅 Server Actions
 * 클라이언트에서 호출하는 서버 측 함수들
 * SRP: 요청 검증 + 서비스 위임 + 응답 반환만 담당
 */

import { chatService, type ChatProcessResult } from "@/lib/services/chat";
import { ChatInputSchema } from "@/lib/validations/chat";

/**
 * 대화 기록 메시지 타입 (간소화)
 */
export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * 메시지 처리 통합 Server Action
 * 의도 분류부터 응답 생성까지 전체 흐름을 처리
 *
 * @param message - 사용자 메시지
 * @param history - 최근 대화 기록 (최대 6개, 3턴)
 * @returns 처리 결과
 */
export async function processMessageApi(
  message: string,
  history?: ChatHistoryMessage[],
): Promise<ChatProcessResult> {
  try {
    // 입력값 검증
    const validation = ChatInputSchema.safeParse({ message });
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return {
        success: false,
        error: firstError?.message || "입력값이 유효하지 않습니다.",
      };
    }

    // ChatService에 위임 (대화 기록 포함)
    return await chatService.processMessage(validation.data.message, history);
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "서버 오류가 발생했습니다.",
    };
  }
}
