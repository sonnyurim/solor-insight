"use client";

import type { ReverseCalculationResult, SourceInfo } from "@/lib/chat/types";

interface ReverseReportProps {
  result: ReverseCalculationResult;
}

/**
 * 숫자를 천 단위 콤마가 있는 문자열로 변환
 */
function formatNumber(num: number): string {
  return num.toLocaleString("ko-KR");
}

/**
 * 퍼센트 표시 (소수점 → 퍼센트)
 */
function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

/**
 * 기간 라벨 생성
 */
function getPeriodLabel(
  type: "daily" | "monthly" | "yearly",
  count: number
): string {
  switch (type) {
    case "daily":
      return count === 1 ? "하루" : `${count}일`;
    case "monthly":
      return count === 1 ? "월간" : `${count}개월`;
    case "yearly":
      return count === 1 ? "연간" : `${count}년`;
  }
}

/**
 * 출처 라벨 표시
 */
function SourceLabel({ source }: { source?: SourceInfo }) {
  if (!source || source.type === "user" || !source.label) {
    return null;
  }

  return (
    <span className="text-xs text-zinc-400 dark:text-zinc-500 ml-1">
      ({source.label})
    </span>
  );
}

export function ReverseReport({ result }: ReverseReportProps) {
  const {
    requiredCapacityKw,
    targetRevenue,
    targetPeriod,
    input,
    disclaimer,
    region,
    sources,
  } = result;

  const periodLabel = getPeriodLabel(targetPeriod.type, targetPeriod.count);

  return (
    <div className="mt-3 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-zinc-800 dark:to-zinc-800 border border-emerald-200 dark:border-zinc-700 overflow-hidden">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            필요 용량 계산 결과
          </h3>
          {region && (
            <span className="px-2 py-1 bg-white/20 text-white text-xs font-medium rounded-full">
              📍 {region} 기준
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* 목표 수익 요약 */}
        <div className="text-center">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            목표 수익
          </span>
          <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {periodLabel}{" "}
            <span className="text-emerald-600 dark:text-emerald-400">
              {formatNumber(targetRevenue)}원
            </span>
          </p>
        </div>

        {/* 필요 용량 결과 */}
        <div className="bg-white dark:bg-zinc-700/50 rounded-xl p-6 text-center">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            필요 설비 용량
          </span>
          <p className="text-4xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
            {formatNumber(requiredCapacityKw)}
            <span className="text-xl ml-1">kW</span>
          </p>
          {requiredCapacityKw >= 1000 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              ({formatNumber(requiredCapacityKw / 1000)} MW)
            </p>
          )}
        </div>

        {/* 계산 기준 */}
        <div>
          <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2 flex items-center gap-1">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            계산 기준
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="bg-white dark:bg-zinc-700/50 rounded-lg px-3 py-2">
              <span className="text-zinc-500 dark:text-zinc-400">REC 단가</span>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                {formatNumber(input.rec_price)}원
              </p>
              <SourceLabel source={sources?.rec} />
            </div>
            <div className="bg-white dark:bg-zinc-700/50 rounded-lg px-3 py-2">
              <span className="text-zinc-500 dark:text-zinc-400">SMP 단가</span>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                {formatNumber(input.smp_price)}원/kWh
              </p>
              <SourceLabel source={sources?.smp} />
            </div>
            <div className="bg-white dark:bg-zinc-700/50 rounded-lg px-3 py-2">
              <span className="text-zinc-500 dark:text-zinc-400">이용률</span>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                {formatPercent(input.utilization_rate)}
              </p>
            </div>
            <div className="bg-white dark:bg-zinc-700/50 rounded-lg px-3 py-2">
              <span className="text-zinc-500 dark:text-zinc-400">
                REC 가중치
              </span>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                {input.rec_weight}
              </p>
            </div>
          </div>
        </div>

        {/* 참고 안내 */}
        <div className="bg-emerald-100/50 dark:bg-emerald-900/20 rounded-lg p-3">
          <p className="text-xs text-emerald-700 dark:text-emerald-300">
            💡 <strong>참고:</strong> 위 용량은 목표 수익을 달성하기 위한 최소
            필요 용량입니다. 실제 설치 시에는 여유 용량을 고려하시기 바랍니다.
          </p>
        </div>

        {/* 면책 조항 */}
        <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center pt-2 border-t border-zinc-200 dark:border-zinc-700">
          {disclaimer}
        </p>
      </div>
    </div>
  );
}
