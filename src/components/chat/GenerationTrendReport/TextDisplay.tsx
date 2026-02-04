"use client";

import { formatNumber, extractMainValue, getAggregationLabel } from "./utils";

interface TextDisplayProps {
  data: Record<string, unknown>[];
  aggregation: string;
}

/**
 * TEXT 모드: 단일 값을 텍스트로 표시
 */
export function TextDisplay({ data, aggregation }: TextDisplayProps) {
  const { chartTitle } = getAggregationLabel(aggregation);
  const mainValue = data[0] ? extractMainValue(data[0]) : null;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
        <span className="w-1 h-4 bg-emerald-500 rounded-full" />
        {chartTitle}
      </h4>
      <div className="bg-white dark:bg-zinc-900 rounded-lg p-4">
        {mainValue ? (
          <p className="text-base text-zinc-700 dark:text-zinc-300">
            {mainValue.label && (
              <span className="font-medium">{mainValue.label}: </span>
            )}
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
              {formatNumber(mainValue.value)} MW
            </span>
          </p>
        ) : (
          <p className="text-sm text-zinc-500">데이터를 표시할 수 없습니다.</p>
        )}
      </div>
    </div>
  );
}
