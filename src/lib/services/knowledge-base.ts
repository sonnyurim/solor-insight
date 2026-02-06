/**
 * Knowledge Base RAG 서비스
 * AWS Knowledge Bases를 활용한 질의응답 처리
 *
 * 검색 단계:
 * - 벡터 검색 (KNN): Cosine Similarity
 * - 키워드 검색 (BM25): Nori 분석기 + 동의어 (OpenSearch Serverless)
 * - 점수 정규화: 0~1로 정규화
 * - 결합: vector_weight로 가중 평균 (기본 0.5)
 */

import {
  RetrieveCommand,
  type RetrieveCommandOutput,
  type RetrievedReference,
} from "@aws-sdk/client-bedrock-agent-runtime";

/**
 * RetrieveCommand 결과의 실제 타입 (score 포함)
 * AWS SDK의 KnowledgeBaseRetrievalResult 타입이 export되지 않아 직접 정의
 */
type RetrievalResultWithScore = RetrievedReference & {
  score?: number;
};
import {
  getKnowledgeBaseClient,
  KNOWLEDGE_BASE_CONFIG,
  SOLAR_CHATBOT_PROMPT,
} from "@/lib/bedrock/knowledge-base";
import { invokeBedrockModel } from "@/lib/bedrock/client";
import { BEDROCK_MODELS } from "@/lib/bedrock/models";
import type { RAGResponse, RAGCitation } from "@/lib/chat/types";
import type { ChatHistoryMessage } from "@/lib/chat/actions";

// ==================== 설정 상수 ====================

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

/**
 * 하이브리드 검색 설정
 */
const HYBRID_SEARCH_CONFIG = {
  /** 검색 결과 최대 개수 */
  numberOfResults: 10,
  /**
   * 벡터 검색 가중치 (0~1)
   * - 0: BM25(키워드) 검색만 사용
   * - 0.5: 벡터와 키워드 동일 비중 (기본값)
   * - 1: 벡터 검색만 사용
   */
  vectorWeight: 0.5,
  /** 최소 관련성 점수 (0~1) - 이 점수 미만은 필터링 (0으로 설정하면 필터링 없음) */
  minRelevanceScore: 0,
};

// ==================== 유틸리티 함수 ====================

/**
 * 재시도 딜레이
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * LLM 응답에서 참조 문서 번호 파싱
 * 형식: [REF:1,3,5] 또는 [REF:]
 *
 * @param answer LLM 응답 텍스트
 * @returns cleanAnswer: [REF:...] 태그 제거된 답변, refIndices: 참조 문서 인덱스 (0-based)
 */
function parseReferencesFromAnswer(answer: string): {
  cleanAnswer: string;
  refIndices: number[];
} {
  // [REF:1,3,5] 또는 [REF:] 패턴 매칭
  const refPattern = /\[REF:([0-9,]*)\]/i;
  const match = answer.match(refPattern);

  if (!match) {
    // 참조 태그가 없으면 빈 배열 반환 (fallback 처리 필요)
    console.log("[RAG:Parse] 참조 태그 없음, fallback 적용");
    return {
      cleanAnswer: answer.trim(),
      refIndices: [],
    };
  }

  // [REF:...] 태그 제거
  const cleanAnswer = answer.replace(refPattern, "").trim();

  // 문서 번호 파싱 (1-based -> 0-based 변환)
  const refString = match[1];
  const refIndices: number[] = [];

  if (refString) {
    const numbers = refString.split(",").filter((s) => s.trim() !== "");
    for (const numStr of numbers) {
      const num = parseInt(numStr.trim(), 10);
      if (!isNaN(num) && num > 0) {
        refIndices.push(num - 1); // 1-based to 0-based
      }
    }
  }

  console.log("[RAG:Parse] 참조 문서 인덱스:", refIndices);

  return {
    cleanAnswer,
    refIndices,
  };
}

/**
 * 검색 결과에서 인용 정보 추출
 */
function extractCitationsFromRetrieveResults(
  results: RetrievalResultWithScore[],
): RAGCitation[] {
  const citations: RAGCitation[] = [];

  for (const ref of results) {
    const content = ref.content?.text;
    const sourceUri = ref.location?.s3Location?.uri;

    // AWS Bedrock KB 메타데이터에서 PDF 페이지 번호 추출 (2024.11부터 지원)
    const metadata = ref.metadata as Record<string, unknown> | undefined;
    const pageNumber = metadata?.["x-amz-bedrock-kb-document-page-number"];

    if (content) {
      citations.push({
        text: content,
        sourceUri: sourceUri || undefined,
        pageNumber: typeof pageNumber === "number" ? pageNumber : undefined,
      });
    }
  }

  return citations;
}

/**
 * 대화 기록을 컨텍스트 문자열로 변환
 */
function formatConversationHistory(history?: ChatHistoryMessage[]): string {
  if (!history || history.length === 0) {
    return "";
  }

  const formatted = history
    .map((msg) => {
      const role = msg.role === "user" ? "사용자" : "봇";
      // 답변이 너무 길면 앞부분만 포함 (토큰 절약)
      const content =
        msg.content.length > 300
          ? msg.content.slice(0, 300) + "..."
          : msg.content;
      return `${role}: ${content}`;
    })
    .join("\n");

  return `<conversation_history>
${formatted}
</conversation_history>

`;
}

/**
 * 검색 결과를 컨텍스트 문자열로 변환
 */
function formatSearchResultsAsContext(results: RetrievalResultWithScore[]): string {
  if (results.length === 0) {
    return "관련 문서를 찾지 못했습니다.";
  }

  return results
    .map((ref, idx) => {
      const content = ref.content?.text || "";
      const sourceUri = ref.location?.s3Location?.uri;
      const metadata = ref.metadata as Record<string, unknown> | undefined;
      const score = metadata?.["score"] || ref.score;

      // 출처 정보 포맷
      let sourceInfo = "";
      if (sourceUri) {
        const fileName = sourceUri.split("/").pop() || sourceUri;
        sourceInfo = ` (출처: ${fileName})`;
      }

      return `[문서 ${idx + 1}]${sourceInfo}${score ? ` (관련도: ${(Number(score) * 100).toFixed(0)}%)` : ""}\n${content}`;
    })
    .join("\n\n---\n\n");
}

// ==================== 검색 함수 ====================

/**
 * Knowledge Base에서 하이브리드 검색 수행
 * - 벡터 검색 (Cosine Similarity) + 키워드 검색 (BM25)
 * - 점수 정규화 후 가중 평균으로 결합
 */
async function retrieveFromKnowledgeBase(
  query: string,
): Promise<{ results: RetrievalResultWithScore[]; error?: string }> {
  const client = getKnowledgeBaseClient();

  const command = new RetrieveCommand({
    knowledgeBaseId: KNOWLEDGE_BASE_CONFIG.knowledgeBaseId,
    retrievalQuery: { text: query },
    retrievalConfiguration: {
      vectorSearchConfiguration: {
        numberOfResults: HYBRID_SEARCH_CONFIG.numberOfResults,
        // SEMANTIC: 벡터 검색 (Cosine Similarity)
        // 참고: HYBRID는 OpenSearch Serverless Collection 설정에서 활성화 필요
        overrideSearchType: "SEMANTIC",
      },
    },
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response: RetrieveCommandOutput = await client.send(command);

      const results = response.retrievalResults || [];

      // 디버깅: 검색 결과 로깅
      console.log("[RAG:Retrieve] Query:", query);
      console.log("[RAG:Retrieve] Results count:", results.length);

      if (results.length > 0) {
        console.log(
          "[RAG:Retrieve] Top result score:",
          results[0].score || "N/A",
        );
        console.log(
          "[RAG:Retrieve] Top result preview:",
          results[0].content?.text?.slice(0, 150),
        );
      }

      // 최소 관련성 점수 필터링
      const filteredResults = results.filter((r) => {
        const score = r.score ?? 1; // score가 없으면 포함
        return score >= HYBRID_SEARCH_CONFIG.minRelevanceScore;
      });

      console.log(
        "[RAG:Retrieve] Filtered results count:",
        filteredResults.length,
      );

      return {
        results: filteredResults.map((r) => ({
          content: r.content,
          location: r.location,
          metadata: r.metadata,
          score: r.score,
        })),
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(
        `Knowledge Base 검색 실패 (시도 ${attempt + 1}/${MAX_RETRIES + 1}):`,
        lastError.message,
      );

      if (attempt < MAX_RETRIES) {
        await delay(RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }

  return {
    results: [],
    error: lastError?.message || "Knowledge Base 검색 중 오류가 발생했습니다.",
  };
}

// ==================== 생성 함수 ====================

/**
 * 검색 결과를 기반으로 LLM 응답 생성
 * @param question 사용자 질문
 * @param searchResults 검색 결과
 * @param history 이전 대화 기록 (최대 6개, 3턴)
 */
async function generateAnswer(
  question: string,
  searchResults: RetrievalResultWithScore[],
  history?: ChatHistoryMessage[],
): Promise<{ answer: string; error?: string }> {
  // 검색 결과를 컨텍스트로 변환
  const context = formatSearchResultsAsContext(searchResults);

  // 대화 기록 포맷
  const conversationHistory = formatConversationHistory(history);

  // 시스템 프롬프트에 검색 결과 삽입
  let systemPrompt = SOLAR_CHATBOT_PROMPT.replace("$search_results$", context);

  // 대화 기록이 있으면 프롬프트에 추가
  if (conversationHistory) {
    systemPrompt = systemPrompt + "\n\n" + conversationHistory;
    console.log("[RAG:Generate] 대화 기록 포함:", history?.length, "개 메시지");
  }

  // 사용자 질문
  const userPrompt = question;

  try {
    const answer = await invokeBedrockModel(
      userPrompt,
      systemPrompt,
      BEDROCK_MODELS.RESPONDER,
    );

    console.log("[RAG:Generate] Answer preview:", answer.slice(0, 200));

    return { answer };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "응답 생성 중 오류 발생";
    console.error("[RAG:Generate] Error:", errorMessage);
    return { answer: "", error: errorMessage };
  }
}

// ==================== 메인 함수 ====================

/**
 * Knowledge Base에 질의 (검색 + 생성 분리)
 *
 * 1. 하이브리드 검색 (벡터 + BM25)
 * 2. 검색 결과를 컨텍스트로 LLM에 전달
 * 3. 응답 생성
 *
 * @param question 사용자 질문
 * @param history 이전 대화 기록 (최대 6개, 3턴)
 * @returns RAG 응답 (성공/실패, 답변, 인용 정보)
 */
export async function queryKnowledgeBase(
  question: string,
  history?: ChatHistoryMessage[],
): Promise<RAGResponse> {
  console.log("[RAG] ===== RAG 파이프라인 시작 =====");
  console.log("[RAG] Question:", question);
  console.log("[RAG] History length:", history?.length || 0);

  // 1. 검색 단계
  console.log("[RAG] Step 1: 하이브리드 검색 수행...");
  const retrieveResult = await retrieveFromKnowledgeBase(question);

  if (retrieveResult.error || retrieveResult.results.length === 0) {
    console.log("[RAG] 검색 결과 없음 또는 에러");
    return {
      success: false,
      error:
        retrieveResult.error ||
        "관련 문서를 찾지 못했습니다. 다른 표현으로 질문해 주세요.",
    };
  }

  // 2. 응답 생성 단계 (대화 기록 포함)
  console.log("[RAG] Step 2: LLM 응답 생성...");
  const generateResult = await generateAnswer(
    question,
    retrieveResult.results,
    history,
  );

  if (generateResult.error || !generateResult.answer) {
    return {
      success: false,
      error: generateResult.error || "응답 생성에 실패했습니다.",
    };
  }

  // 3. 응답에서 참조 문서 파싱 및 citation 필터링
  console.log("[RAG] Step 3: 참조 문서 파싱...");
  const { cleanAnswer, refIndices } = parseReferencesFromAnswer(
    generateResult.answer,
  );

  let citations: RAGCitation[];

  if (refIndices.length > 0) {
    // LLM이 명시한 문서만 citation으로 사용
    const referencedResults = refIndices
      .map((i) => retrieveResult.results[i])
      .filter((r): r is NonNullable<typeof r> => r !== undefined);

    // 정확도(score) 높은 순으로 정렬
    referencedResults.sort((a, b) => {
      const scoreA = a.score ?? 0;
      const scoreB = b.score ?? 0;
      return scoreB - scoreA; // 내림차순
    });

    citations = extractCitationsFromRetrieveResults(referencedResults);
    console.log(
      "[RAG] LLM 참조 기반 citations:",
      citations.length,
      "개 (정확도순 정렬됨)",
    );
  } else {
    // Fallback: 참조 태그가 없으면 상위 3개 문서 사용
    const fallbackResults = retrieveResult.results.slice(0, 3);
    citations = extractCitationsFromRetrieveResults(fallbackResults);
    console.log("[RAG] Fallback citations (상위 3개):", citations.length, "개");
  }

  console.log("[RAG] ===== RAG 파이프라인 완료 =====");

  return {
    success: true,
    answer: cleanAnswer,
    citations: citations.length > 0 ? citations : undefined,
  };
}
