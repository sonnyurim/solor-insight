import { NextRequest } from "next/server";
import { withValidation } from "@/lib/api/middleware";
import { apiSuccess, ApiErrors } from "@/lib/api/response";
import { extractAndValidateParameters } from "@/lib/chat/parameter-extractor";
import { calculate } from "@/lib/chat/calculators";
import { ChatInputSchema } from "@/lib/validations/chat";
import { CalculatorInputSchema } from "@/lib/validations/calculator";

/**
 * POST /api/chat/calculate
 * 수익 계산을 수행합니다.
 */
export const POST = withValidation(
  ChatInputSchema,
  async (request: NextRequest, context, data) => {
    // 파라미터 추출
    const extractionResult = extractAndValidateParameters(data.message);

    // 필수값 누락 시 추가 질문 반환
    if (!extractionResult.complete) {
      return apiSuccess({
        success: true,
        needsMoreInfo: true,
        followUpQuestion: extractionResult.followUpQuestion,
        extracted: extractionResult.extracted,
      });
    }

    // 추출된 파라미터 검증
    const paramsValidation = CalculatorInputSchema.safeParse(
      extractionResult.params
    );
    if (!paramsValidation.success) {
      const firstError = paramsValidation.error.issues[0];
      return ApiErrors.validationError({
        params: [firstError?.message || "입력값이 유효하지 않습니다."],
      });
    }

    // 계산 수행
    const calculationResult = calculate(paramsValidation.data);

    return apiSuccess({
      success: true,
      result: calculationResult,
    });
  }
);
