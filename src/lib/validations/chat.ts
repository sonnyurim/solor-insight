import { z } from "zod";

// 의도 타입 스키마
export const IntentTypeSchema = z.enum([
  "GENERATION_TREND",
  "CALCULATOR",
  "PROCEDURE",
  "GENERAL",
]);

// 채팅 입력 스키마
export const ChatInputSchema = z.object({
  message: z
    .string()
    .min(1, "메시지를 입력해주세요.")
    .max(1000, "메시지는 1000자 이내로 입력해주세요."),
});

// LLM 응답 스키마
export const LLMResponseSchema = z.object({
  isMulti: z.boolean(),
  intents: z.array(IntentTypeSchema).min(1),
  reason: z.string(),
});

// 타입 추론
export type ChatInput = z.infer<typeof ChatInputSchema>;
export type LLMResponse = z.infer<typeof LLMResponseSchema>;
