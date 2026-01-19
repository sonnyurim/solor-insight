"use server";

import { classifyIntent } from "@/lib/chat/intent-classifier";
import { extractAndValidateParameters } from "@/lib/chat/parameter-extractor";
import { calculate } from "@/lib/chat/calculators";
import type { ClassificationResult, CalculatorProcessResult } from "@/lib/chat/types";
import { ChatInputSchema } from "@/lib/validations/chat";
import { CalculatorInputSchema } from "@/lib/validations/calculator";

/**
 * 메시지 분류 Server Action
 * 사용자 질문을 분석하여 의도를 분류합니다.
 */
export async function classifyMessageApi(
  message: string
): Promise<ClassificationResult> {
  try {
    // 입력값 검증
    const validation = ChatInputSchema.safeParse({ message });
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return {
        success: false,
        error: firstError?.message || "입력값이 유효하지 않습니다.",
      };
    }

    // 의도 분류 실행
    const result = await classifyIntent(validation.data.message);

    return result;
  } catch (error) {
    console.error("Server Action 오류:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "서버 오류가 발생했습니다.",
    };
  }
}

/**
 * 수익 계산기 처리 Server Action
 * CALCULATOR 의도가 확정되면 파라미터를 추출하고 계산을 수행합니다.
 */
export async function processCalculatorApi(
  message: string
): Promise<CalculatorProcessResult> {
  try {
    // 입력값 검증
    const validation = ChatInputSchema.safeParse({ message });
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return {
        success: false,
        error: firstError?.message || "입력값이 유효하지 않습니다.",
      };
    }

    // 파라미터 추출
    const extractionResult = extractAndValidateParameters(
      validation.data.message
    );

    // 필수값 누락 시 추가 질문 반환
    if (!extractionResult.complete) {
      return {
        success: true,
        needsMoreInfo: true,
        followUpQuestion: extractionResult.followUpQuestion,
        extracted: extractionResult.extracted,
      };
    }

    // 추출된 파라미터 검증
    const paramsValidation = CalculatorInputSchema.safeParse(
      extractionResult.params
    );
    if (!paramsValidation.success) {
      const firstError = paramsValidation.error.issues[0];
      return {
        success: false,
        error: firstError?.message || "입력값이 유효하지 않습니다.",
      };
    }

    // 계산 수행
    const calculationResult = calculate(paramsValidation.data);

    return {
      success: true,
      result: calculationResult,
    };
  } catch (error) {
    console.error("Calculator Server Action 오류:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "계산 중 오류가 발생했습니다.",
    };
  }
}
