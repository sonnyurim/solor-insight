"use client";

import { useChat } from "@/hooks/use-chat";
import { MessageList } from "@/components/chat/MessageList";
import { ChatInput } from "@/components/chat/ChatInput";
import { DebugPanel } from "@/components/chat/DebugPanel";

export function ChatContainer() {
  const { messages, isLoading, error, lastResult, sendMessage, clearMessages } =
    useChat();

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-zinc-900">
      {/* 헤더 */}
      <header className="flex-shrink-0 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Solar Insight
              </h1>
              <p className="text-xs text-zinc-500">태양광 발전 정보 챗봇</p>
            </div>
          </div>
          <button
            onClick={clearMessages}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
          >
            대화 초기화
          </button>
        </div>
      </header>

      {/* 에러 표시 */}
      {error && (
        <div className="flex-shrink-0 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 px-4 py-3">
          <p className="text-sm text-red-600 dark:text-red-300 text-center">
            {error}
          </p>
        </div>
      )}

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-hidden max-w-4xl mx-auto w-full">
        <MessageList messages={messages} isLoading={isLoading} />
      </div>

      {/* 입력 영역 */}
      <ChatInput onSend={sendMessage} disabled={isLoading} />

      {/* 디버그 패널 (개발 모드) */}
      <DebugPanel lastResult={lastResult} />
    </div>
  );
}
