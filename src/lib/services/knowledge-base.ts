/**
 * Knowledge Base RAG 서비스
 * AWS Knowledge Bases를 활용한 질의응답 처리
 */

import {
  RetrieveAndGenerateCommand,
  type RetrieveAndGenerateCommandOutput,
} from "@aws-sdk/client-bedrock-agent-runtime";
import {
  getKnowledgeBaseClient,
  KNOWLEDGE_BASE_CONFIG,
} from "@/lib/bedrock/knowledge-base";
import type { RAGResponse, RAGCitation } from "@/lib/chat/types";

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

/**
 * 재시도 딜레이
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 응답에서 인용 정보 추출
 */
function extractCitations(
  response: RetrieveAndGenerateCommandOutput
): RAGCitation[] {
  const citations: RAGCitation[] = [];

  if (!response.citations) {
    return citations;
  }

  for (const citation of response.citations) {
    if (!citation.retrievedReferences) continue;

    for (const ref of citation.retrievedReferences) {
      const content = ref.content?.text;
      const sourceUri = ref.location?.s3Location?.uri;

      if (content) {
        citations.push({
          text: content,
          sourceUri: sourceUri || undefined,
        });
      }
    }
  }

  return citations;
}

/**
 * Knowledge Base에 질의
 * @param question 사용자 질문
 * @returns RAG 응답 (성공/실패, 답변, 인용 정보)
 */
export async function queryKnowledgeBase(
  question: string
): Promise<RAGResponse> {
  const client = getKnowledgeBaseClient();

  const command = new RetrieveAndGenerateCommand({
    input: { text: question },
    retrieveAndGenerateConfiguration: {
      type: "KNOWLEDGE_BASE",
      knowledgeBaseConfiguration: {
        knowledgeBaseId: KNOWLEDGE_BASE_CONFIG.knowledgeBaseId,
        modelArn: KNOWLEDGE_BASE_CONFIG.modelArn,
      },
    },
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.send(command);

      const answer = response.output?.text;

      if (!answer) {
        return {
          success: false,
          error: "Knowledge Base에서 응답을 받지 못했습니다.",
        };
      }

      const citations = extractCitations(response);

      return {
        success: true,
        answer,
        citations: citations.length > 0 ? citations : undefined,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(
        `Knowledge Base 쿼리 실패 (시도 ${attempt + 1}/${MAX_RETRIES + 1}):`,
        lastError.message
      );

      if (attempt < MAX_RETRIES) {
        await delay(RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }

  return {
    success: false,
    error: lastError?.message || "Knowledge Base 쿼리 중 오류가 발생했습니다.",
  };
}
