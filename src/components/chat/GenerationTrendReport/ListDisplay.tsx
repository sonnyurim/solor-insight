"use client";

import { formatNumber, extractMainValue, getAggregationLabel } from "./utils";

interface ListDisplayProps {
  data: Record<string, unknown>[];
  aggregation: string;
}

/**
 * LIST 모드: 2-3개 값을 목록으로 표시
 */
export function ListDisplay({ data, aggregation }: ListDisplayProps) {
  const { chartTitle } = getAggregationLabel(aggregation);

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
        <span className="w-1 h-4 bg-emerald-500 rounded-full" />
        {chartTitle}
      </h4>
      <div className="bg-white dark:bg-zinc-900 rounded-lg p-4 space-y-2">
        {data.map((row, idx) => {
          const mainValue = extractMainValue(row);
          if (!mainValue) return null;
          return (
            <div
              key={idx}
              className="flex justify-between items-center py-1 border-b border-zinc-100 dark:border-zinc-800 last:border-0"
            >
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {mainValue.label}
              </span>
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {formatNumber(mainValue.value)} MW
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
