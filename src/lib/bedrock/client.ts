import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { fromIni } from "@aws-sdk/credential-providers";
import { BEDROCK_MODELS } from "./models";

// AWS Bedrock Runtime 클라이언트 인스턴스 (싱글톤)
let client: BedrockRuntimeClient | null = null;

/**
 * AWS Bedrock Runtime 클라이언트 가져오기
 * - AWS_PROFILE이 있으면: 로컬 개발용 (fromIni 사용)
 * - AWS_PROFILE이 없으면: EC2 IAM 역할 사용 (기본 credential chain)
 */
export function getBedrockClient(): BedrockRuntimeClient {
  if (!client) {
    const region = process.env.AWS_REGION;
    const profile = process.env.AWS_PROFILE;

    if (!region) {
      throw new Error("AWS_REGION 환경변수가 설정되지 않았습니다.");
    }

    // 로컬 개발: AWS_PROFILE 사용
    // EC2: IAM 역할 자동 사용 (credentials 생략)
    client = new BedrockRuntimeClient({
      region,
      ...(profile && { credentials: fromIni({ profile }) }),
    });
  }
  return client;
}

/**
 * 모델 유형 판별
 */
function getModelType(modelId: string): "claude" | "qwen" {
  if (modelId.includes("anthropic") || modelId.includes("claude")) {
    return "claude";
  }
  if (modelId.includes("qwen")) {
    return "qwen";
  }
  // 기본값: qwen (현재 CLASSIFIER가 qwen이므로)
  return "qwen";
}

/**
 * Qwen 모델용 페이로드 생성
 */
function createQwenPayload(prompt: string, systemPrompt?: string) {
  const messages: Array<{ role: string; content: string }> = [];
  
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  return {
    messages,
    max_tokens: 1000,
    temperature: 0.7,
    top_p: 0.9,
  };
}

/**
 * Claude 모델용 페이로드 생성
 */
function createClaudePayload(prompt: string, systemPrompt?: string) {
  return {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 1000,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: prompt }],
      },
    ],
  };
}

/**
 * Qwen 응답 파싱
 */
function parseQwenResponse(responseBody: Record<string, unknown>): string {
  // Qwen 응답 형식: { choices: [{ message: { content: "..." } }] }
  const choices = responseBody.choices as Array<{
    message?: { content?: string };
    text?: string;
  }> | undefined;

  if (choices && choices.length > 0) {
    const choice = choices[0];
    // OpenAI 호환 형식
    if (choice.message?.content) {
      return choice.message.content;
    }
    // 텍스트 직접 반환 형식
    if (choice.text) {
      return choice.text;
    }
  }

  // 대안: output 필드 확인
  if (typeof responseBody.output === "string") {
    return responseBody.output;
  }

  // 대안: generation 필드 확인
  if (typeof responseBody.generation === "string") {
    return responseBody.generation;
  }

  throw new Error(
    (responseBody.error as { message?: string })?.message ||
    (responseBody.message as string) ||
    "Qwen 응답에서 텍스트를 찾을 수 없습니다."
  );
}

/**
 * Claude 응답 파싱
 */
function parseClaudeResponse(responseBody: Record<string, unknown>): string {
  const content = responseBody.content as Array<{
    type: string;
    text?: string;
  }> | undefined;

  if (!content || !Array.isArray(content) || content.length === 0) {
    throw new Error(
      (responseBody.error as { message?: string })?.message ||
      (responseBody.message as string) ||
      "Claude 응답에서 content를 찾을 수 없습니다."
    );
  }

  const textContent = content.find((item) => item.type === "text");

  if (!textContent?.text) {
    throw new Error("Claude 응답에서 텍스트 콘텐츠를 찾을 수 없습니다.");
  }

  return textContent.text;
}

/**
 * Bedrock 모델 호출 (Claude, Qwen 모두 지원)
 */
export async function invokeBedrockModel(
  prompt: string,
  systemPrompt?: string,
  modelId: string = BEDROCK_MODELS.CLASSIFIER
): Promise<string> {
  const bedrockClient = getBedrockClient();
  const modelType = getModelType(modelId);

  // 모델 유형에 따른 페이로드 생성
  const payload =
    modelType === "claude"
      ? createClaudePayload(prompt, systemPrompt)
      : createQwenPayload(prompt, systemPrompt);

  const command = new InvokeModelCommand({
    contentType: "application/json",
    body: JSON.stringify(payload),
    modelId,
  });

  const response = await bedrockClient.send(command);

  // 응답 디코딩
  const decodedBody = new TextDecoder().decode(response.body);
  const responseBody = JSON.parse(decodedBody) as Record<string, unknown>;

  // 모델 유형에 따른 응답 파싱
  return modelType === "claude"
    ? parseClaudeResponse(responseBody)
    : parseQwenResponse(responseBody);
}

/**
 * @deprecated invokeBedrockModel을 사용하세요
 */
export const invokeClaudeModel = invokeBedrockModel;
