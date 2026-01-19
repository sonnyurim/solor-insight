"use client";

import { useChatContext } from "@/contexts/chat-context";

/**
 * Chat 훅
 *
 * ChatContext를 래핑하여 채팅 기능을 제공합니다.
 * ChatProvider 내부에서만 사용 가능합니다.
 *
 * @example
 * const { messages, isLoading, sendMessage } = useChat();
 */
export function useChat() {
  return useChatContext();
}
