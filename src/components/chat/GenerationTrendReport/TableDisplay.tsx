"use client";

import {
  formatNumber,
  getAggregationLabel,
  getXAxisKey,
  formatXAxisValue,
  getKeyLabels,
} from "./utils";

interface TableDisplayProps {
  data: Record<string, unknown>[];
  aggregation: string;
  dataKeys: string[];
}

/**
 * TABLE 모드: 사용자가 "표로 보여줘" 요청 시
 */
export function TableDisplay({ data, aggregation, dataKeys }: TableDisplayProps) {
  const { chartTitle, xLabel } = getAggregationLabel(aggregation);
  const xAxisKey = getXAxisKey(aggregation);
  const keyLabels = getKeyLabels();

  // X축 값 포매팅된 데이터
  const formattedData = data.map((row) => {
    const formatted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (key === xAxisKey) {
        formatted[key] = formatXAxisValue(value, aggregation);
      } else if (typeof value === "number") {
        formatted[key] = Number(value.toFixed(3));
      } else {
        formatted[key] = value;
      }
    }
    return formatted;
  });

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
        <span className="w-1 h-4 bg-emerald-500 rounded-full" />
        {chartTitle}
      </h4>
      <div className="bg-white dark:bg-zinc-900 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800">
            <tr>
              <th className="px-4 py-2 text-left text-zinc-600 dark:text-zinc-400 font-medium">
                {xLabel}
              </th>
              {dataKeys.map((key) => (
                <th
                  key={key}
                  className="px-4 py-2 text-right text-zinc-600 dark:text-zinc-400 font-medium"
                >
                  {keyLabels[key] || key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {formattedData.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">
                  {String(row[xAxisKey] || "")}
                </td>
                {dataKeys.map((key) => (
                  <td
                    key={key}
                    className="px-4 py-2 text-right text-emerald-600 dark:text-emerald-400 font-medium"
                  >
                    {typeof row[key] === "number"
                      ? formatNumber(row[key] as number)
                      : String(row[key] || "")}{" "}
                    MW
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
