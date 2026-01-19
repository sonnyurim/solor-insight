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
 * 환경변수 기반 인증 사용
 */
export function getBedrockClient(): BedrockRuntimeClient {
  if (!client) {
    const region = process.env.AWS_REGION;
    const profile = process.env.AWS_PROFILE;

    if (!region) {
      throw new Error("AWS_REGION 환경변수가 설정되지 않았습니다.");
    }

    if (!profile) {
      throw new Error("AWS_PROFILE 환경변수가 설정되지 않았습니다.");
    }

    client = new BedrockRuntimeClient({
      region,
      credentials: fromIni({ profile }),
    });
  }
  return client;
}

/**
 * Anthropic Claude 모델 호출
 */
export async function invokeClaudeModel(
  prompt: string,
  systemPrompt?: string,
  modelId: string = BEDROCK_MODELS.CLASSIFIER
): Promise<string> {
  const bedrockClient = getBedrockClient();

  // Claude Messages API 페이로드
  const payload = {
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

  const command = new InvokeModelCommand({
    contentType: "application/json",
    body: JSON.stringify(payload),
    modelId,
  });

  const response = await bedrockClient.send(command);

  // 응답 디코딩
  const decodedBody = new TextDecoder().decode(response.body);
  const responseBody = JSON.parse(decodedBody);

  return responseBody.content[0].text;
}
