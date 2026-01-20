import type {
  CalculatorInput,
  RevenueCalculationResult,
  PeriodInfo,
  CalculationMode,
  ReverseCalculationResult,
} from "./types";
import {
  HOURS_PER_DAY,
  DAYS_PER_YEAR,
  MONTHS_PER_YEAR,
  KWH_PER_REC,
  DISCLAIMER,
} from "@/constants/chat/calculator";

/**
 * 발전량 산출 (확장: 일간 + 사용자 지정 기간)
 * 연간_발전량(kWh) = 용량(kW) × 24 × 이용률 × 365
 * 월간_발전량(kWh) = 연간_발전량 ÷ 12
 * 일간_발전량(kWh) = 연간_발전량 ÷ 365
 */
export function calculateGeneration(
  capacityKw: number,
  utilizationRate: number,
  period?: PeriodInfo
): {
  daily_kwh: number;
  monthly_kwh: number;
  yearly_kwh: number;
  custom_kwh?: number;
  customPeriodLabel?: string;
} {
  const yearlyKwh =
    capacityKw * HOURS_PER_DAY * utilizationRate * DAYS_PER_YEAR;
  const monthlyKwh = yearlyKwh / MONTHS_PER_YEAR;
  const dailyKwh = yearlyKwh / DAYS_PER_YEAR;

  const result: {
    daily_kwh: number;
    monthly_kwh: number;
    yearly_kwh: number;
    custom_kwh?: number;
    customPeriodLabel?: string;
  } = {
    daily_kwh: Math.floor(dailyKwh),
    monthly_kwh: Math.floor(monthlyKwh),
    yearly_kwh: Math.floor(yearlyKwh),
  };

  // 사용자 지정 기간 계산
  if (period && period.count > 1) {
    let customKwh = 0;
    let label = "";

    switch (period.type) {
      case "daily":
        customKwh = dailyKwh * period.count;
        label = `${period.count}일`;
        break;
      case "monthly":
        customKwh = monthlyKwh * period.count;
        label = `${period.count}개월`;
        break;
      case "yearly":
        customKwh = yearlyKwh * period.count;
        label = `${period.count}년`;
        break;
    }

    result.custom_kwh = Math.floor(customKwh);
    result.customPeriodLabel = label;
  }

  return result;
}

/**
 * SMP 수익 계산
 * SMP_수익 = 발전량(kWh) × SMP단가(원/kWh)
 */
export function calculateSmpRevenue(kwh: number, smpPrice: number): number {
  return Math.floor(kwh * smpPrice);
}

/**
 * REC 수익 계산
 * REC_수익 = (발전량(kWh) ÷ 1000 × REC가중치) × REC단가(원)
 */
export function calculateRecRevenue(
  kwh: number,
  recPrice: number,
  recWeight: number
): number {
  return Math.floor((kwh / KWH_PER_REC) * recWeight * recPrice);
}

/**
 * 수익 계산 (일간/월간/연간/사용자 지정 기간)
 */
export function calculateRevenue(
  generation: {
    daily_kwh: number;
    monthly_kwh: number;
    yearly_kwh: number;
    custom_kwh?: number;
    customPeriodLabel?: string;
  },
  smpPrice: number,
  recPrice: number,
  recWeight: number,
  calculationMode: CalculationMode = "full"
): {
  daily: { smp: number; rec: number; total: number };
  monthly: { smp: number; rec: number; total: number };
  yearly: { smp: number; rec: number; total: number };
  custom?: { smp: number; rec: number; total: number; periodLabel: string };
} {
  // 계산 모드에 따른 수익 계산 헬퍼
  const calcRevenue = (kwh: number) => {
    const smp =
      calculationMode === "rec_only"
        ? 0
        : calculateSmpRevenue(kwh, smpPrice);
    const rec =
      calculationMode === "smp_only"
        ? 0
        : calculateRecRevenue(kwh, recPrice, recWeight);
    return { smp, rec, total: smp + rec };
  };

  const result: {
    daily: { smp: number; rec: number; total: number };
    monthly: { smp: number; rec: number; total: number };
    yearly: { smp: number; rec: number; total: number };
    custom?: { smp: number; rec: number; total: number; periodLabel: string };
  } = {
    daily: calcRevenue(generation.daily_kwh),
    monthly: calcRevenue(generation.monthly_kwh),
    yearly: calcRevenue(generation.yearly_kwh),
  };

  // 사용자 지정 기간 수익
  if (generation.custom_kwh && generation.customPeriodLabel) {
    const customRevenue = calcRevenue(generation.custom_kwh);
    result.custom = {
      ...customRevenue,
      periodLabel: generation.customPeriodLabel,
    };
  }

  return result;
}

/**
 * 수익 비중 계산 (Phase 1)
 */
export function calculateRevenueRatio(
  smpRevenue: number,
  recRevenue: number
): { smp_percent: number; rec_percent: number } {
  const total = smpRevenue + recRevenue;
  if (total === 0) {
    return { smp_percent: 0, rec_percent: 0 };
  }

  return {
    smp_percent: Math.round((smpRevenue / total) * 100 * 10) / 10,
    rec_percent: Math.round((recRevenue / total) * 100 * 10) / 10,
  };
}

/**
 * kWh당 통합단가 계산
 * kWh당_통합단가 = SMP단가 + (REC단가 × REC가중치 ÷ 1000)
 */
export function calculateUnitPrice(
  smpPrice: number,
  recPrice: number,
  recWeight: number
): number {
  return Math.floor(smpPrice + (recPrice * recWeight) / KWH_PER_REC);
}

/**
 * 확장 계산기 입력 (기간 + 계산 모드 포함)
 */
export interface ExtendedCalculatorInput extends CalculatorInput {
  period?: PeriodInfo;
  calculationMode?: CalculationMode;
}

// ==================== Phase 2: 역산 계산 ====================

/**
 * 역산 계산기 입력
 */
export interface ReverseCalculatorInput {
  targetRevenue: number; // 목표 수익 (원)
  targetPeriod: PeriodInfo; // 목표 기간
  rec_price: number;
  smp_price: number;
  utilization_rate: number;
  rec_weight: number;
}

/**
 * 필요 용량 역산 (Phase 2)
 * 목표 수익에서 필요 용량 계산
 *
 * 계산 공식:
 * 연간_발전량(kWh) = 용량(kW) × 24 × 이용률 × 365
 * 연간_수익 = (연간_발전량 × SMP) + (연간_발전량 / 1000 × 가중치 × REC)
 *
 * 역산:
 * 용량(kW) = 연간_수익 / (24 × 이용률 × 365 × (SMP + REC×가중치/1000))
 */
export function calculateRequiredCapacity(
  input: ReverseCalculatorInput
): ReverseCalculationResult {
  const { targetRevenue, targetPeriod, rec_price, smp_price, utilization_rate, rec_weight } = input;

  // 연간 수익으로 변환
  let yearlyTargetRevenue = targetRevenue;
  switch (targetPeriod.type) {
    case "daily":
      yearlyTargetRevenue = targetRevenue * DAYS_PER_YEAR * targetPeriod.count;
      break;
    case "monthly":
      yearlyTargetRevenue = targetRevenue * MONTHS_PER_YEAR * targetPeriod.count;
      break;
    case "yearly":
      yearlyTargetRevenue = targetRevenue * targetPeriod.count;
      break;
  }

  // kWh당 통합 단가 계산
  const unitPricePerKwh = smp_price + (rec_price * rec_weight) / KWH_PER_REC;

  // 필요 연간 발전량
  const requiredYearlyKwh = yearlyTargetRevenue / unitPricePerKwh;

  // 필요 용량 역산
  // 연간_발전량 = 용량 × 24 × 이용률 × 365
  // 용량 = 연간_발전량 / (24 × 이용률 × 365)
  const requiredCapacity =
    requiredYearlyKwh / (HOURS_PER_DAY * utilization_rate * DAYS_PER_YEAR);

  // 소수점 첫째자리까지 반올림 (예: 123.4kW)
  const roundedCapacity = Math.ceil(requiredCapacity * 10) / 10;

  return {
    requiredCapacityKw: roundedCapacity,
    targetRevenue,
    targetPeriod,
    input: {
      rec_price,
      smp_price,
      utilization_rate,
      rec_weight,
    },
    disclaimer: DISCLAIMER,
  };
}

/**
 * 통합 계산 함수 (Phase 1 확장)
 * 모든 계산을 수행하고 RevenueCalculationResult 반환
 */
export function calculate(
  input: CalculatorInput | ExtendedCalculatorInput
): RevenueCalculationResult {
  const extendedInput = input as ExtendedCalculatorInput;
  const period = extendedInput.period;
  const calculationMode = extendedInput.calculationMode || "full";

  // Step 1: 발전량 산출 (기간 포함)
  const generation = calculateGeneration(
    input.capacity_kw,
    input.utilization_rate,
    period
  );

  // Step 2: 수익 계산 (계산 모드 적용)
  const revenue = calculateRevenue(
    generation,
    input.smp_price,
    input.rec_price,
    input.rec_weight,
    calculationMode
  );

  // Step 3: kWh당 단가 계산
  const unitPrice = calculateUnitPrice(
    input.smp_price,
    input.rec_price,
    input.rec_weight
  );

  // Step 4: 수익 비중 계산 (rec_ratio 모드 또는 항상)
  const ratio = calculateRevenueRatio(
    revenue.yearly.smp,
    revenue.yearly.rec
  );

  return {
    input: {
      rec_price: input.rec_price,
      smp_price: input.smp_price,
      capacity_kw: input.capacity_kw,
      utilization_rate: input.utilization_rate,
      rec_weight: input.rec_weight,
    },
    generation: {
      daily_kwh: generation.daily_kwh,
      monthly_kwh: generation.monthly_kwh,
      yearly_kwh: generation.yearly_kwh,
      custom_kwh: generation.custom_kwh,
    },
    revenue: {
      daily: revenue.daily,
      monthly: revenue.monthly,
      yearly: revenue.yearly,
      custom: revenue.custom,
    },
    unit_price_per_kwh: unitPrice,
    disclaimer: DISCLAIMER,
    calculationMode,
    ratio,
  };
}
