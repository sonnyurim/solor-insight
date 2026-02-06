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
          {/* 환영 메시지 */}
          <div className="flex justify-start mb-4">
            <div className="flex-shrink-0 mr-2 mt-1">
              <SolarAvatar size="md" />
            </div>
            <div className="max-w-[85%] px-4 py-3 bg-surface text-text-primary rounded-[16px] rounded-tl-[4px]">
              <p className="text-sm leading-relaxed mb-3">
                솔라가이드가 태양광 발전 관련 정보를 도와드릴게요.
              </p>
              <div className="text-xs text-text-secondary space-y-1.5">
                <p className="font-medium text-text-primary mb-1">
                  이런 질문을 해보세요
                </p>
                <p className="pl-2">
                  💰 &quot;100kW 발전소 월 수익 얼마야?&quot;
                </p>
                <p className="pl-2">📋 &quot;REC 발급 방법 알려줘&quot;</p>
                <p className="pl-2">📊 &quot;지난달 발전량 보여줘&quot;</p>
                <p className="pl-2">❓ &quot;SMP, REC가 뭐야?&quot;</p>
              </div>
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
