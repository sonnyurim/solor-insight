"use client";

import type { RevenueCalculationResult } from "@/lib/chat/types";

interface RevenueReportProps {
  result: RevenueCalculationResult;
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

export function RevenueReport({ result }: RevenueReportProps) {
  const { input, generation, revenue, unit_price_per_kwh, disclaimer } = result;

  return (
    <div className="mt-3 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-zinc-800 dark:to-zinc-800 border border-amber-200 dark:border-zinc-700 overflow-hidden">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3">
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
          예상 수익 리포트
        </h3>
      </div>

      <div className="p-4 space-y-4">
        {/* 입력값 요약 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          <div className="bg-white dark:bg-zinc-700/50 rounded-lg px-3 py-2">
            <span className="text-zinc-500 dark:text-zinc-400">설비용량</span>
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">
              {formatNumber(input.capacity_kw)} kW
            </p>
          </div>
          <div className="bg-white dark:bg-zinc-700/50 rounded-lg px-3 py-2">
            <span className="text-zinc-500 dark:text-zinc-400">REC 단가</span>
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">
              {formatNumber(input.rec_price)}원
            </p>
          </div>
          <div className="bg-white dark:bg-zinc-700/50 rounded-lg px-3 py-2">
            <span className="text-zinc-500 dark:text-zinc-400">SMP 단가</span>
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">
              {formatNumber(input.smp_price)}원/kWh
            </p>
          </div>
          <div className="bg-white dark:bg-zinc-700/50 rounded-lg px-3 py-2">
            <span className="text-zinc-500 dark:text-zinc-400">이용률</span>
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">
              {formatPercent(input.utilization_rate)}
            </p>
          </div>
          <div className="bg-white dark:bg-zinc-700/50 rounded-lg px-3 py-2">
            <span className="text-zinc-500 dark:text-zinc-400">REC 가중치</span>
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">
              {input.rec_weight}
            </p>
          </div>
          <div className="bg-white dark:bg-zinc-700/50 rounded-lg px-3 py-2">
            <span className="text-zinc-500 dark:text-zinc-400">kWh당 단가</span>
            <p className="font-semibold text-amber-600 dark:text-amber-400">
              {formatNumber(unit_price_per_kwh)}원
            </p>
          </div>
        </div>

        {/* 발전량 */}
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
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            예상 발전량
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white dark:bg-zinc-700/50 rounded-lg px-3 py-2 text-center">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                월간
              </span>
              <p className="font-bold text-lg text-zinc-900 dark:text-zinc-100">
                {formatNumber(generation.monthly_kwh)}
                <span className="text-xs font-normal ml-1">kWh</span>
              </p>
            </div>
            <div className="bg-white dark:bg-zinc-700/50 rounded-lg px-3 py-2 text-center">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                연간
              </span>
              <p className="font-bold text-lg text-zinc-900 dark:text-zinc-100">
                {formatNumber(generation.yearly_kwh)}
                <span className="text-xs font-normal ml-1">kWh</span>
              </p>
            </div>
          </div>
        </div>

        {/* 수익 테이블 */}
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
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            예상 수익
          </h4>
          <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-600">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-100 dark:bg-zinc-700">
                  <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    구분
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    월간
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    연간
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-700">
                <tr>
                  <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                    SMP 수익
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-900 dark:text-zinc-100">
                    {formatNumber(revenue.monthly.smp)}원
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-900 dark:text-zinc-100">
                    {formatNumber(revenue.yearly.smp)}원
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                    REC 수익
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-900 dark:text-zinc-100">
                    {formatNumber(revenue.monthly.rec)}원
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-900 dark:text-zinc-100">
                    {formatNumber(revenue.yearly.rec)}원
                  </td>
                </tr>
                <tr className="bg-amber-50 dark:bg-amber-900/20">
                  <td className="px-3 py-2 font-semibold text-zinc-900 dark:text-zinc-100">
                    총 수익
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-amber-600 dark:text-amber-400">
                    {formatNumber(revenue.monthly.total)}원
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-amber-600 dark:text-amber-400">
                    {formatNumber(revenue.yearly.total)}원
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 면책 조항 */}
        <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center pt-2 border-t border-zinc-200 dark:border-zinc-700">
          {disclaimer}
        </p>
      </div>
    </div>
  );
}
