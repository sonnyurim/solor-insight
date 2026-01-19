import { NextRequest } from "next/server";
import { withValidation } from "@/lib/api/middleware";
import { apiSuccess, ApiErrors } from "@/lib/api/response";
import { classifyIntent } from "@/lib/chat/intent-classifier";
import { ChatInputSchema } from "@/lib/validations/chat";

/**
 * POST /api/chat/classify
 * 사용자 메시지의 의도를 분류합니다.
 */
export const POST = withValidation(
  ChatInputSchema,
  async (request: NextRequest, context, data) => {
    const result = await classifyIntent(data.message);

    if (!result.success) {
      return ApiErrors.internalError(result.error);
    }

    return apiSuccess(result);
  }
);
