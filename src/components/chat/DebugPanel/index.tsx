"use client";

import { useState } from "react";
import type { ClassificationResult } from "@/lib/chat/types";

interface DebugPanelProps {
  lastResult: ClassificationResult | null;
}

export function DebugPanel({ lastResult }: DebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // 개발 모드에서만 표시
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center justify-between"
      >
        <span className="font-mono">🔍 Debug Panel</span>
        <svg
          className={`w-4 h-4 transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4">
          {lastResult ? (
            <div className="space-y-3">
              {/* 성공/실패 상태 */}
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    lastResult.success ? "bg-emerald-500" : "bg-red-500"
                  }`}
                />
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  {lastResult.success ? "분류 성공" : "분류 실패"}
                </span>
              </div>

              {/* 차단 정보 */}
              {lastResult.blocked && (
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                  <p className="text-xs font-medium text-red-800 dark:text-red-200">
                    차단됨: {lastResult.blockType}
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                    {lastResult.blockMessage}
                  </p>
                </div>
              )}

              {/* 분류 결과 */}
              {lastResult.intents && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">의도:</span>
                    <div className="flex gap-1">
                      {lastResult.intents.map((intent) => (
                        <span
                          key={intent}
                          className="px-2 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded"
                        >
                          {intent}
                        </span>
                      ))}
                    </div>
                    {lastResult.isMulti && (
                      <span className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 rounded">
                        복합
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">신뢰도:</span>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded ${
                        lastResult.confidence === "HIGH"
                          ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200"
                          : lastResult.confidence === "MEDIUM"
                          ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200"
                          : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                      }`}
                    >
                      {lastResult.confidence}
                    </span>
                  </div>

                  {lastResult.reason && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-zinc-500">이유:</span>
                      <span className="text-xs text-zinc-700 dark:text-zinc-300">
                        {lastResult.reason}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* 점수 */}
              {lastResult.scores && (
                <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3">
                  <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    점수
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(lastResult.scores).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-xs">
                        <span className="text-zinc-500">{key}</span>
                        <span className="font-mono text-zinc-700 dark:text-zinc-300">
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 에러 */}
              {lastResult.error && (
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                  <p className="text-xs text-red-600 dark:text-red-300">
                    {lastResult.error}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-zinc-400">
              메시지를 전송하면 분류 결과가 표시됩니다.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
