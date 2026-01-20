import { NextRequest } from "next/server";
import { withValidation } from "@/lib/api/middleware";
import { apiSuccess, ApiErrors } from "@/lib/api/response";
import { handleCalculatorIntent } from "@/lib/services/calculator";
import { ChatInputSchema } from "@/lib/validations/chat";

/**
 * POST /api/chat/calculate
 * 수익 계산을 수행합니다.
 *
 * SRP: 요청 파싱 + 서비스 위임 + 응답 반환만 담당
 * DIP: CalculatorService를 통해 비즈니스 로직 처리
 */
export const POST = withValidation(
  ChatInputSchema,
  async (_request: NextRequest, _context, data) => {
    if (!data) {
      return ApiErrors.badRequest("요청 데이터가 없습니다.");
    }

    // 서비스에 위임
    const result = await handleCalculatorIntent(data.message);

    // 추가 질문 필요
    if (result.type === "question") {
      return apiSuccess({
        success: true,
        needsMoreInfo: true,
        followUpQuestion: result.message,
      });
    }

    // 계산 완료
    return apiSuccess({
      success: true,
      result: result.data,
      sources: result.sources,
    });
  }
);
