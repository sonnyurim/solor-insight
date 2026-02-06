import { z } from "zod";
import {
  DEFAULT_UTILIZATION_RATE,
  DEFAULT_REC_WEIGHT_SMALL,
  VALIDATION_RANGES,
} from "@/constants/chat/calculator";

// 계산기 입력값 스키마
export const CalculatorInputSchema = z.object({
  rec_price: z
    .number()
    .min(
      VALIDATION_RANGES.rec_price.min,
      `REC 단가는 ${VALIDATION_RANGES.rec_price.min}원 이상이어야 합니다.`,
    )
    .max(
      VALIDATION_RANGES.rec_price.max,
      `REC 단가는 ${VALIDATION_RANGES.rec_price.max.toLocaleString()}원 이하여야 합니다.`,
    ),
  smp_price: z
    .number()
    .min(
      VALIDATION_RANGES.smp_price.min,
      `SMP 단가는 ${VALIDATION_RANGES.smp_price.min}원 이상이어야 합니다.`,
    )
    .max(
      VALIDATION_RANGES.smp_price.max,
      `SMP 단가는 ${VALIDATION_RANGES.smp_price.max}원/kWh 이하여야 합니다.`,
    ),
  capacity_kw: z
    .number()
    .min(
      VALIDATION_RANGES.capacity_kw.min,
      `설비용량은 ${VALIDATION_RANGES.capacity_kw.min}kW 이상이어야 합니다.`,
    )
    .max(
      VALIDATION_RANGES.capacity_kw.max,
      `설비용량은 ${VALIDATION_RANGES.capacity_kw.max.toLocaleString()}kW 이하여야 합니다.`,
    ),
  utilization_rate: z
    .number()
    .min(
      VALIDATION_RANGES.utilization_rate.min,
      "이용률은 0% 이상이어야 합니다.",
    )
    .max(
      VALIDATION_RANGES.utilization_rate.max,
      "이용률은 100% 이하여야 합니다.",
    )
    .default(DEFAULT_UTILIZATION_RATE),
  rec_weight: z
    .number()
    .min(
      VALIDATION_RANGES.rec_weight.min,
      `REC 가중치는 ${VALIDATION_RANGES.rec_weight.min} 이상이어야 합니다.`,
    )
    .max(
      VALIDATION_RANGES.rec_weight.max,
      `REC 가중치는 ${VALIDATION_RANGES.rec_weight.max} 이하여야 합니다.`,
    )
    .default(DEFAULT_REC_WEIGHT_SMALL),
});

// 추출된 파라미터 스키마 (부분적으로 존재할 수 있음)
export const ExtractedParametersSchema = z.object({
  rec_price: z.number().positive().optional(),
  smp_price: z.number().positive().optional(),
  capacity_kw: z.number().positive().optional(),
  utilization_rate: z.number().min(0).max(1).optional(),
  rec_weight: z.number().positive().optional(),
});

// 타입 추론
export type ValidatedCalculatorInput = z.infer<typeof CalculatorInputSchema>;
export type ValidatedExtractedParameters = z.infer<
  typeof ExtractedParametersSchema
>;

/**
 * 추출된 파라미터를 검증하고 기본값 적용
 */
export function validateAndApplyDefaults(
  extracted: z.infer<typeof ExtractedParametersSchema>,
) {
  // 필수값이 있는지 먼저 확인
  const withDefaults = {
    rec_price: extracted.rec_price,
    smp_price: extracted.smp_price,
    capacity_kw: extracted.capacity_kw,
    utilization_rate: extracted.utilization_rate ?? DEFAULT_UTILIZATION_RATE,
    rec_weight: extracted.rec_weight ?? DEFAULT_REC_WEIGHT_SMALL,
  };

  return CalculatorInputSchema.safeParse(withDefaults);
}
