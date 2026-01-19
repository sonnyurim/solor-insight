"use client";

import type { Message } from "@/lib/chat/types";
import { RevenueReport } from "@/components/chat/RevenueReport";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-amber-500 text-white rounded-br-sm"
            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-sm"
        }`}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
        </p>

        {/* 수익 계산 결과 표시 */}
        {!isUser && message.calculationResult && (
          <RevenueReport result={message.calculationResult} />
        )}

        {/* 차단 메시지 표시 */}
        {message.blocked && message.blockType && (
          <div className="mt-2 pt-2 border-t border-white/20 text-xs opacity-80">
            차단 유형: {message.blockType}
          </div>
        )}

        {/* 분류 결과 표시 (봇 메시지) */}
        {!isUser && message.classification && (
          <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
            <div className="flex flex-wrap gap-1.5">
              {message.classification.intents.map((intent) => (
                <span
                  key={intent}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200"
                >
                  {intent}
                </span>
              ))}
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  message.classification.confidence === "HIGH"
                    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200"
                    : message.classification.confidence === "MEDIUM"
                    ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200"
                    : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
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
