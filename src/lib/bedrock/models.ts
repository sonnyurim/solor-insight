// AWS Bedrock 모델 ID 상수
// 용도별로 모델을 분리하여 관리

export const BEDROCK_MODELS = {
  // 의도 분류용 - 단순 JSON 분류, 빠른 속도, 저비용
  // Cross-region inference profile 사용
  CLASSIFIER: "us.anthropic.claude-3-5-haiku-20241022-v1:0",

  // 응답 생성용 (추후 구현) - 복잡한 응답, 고품질 필요
  RESPONDER: "us.anthropic.claude-sonnet-4-20250514-v1:0",
} as const;

export type BedrockModelId =
  (typeof BEDROCK_MODELS)[keyof typeof BEDROCK_MODELS];
