import { BedrockAgentRuntimeClient } from "@aws-sdk/client-bedrock-agent-runtime";
import { fromIni } from "@aws-sdk/credential-providers";

// Knowledge Base 클라이언트 인스턴스 (싱글톤, 서울 리전)
let kbClient: BedrockAgentRuntimeClient | null = null;

/**
 * AWS Bedrock Agent Runtime 클라이언트 가져오기 (Knowledge Base용)
 * 서울 리전 전용
 */
export function getKnowledgeBaseClient(): BedrockAgentRuntimeClient {
  if (!kbClient) {
    const region = process.env.AWS_REGION_SEOUL || "ap-northeast-2";
    const profile = process.env.AWS_PROFILE;

    if (!profile) {
      throw new Error("AWS_PROFILE 환경변수가 설정되지 않았습니다.");
    }

    kbClient = new BedrockAgentRuntimeClient({
      region,
      credentials: fromIni({ profile }),
    });
  }
  return kbClient;
}

/**
 * Knowledge Base 설정
 * 서울 리전에서는 inference profile ARN을 사용해야 함
 */
export const KNOWLEDGE_BASE_CONFIG = {
  knowledgeBaseId: process.env.KNOWLEDGE_BASE_ID || "YIDMG6CKOA",
  modelArn:
    "arn:aws:bedrock:ap-northeast-2:730335373015:inference-profile/apac.anthropic.claude-3-5-sonnet-20241022-v2:0",
};
