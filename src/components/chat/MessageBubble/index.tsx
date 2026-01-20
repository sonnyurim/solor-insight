"use client";

import type { Message } from "@/lib/chat/types";
import { RevenueReport } from "@/components/chat/RevenueReport";
import { ReverseReport } from "@/components/chat/ReverseReport";
import { SolarAvatar } from "@/components/common";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      {/* 봇 메시지: 좌측 태양 아바타 */}
      {!isUser && (
        <div className="flex-shrink-0 mr-2 mt-1">
          <SolarAvatar size="md" />
        </div>
      )}

      <div
        className={`max-w-[75%] px-4 py-3 ${
          isUser
            ? "bg-solar-orange text-white rounded-[16px] rounded-tr-[4px]"
            : "bg-surface text-text-primary rounded-[16px] rounded-tl-[4px]"
        }`}
      >
        <p className="text-base leading-relaxed whitespace-pre-wrap">
          {message.content}
        </p>

        {/* 수익 계산 결과 표시 (정방향) */}
        {!isUser && message.calculationResult && (
          <RevenueReport result={message.calculationResult} />
        )}

        {/* 역산 계산 결과 표시 (Phase 2) */}
        {!isUser && message.reverseCalculationResult && (
          <ReverseReport result={message.reverseCalculationResult} />
        )}

        {/* 차단 메시지 표시 */}
        {message.blocked && message.blockType && (
          <div className="mt-2 pt-2 border-t border-white/20 text-xs opacity-80">
            차단 유형: {message.blockType}
          </div>
        )}

        {/* 분류 결과 표시 (봇 메시지) */}
        {!isUser && message.classification && (
          <div className="mt-2 pt-2 border-t border-border">
            <div className="flex flex-wrap gap-1.5">
              {message.classification.intents.map((intent) => (
                <span
                  key={intent}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-solar-orange-light text-solar-orange"
                >
                  {intent}
                </span>
              ))}
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  message.classification.confidence === "HIGH"
                    ? "bg-emerald-100 text-emerald-800"
                    : message.classification.confidence === "MEDIUM"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {message.classification.confidence}
              </span>
            </div>
          </div>
        )}

        <time className="block mt-2 text-xs opacity-60">
          {new Date(message.timestamp).toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      </div>
    </div>
  );
}
