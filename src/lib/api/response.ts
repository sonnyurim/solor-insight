import { NextResponse } from "next/server";

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

/**
 * 성공 응답 생성
 */
export function apiSuccess<T>(data: T, status = 200, message?: string) {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
    ...(message && { message }),
  };
  return NextResponse.json(response, { status });
}

/**
 * 에러 응답 생성
 */
export function apiError(
  code: string,
  message: string,
  status = 400,
  details?: Record<string, string[]>
) {
  const response: ApiErrorResponse = {
    success: false,
    error: { code, message, ...(details && { details }) },
  };
  return NextResponse.json(response, { status });
}

/**
 * 자주 사용하는 에러 응답
 */
export const ApiErrors = {
  badRequest: (message = "잘못된 요청입니다", details?: Record<string, string[]>) =>
    apiError("BAD_REQUEST", message, 400, details),
  unauthorized: (message = "인증이 필요합니다") =>
    apiError("UNAUTHORIZED", message, 401),
  forbidden: (message = "권한이 없습니다") =>
    apiError("FORBIDDEN", message, 403),
  notFound: (message = "리소스를 찾을 수 없습니다") =>
    apiError("NOT_FOUND", message, 404),
  conflict: (message = "이미 존재하는 리소스입니다") =>
    apiError("CONFLICT", message, 409),
  validationError: (details: Record<string, string[]>) =>
    apiError("VALIDATION_ERROR", "유효성 검증 실패", 422, details),
  internalError: (message = "서버 오류가 발생했습니다") =>
    apiError("INTERNAL_ERROR", message, 500),
};
