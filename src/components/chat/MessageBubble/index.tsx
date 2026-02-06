"use client";

import ReactMarkdown from "react-markdown";
import type { Message } from "@/lib/chat/types";
import { RevenueReport } from "@/components/chat/RevenueReport";
import { ReverseReport } from "@/components/chat/ReverseReport";
import { GenerationTrendReport } from "@/components/chat/GenerationTrendReport";
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
        className={`px-4 py-3 ${
          isUser
            ? "max-w-[75%] bg-solar-orange text-white rounded-[16px] rounded-tr-[4px]"
            : `bg-surface text-text-primary rounded-[16px] rounded-tl-[4px] ${
                message.generationTrendResult
                  ? "w-full max-w-full"
                  : "max-w-[75%]"
              }`
        }`}
      >
        {isUser ? (
          <p className="text-base leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        ) : (
          <div
            className="text-sm leading-relaxed prose prose-sm max-w-none
            prose-p:my-1.5 prose-p:leading-relaxed prose-p:text-sm
            prose-headings:font-medium prose-headings:text-text-primary
            prose-h1:text-base prose-h1:mt-3 prose-h1:mb-1.5
            prose-h2:text-sm prose-h2:mt-3 prose-h2:mb-1.5
            prose-h3:text-sm prose-h3:mt-2.5 prose-h3:mb-1
            prose-h4:text-sm prose-h4:mt-2 prose-h4:mb-1
            prose-ul:my-1.5 prose-ul:pl-4
            prose-ol:my-1.5 prose-ol:pl-4
            prose-li:my-0.5 prose-li:leading-relaxed prose-li:text-sm
            prose-table:my-2 prose-table:text-xs
            prose-th:bg-surface-secondary/50 prose-th:px-2 prose-th:py-1 prose-th:text-left prose-th:font-medium
            prose-td:px-2 prose-td:py-1 prose-td:border-t prose-td:border-border/30
            prose-strong:text-text-primary prose-strong:font-semibold
            prose-code:text-solar-orange prose-code:bg-surface-secondary/30 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
          "
          >
            <ReactMarkdown>
              {message.content.replace(/\*\*/g, "")}
            </ReactMarkdown>
          </div>
        )}

        {/* 수익 계산 결과 표시 (정방향) */}
        {!isUser && message.calculationResult && (
          <RevenueReport result={message.calculationResult} />
        )}

        {/* 역산 계산 결과 표시 (Phase 2) */}
        {!isUser && message.reverseCalculationResult && (
          <ReverseReport result={message.reverseCalculationResult} />
        )}

        {/* 발전량 추이 조회 결과 표시 */}
        {!isUser && message.generationTrendResult && (
          <GenerationTrendReport result={message.generationTrendResult} />
        )}

        {/* 차단 메시지 표시 */}
        {message.blocked && message.blockType && (
          <div className="mt-2 pt-2 border-t border-white/20 text-xs opacity-80">
            차단 유형: {message.blockType}
          </div>
        )}

        <time className="block mt-2 text-xs opacity-60">
          {new Date(message.timestamp).toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>

        {/* 주의사항 (봇 메시지) */}
        {!isUser && (
          <p className="text-[9px] text-text-muted opacity-60 mt-0.5">
            AI 응답은 참고용입니다
          </p>
        )}

        {/* 인용 출처 (봇 메시지) */}
        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/30">
            <p className="text-[9px] text-text-muted mb-1">
              <span className="font-medium">출처</span>
            </p>
            <ul className="space-y-0.5">
              {message.citations.slice(0, 3).map((citation, idx) => {
                // 파일명에서 확장자 제거 및 정리
                const rawFileName = citation.sourceUri
                  ? decodeURIComponent(
                      citation.sourceUri.split("/").pop() || "",
                    )
                  : "";
                // 확장자 제거
                const fileName =
                  rawFileName.replace(/\.[^/.]+$/, "") || `문서 ${idx + 1}`;
                // 페이지 정보
                const pageInfo = citation.pageNumber
                  ? `, ${citation.pageNumber}p`
                  : "";

                return (
                  <li
                    key={idx}
                    className="text-[9px] text-text-muted leading-snug"
                  >
                    <span className="text-text-secondary">{fileName}</span>
                    {pageInfo && (
                      <span className="text-solar-orange/70">{pageInfo}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
