"use client";

import { getAggregationLabel } from "./utils";

interface EmptyStateProps {
  aggregation: string;
}

/**
 * 데이터 없음 상태 표시
 */
export function EmptyState({ aggregation }: EmptyStateProps) {
  const { chartTitle } = getAggregationLabel(aggregation);

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
        <span className="w-1 h-4 bg-zinc-400 rounded-full" />
        {chartTitle}
      </h4>
      <div className="bg-white dark:bg-zinc-900 rounded-lg p-6 text-center">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          해당 조건의 데이터가 없습니다.
        </p>
      </div>
    </div>
  );
}
