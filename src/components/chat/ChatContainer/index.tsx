"use client";

import { useChat } from "@/hooks/use-chat";
import { MessageList } from "@/components/chat/MessageList";
import { ChatInput } from "@/components/chat/ChatInput";
import { SolarAvatar } from "@/components/common";

export function ChatContainer() {
  const { messages, isLoading, error, sendMessage, clearMessages } = useChat();

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-solar-orange-light via-white to-solar-orange-light/50">
      {/* 챗봇 컨테이너 (모바일 스타일) */}
      <div className="flex flex-col h-screen w-full max-w-[800px] bg-white shadow-2xl">
        {/* 헤더 */}
        <header className="flex-shrink-0 h-14 border-b border-border bg-white">
          <div className="h-full px-4 flex items-center justify-between">
            {/* 좌측: 뒤로가기 + 아바타 + 타이틀 */}
            <div className="flex items-center gap-3">
              {/* 뒤로가기 버튼 */}
              <button
                onClick={() => window.history.back()}
                className="text-solar-orange hover:text-solar-orange/80 transition-colors"
                aria-label="뒤로가기"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>

              {/* 태양 아바타 */}
              <SolarAvatar size="lg" />

              {/* 타이틀 */}
              <div>
                <h1 className="text-lg font-bold text-text-primary">솔라가이드</h1>
              </div>
            </div>

            {/* 우측: 대화 초기화 */}
            <button
              onClick={clearMessages}
              className="text-sm text-text-secondary hover:text-solar-orange transition-colors"
            >
              대화 초기화
            </button>
          </div>
        </header>

        {/* 에러 표시 */}
        {error && (
          <div className="flex-shrink-0 bg-red-50 border-b border-red-200 px-4 py-3">
            <p className="text-sm text-red-600 text-center">{error}</p>
          </div>
        )}

        {/* 메시지 영역 */}
        <div className="flex-1 overflow-hidden w-full">
          <MessageList messages={messages} isLoading={isLoading} />
        </div>

        {/* 입력 영역 */}
        <ChatInput onSend={sendMessage} disabled={isLoading} />
      </div>
    </div>
  );
}
