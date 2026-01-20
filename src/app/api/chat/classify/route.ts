import { NextRequest } from "next/server";
import { withValidation } from "@/lib/api/middleware";
import { apiSuccess, ApiErrors } from "@/lib/api/response";
import { classifyIntent } from "@/lib/chat/intent-classifier";
import { ChatInputSchema } from "@/lib/validations/chat";

/**
 * POST /api/chat/classify
 * 사용자 메시지의 의도를 분류합니다.
 *
 * SRP: 요청 파싱 + 함수 위임 + 응답 반환만 담당
 */
export const POST = withValidation(
  ChatInputSchema,
  async (_request: NextRequest, _context, data) => {
    if (!data) {
      return ApiErrors.badRequest("요청 데이터가 없습니다.");
    }

    // 의도 분류 호출
    const result = await classifyIntent(data.message);

    if (!result.success) {
      return ApiErrors.internalError(result.error);
    }

    return apiSuccess(result);
  }
);
