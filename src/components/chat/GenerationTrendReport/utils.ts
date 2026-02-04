/**
 * GenerationTrendReport 컴포넌트를 위한 유틸리티 함수들
 */

/**
 * 숫자를 천 단위 콤마가 있는 문자열로 변환
 */
export function formatNumber(num: number): string {
  return num.toLocaleString("ko-KR", { maximumFractionDigits: 3 });
}

/**
 * 데이터에서 주요 값 추출
 */
export function extractMainValue(
  row: Record<string, unknown>
): { label: string; value: number } | null {
  const valueKeys = [
    "avg_power",
    "total_power",
    "avg_generation",
    "total_generation",
    "power_mw",
    "avg_kwh",
    "total_kwh",
    "min_kwh",
    "max_kwh",
  ];
  const labelKeys = [
    "hour_range",
    "date",
    "week_of_year",
    "month_name",
    "day_name",
    "hour",
    "week_no",
    "month",
  ];

  let value: number | null = null;
  let label = "";

  for (const key of valueKeys) {
    if (row[key] !== undefined && typeof row[key] === "number") {
      value = row[key] as number;
      break;
    }
  }

  for (const key of labelKeys) {
    if (row[key] !== undefined) {
      label = String(row[key]);
      break;
    }
  }

  if (value === null) return null;
  return { label, value };
}

/**
 * 집계 유형에 따른 라벨 반환
 */
export function getAggregationLabel(aggregation: string): {
  xLabel: string;
  chartTitle: string;
} {
  switch (aggregation) {
    case "hourly":
      return { xLabel: "시간", chartTitle: "시간별 발전량" };
    case "daily":
      return { xLabel: "날짜", chartTitle: "일별 발전량" };
    case "weekly":
      return { xLabel: "주차", chartTitle: "주별 발전량" };
    case "monthly":
      return { xLabel: "월", chartTitle: "월별 발전량" };
    case "day_of_week":
      return { xLabel: "요일", chartTitle: "요일별 발전량" };
    default:
      return { xLabel: "시간", chartTitle: "발전량 추이" };
  }
}

/**
 * X축 데이터 키 반환
 */
export function getXAxisKey(aggregation: string): string {
  switch (aggregation) {
    case "hourly":
      return "hour";
    case "daily":
      return "date";
    case "weekly":
      return "week_no";
    case "monthly":
      return "month";
    case "day_of_week":
      return "day_name";
    default:
      return "hour";
  }
}

/**
 * X축 값 포매팅
 */
export function formatXAxisValue(value: unknown, aggregation: string): string {
  if (value === null || value === undefined) return "";

  if (aggregation === "daily" && typeof value === "string") {
    // ISO 날짜 형식을 MM/DD로 변환
    const date = new Date(value);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  if (aggregation === "weekly" && typeof value === "number") {
    return `${value}주차`;
  }

  if (aggregation === "hourly" && typeof value === "number") {
    return `${value}시`;
  }

  if (aggregation === "monthly" && typeof value === "number") {
    return `${value}월`;
  }

  return String(value);
}

/**
 * 데이터 키에 대한 한글 라벨 매핑
 */
export function getKeyLabels(): Record<string, string> {
  return {
    avg_power: "평균 발전량",
    min_power: "최소 발전량",
    max_power: "최대 발전량",
    total_power: "총 발전량",
    avg_generation: "평균 발전량",
    total_generation: "총 발전량",
    max_generation: "최대 발전량",
    min_generation: "최소 발전량",
    power_mw: "발전량",
    avg_kwh: "평균 발전량",
    total_kwh: "총 발전량",
    min_kwh: "최소 발전량",
    max_kwh: "최대 발전량",
  };
}

/**
 * 데이터에서 값 관련 키 추출
 */
export function extractDataKeys(
  data: Record<string, unknown>[],
  aggregation: string
): string[] {
  if (data.length === 0) return [];

  let dataKeys = Object.keys(data[0]).filter(
    (key) =>
      key.includes("power") ||
      key.includes("generation") ||
      key.includes("avg") ||
      key.includes("total") ||
      key.includes("min") ||
      key.includes("max")
  );

  // 특정 집계에서는 total만 표시
  if (aggregation === "monthly" || aggregation === "daily") {
    const totalKey = dataKeys.find((k) => k.includes("total"));
    if (totalKey) dataKeys = [totalKey];
  }

  return dataKeys;
}
