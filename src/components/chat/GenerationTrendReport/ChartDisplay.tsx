"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  formatNumber,
  getAggregationLabel,
  getXAxisKey,
  formatXAxisValue,
  getKeyLabels,
} from "./utils";

interface ChartDisplayProps {
  data: Record<string, unknown>[];
  aggregation: string;
  dataKeys: string[];
  chartType: "bar" | "line";
}

const COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#8b5cf6"];

/**
 * 커스텀 툴팁 컴포넌트
 */
function CustomTooltip({
  active,
  payload,
  label,
  aggregation,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  aggregation: string;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const { xLabel } = getAggregationLabel(aggregation);

  return (
    <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg p-3">
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
        {xLabel}: {label}
      </p>
      {payload.map((entry, index) => (
        <p key={index} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {formatNumber(entry.value)} MW
        </p>
      ))}
    </div>
  );
}

/**
 * CHART 모드: 4개 이상 데이터는 그래프로 표시
 */
export function ChartDisplay({
  data,
  aggregation,
  dataKeys,
  chartType,
}: ChartDisplayProps) {
  const { chartTitle } = getAggregationLabel(aggregation);
  const xAxisKey = getXAxisKey(aggregation);
  const keyLabels = getKeyLabels();

  // 차트 데이터 포매팅
  const chartData = data.map((row) => {
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
      <div className="bg-white dark:bg-zinc-900 rounded-lg p-4">
        <ResponsiveContainer width="100%" height={250}>
          {chartType === "line" ? (
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey={xAxisKey}
                tick={{ fontSize: 11 }}
                stroke="#9ca3af"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="#9ca3af"
                tickFormatter={(value) => formatNumber(value)}
              />
              <Tooltip
                content={<CustomTooltip aggregation={aggregation} />}
                cursor={false}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              {dataKeys.map((key, index) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={keyLabels[key] || key}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          ) : (
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey={xAxisKey}
                tick={{ fontSize: 11 }}
                stroke="#9ca3af"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="#9ca3af"
                tickFormatter={(value) => formatNumber(value)}
              />
              <Tooltip
                content={<CustomTooltip aggregation={aggregation} />}
                cursor={false}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              {dataKeys.map((key, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  name={keyLabels[key] || key}
                  fill={COLORS[index % COLORS.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
