import type { CalculatorInput, RevenueCalculationResult } from "./types";
import {
  HOURS_PER_DAY,
  DAYS_PER_YEAR,
  MONTHS_PER_YEAR,
  KWH_PER_REC,
  DISCLAIMER,
} from "@/constants/chat/calculator";

/**
 * 발전량 산출
 * 연간_발전량(kWh) = 용량(kW) × 24 × 이용률 × 365
 * 월간_발전량(kWh) = 연간_발전량 ÷ 12
 */
export function calculateGeneration(
  capacityKw: number,
  utilizationRate: number
): { monthly_kwh: number; yearly_kwh: number } {
  const yearlyKwh =
    capacityKw * HOURS_PER_DAY * utilizationRate * DAYS_PER_YEAR;
  const monthlyKwh = yearlyKwh / MONTHS_PER_YEAR;

  return {
    monthly_kwh: Math.floor(monthlyKwh),
    yearly_kwh: Math.floor(yearlyKwh),
  };
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
 * 수익 계산 (월간/연간)
 */
export function calculateRevenue(
  generation: { monthly_kwh: number; yearly_kwh: number },
  smpPrice: number,
  recPrice: number,
  recWeight: number
): {
  monthly: { smp: number; rec: number; total: number };
  yearly: { smp: number; rec: number; total: number };
} {
  // 월간 수익
  const monthlySmp = calculateSmpRevenue(generation.monthly_kwh, smpPrice);
  const monthlyRec = calculateRecRevenue(
    generation.monthly_kwh,
    recPrice,
    recWeight
  );
  const monthlyTotal = monthlySmp + monthlyRec;

  // 연간 수익
  const yearlySmp = calculateSmpRevenue(generation.yearly_kwh, smpPrice);
  const yearlyRec = calculateRecRevenue(
    generation.yearly_kwh,
    recPrice,
    recWeight
  );
  const yearlyTotal = yearlySmp + yearlyRec;

  return {
    monthly: { smp: monthlySmp, rec: monthlyRec, total: monthlyTotal },
    yearly: { smp: yearlySmp, rec: yearlyRec, total: yearlyTotal },
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
 * 통합 계산 함수
 * 모든 계산을 수행하고 RevenueCalculationResult 반환
 */
export function calculate(input: CalculatorInput): RevenueCalculationResult {
  // Step 1: 발전량 산출
  const generation = calculateGeneration(
    input.capacity_kw,
    input.utilization_rate
  );

  // Step 2: 수익 계산
  const revenue = calculateRevenue(
    generation,
    input.smp_price,
    input.rec_price,
    input.rec_weight
  );

  // Step 3: kWh당 단가 계산
  const unitPrice = calculateUnitPrice(
    input.smp_price,
    input.rec_price,
    input.rec_weight
  );

  return {
    input: {
      rec_price: input.rec_price,
      smp_price: input.smp_price,
      capacity_kw: input.capacity_kw,
      utilization_rate: input.utilization_rate,
      rec_weight: input.rec_weight,
    },
    generation,
    revenue,
    unit_price_per_kwh: unitPrice,
    disclaimer: DISCLAIMER,
  };
}
