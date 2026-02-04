"use client";

import type { GenerationTrendResultData, DisplayMode } from "@/lib/chat/types";
import { TextDisplay } from "./TextDisplay";
import { ListDisplay } from "./ListDisplay";
import { TableDisplay } from "./TableDisplay";
import { ChartDisplay } from "./ChartDisplay";
import { EmptyState } from "./EmptyState";
import { extractDataKeys } from "./utils";

interface GenerationTrendReportProps {
  result: GenerationTrendResultData;
}

export function GenerationTrendReport({ result }: GenerationTrendReportProps) {
  const { results } = result;

  if (!results || results.length === 0) {
    return (
      <div className="mt-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-4">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          조회된 데이터가 없습니다.
        </p>
      </div>
    );
  }

  // 첫 번째 결과의 메타데이터를 기본 정보로 사용
  const firstResult = results[0];
  const { region, season, year, dataType, disclaimer } = firstResult.metadata;

  return (
    <div className="mt-3 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-zinc-800 dark:to-zinc-800 border border-emerald-200 dark:border-zinc-700 overflow-hidden">
      {/* 헤더 */}
      <ReportHeader
        region={region}
        year={year}
        season={season}
        dataType={dataType}
      />

      <div className="p-4 space-y-6">
        {/* Disclaimer (추정값인 경우) */}
        {disclaimer && <DisclaimerBanner message={disclaimer} />}

        {/* 각 결과별 렌더링 */}
        {results.map((res, resIdx) => (
          <ResultDisplay key={resIdx} result={res} />
        ))}

        {/* 데이터 요약 */}
        <DataSummary dataCount={firstResult.data.length} />
      </div>
    </div>
  );
}

/**
 * 리포트 헤더 컴포넌트
 */
function ReportHeader({
  region,
  year,
  season,
  dataType,
}: {
  region: string;
  year: number;
  season: string;
  dataType: string;
}) {
  return (
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
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          {region} 발전량 추이
        </h3>
        <div className="flex gap-2">
          <span className="px-2 py-1 bg-white/20 text-white text-xs font-medium rounded-full">
            {year}년 {season}
          </span>
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${
              dataType === "actual"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {dataType === "actual" ? "실측값" : "추정값"}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Disclaimer 배너 컴포넌트
 */
function DisclaimerBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
      <svg
        className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <p className="text-xs text-amber-700 dark:text-amber-300">{message}</p>
    </div>
  );
}

/**
 * 개별 결과 표시 컴포넌트
 */
function ResultDisplay({
  result,
}: {
  result: {
    data: Record<string, unknown>[];
    metadata: {
      aggregations: string[];
      chartType?: "bar" | "line" | null;
      displayMode: DisplayMode;
      outputFormat?: "chart" | "table" | null;
    };
  };
}) {
  const { data, metadata } = result;
  const currentAgg = metadata.aggregations[0];
  const chartType =
    metadata.chartType || (currentAgg === "hourly" ? "line" : "bar");
  const displayMode: DisplayMode = metadata.displayMode || "chart";
  const outputFormat = metadata.outputFormat;

  // 빈 데이터인 경우
  if (data.length === 0) {
    return <EmptyState aggregation={currentAgg} />;
  }

  // 데이터 키 추출
  const dataKeys = extractDataKeys(data, currentAgg);

  // TABLE 모드: 사용자가 "표로 보여줘" 요청 시
  if (outputFormat === "table") {
    return (
      <TableDisplay data={data} aggregation={currentAgg} dataKeys={dataKeys} />
    );
  }

  // TEXT 모드: 단일 값을 텍스트로 표시
  if (displayMode === "text") {
    return <TextDisplay data={data} aggregation={currentAgg} />;
  }

  // LIST 모드: 2-3개 값을 목록으로 표시
  if (displayMode === "list") {
    return <ListDisplay data={data} aggregation={currentAgg} />;
  }

  // CHART 모드: 4개 이상 데이터는 그래프로 표시
  return (
    <ChartDisplay
      data={data}
      aggregation={currentAgg}
      dataKeys={dataKeys}
      chartType={chartType}
    />
  );
}

/**
 * 데이터 요약 컴포넌트
 */
function DataSummary({ dataCount }: { dataCount: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
      <div className="bg-white dark:bg-zinc-700/50 rounded-lg px-3 py-2 text-center">
        <span className="text-zinc-500 dark:text-zinc-400">데이터 수</span>
        <p className="font-semibold text-zinc-900 dark:text-zinc-100">
          {dataCount}개
        </p>
      </div>
    </div>
  );
}
