/**
 * API 에러 클래스
 * Route Handler에서 발생하는 에러를 일관되게 처리
 */
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
    public details?: Record<string, string[]>
  ) {
    super(message);
    this.name = "ApiError";
  }

  static badRequest(message: string, details?: Record<string, string[]>) {
    return new ApiError("BAD_REQUEST", message, 400, details);
  }

  static unauthorized(message = "인증이 필요합니다") {
    return new ApiError("UNAUTHORIZED", message, 401);
  }

  static forbidden(message = "권한이 없습니다") {
    return new ApiError("FORBIDDEN", message, 403);
  }

  static notFound(message = "리소스를 찾을 수 없습니다") {
    return new ApiError("NOT_FOUND", message, 404);
  }

  static conflict(message = "이미 존재하는 리소스입니다") {
    return new ApiError("CONFLICT", message, 409);
  }

  static internal(message = "서버 오류가 발생했습니다") {
    return new ApiError("INTERNAL_ERROR", message, 500);
  }
}
