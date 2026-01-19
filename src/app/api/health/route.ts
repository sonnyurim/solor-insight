import { withErrorHandler } from "@/lib/api/middleware";
import { apiSuccess } from "@/lib/api/response";

/**
 * GET /api/health
 * 서버 상태를 확인합니다.
 */
export const GET = withErrorHandler(async () => {
  return apiSuccess({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});
