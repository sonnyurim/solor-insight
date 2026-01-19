import { NextRequest } from "next/server";
import { ZodSchema, ZodError } from "zod";
import { ApiError } from "./errors";
import { ApiErrors } from "./response";

type RouteHandler<T = unknown> = (
  request: NextRequest,
  context: { params: Promise<Record<string, string>> },
  validatedData?: T
) => Promise<Response>;

/**
 * Zod 에러를 필드별 에러 메시지로 변환
 */
function formatZodErrors(error: ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  error.errors.forEach((err) => {
    const path = err.path.join(".");
    if (!details[path]) details[path] = [];
    details[path].push(err.message);
  });
  return details;
}

/**
 * Route Handler 공통 에러 핸들러 래퍼
 * 
 * @example
 * export const GET = withErrorHandler(async (request) => {
 *   const data = await fetchData();
 *   return apiSuccess(data);
 * });
 */
export function withErrorHandler<T = unknown>(handler: RouteHandler<T>) {
  return async (
    request: NextRequest,
    context: { params: Promise<Record<string, string>> }
  ) => {
    try {
      return await handler(request, context);
    } catch (error) {
      console.error("[API Error]", {
        path: request.nextUrl.pathname,
        method: request.method,
        error: error instanceof Error ? error.message : error,
      });

      if (error instanceof ApiError) {
        return ApiErrors.badRequest(error.message, error.details);
      }
      if (error instanceof ZodError) {
        return ApiErrors.validationError(formatZodErrors(error));
      }
      return ApiErrors.internalError();
    }
  };
}

/**
 * 유효성 검증 래퍼
 * Zod 스키마로 요청 body를 검증하고 핸들러에 전달
 * 
 * @example
 * export const POST = withValidation(
 *   createUserSchema,
 *   async (request, context, data) => {
 *     const user = await createUser(data);
 *     return apiSuccess(user, 201);
 *   }
 * );
 */
export function withValidation<T>(
  schema: ZodSchema<T>,
  handler: RouteHandler<T>
) {
  return withErrorHandler(async (request, context) => {
    const body = await request.json();
    const validatedData = schema.parse(body);
    return handler(request, context, validatedData);
  });
}

