"use client";

import { useEffect, useRef } from "react";
import type { Message } from "@/lib/chat/types";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { SolarAvatar } from "@/components/common";

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // 새 메시지가 추가되면 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="h-full overflow-y-auto px-4 py-6 bg-white">
      {messages.length === 0 ? (
        <div className="flex flex-col pt-4">
          {/* 첫 번째 환영 메시지 */}
          <div className="flex justify-start mb-4">
            <div className="flex-shrink-0 mr-2 mt-1">
              <SolarAvatar size="md" />
            </div>
            <div className="max-w-[80%] px-4 py-3 bg-surface text-text-primary rounded-[16px] rounded-tl-[4px]">
              <p className="text-base leading-relaxed">
                솔라가이드가 데이터 기반으로 도와드릴게요.
              </p>
            </div>
          </div>

          {/* 두 번째 메시지 */}
          <div className="flex justify-start mb-4">
            <div className="flex-shrink-0 mr-2 mt-1">
              <SolarAvatar size="md" />
            </div>
            <div className="max-w-[80%] px-4 py-3 bg-surface text-text-primary rounded-[16px] rounded-tl-[4px]">
              <p className="text-base leading-relaxed">
                어떤 정보가 필요하신가요? :)
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </>
      )}

      {/* 로딩 표시 (타이핑 인디케이터) */}
      {isLoading && (
        <div className="flex justify-start mb-4">
          <div className="flex-shrink-0 mr-2 mt-1">
            <SolarAvatar size="md" />
          </div>
          <div className="bg-surface rounded-[16px] rounded-tl-[4px] px-4 py-3">
            <div className="flex space-x-1.5">
              <span
                className="w-2 h-2 bg-solar-orange/50 rounded-full animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="w-2 h-2 bg-solar-orange/50 rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="w-2 h-2 bg-solar-orange/50 rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
