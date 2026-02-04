import type { IntentType, LLMClassificationResult } from "@/lib/chat/types";
import { invokeClaudeModel } from "@/lib/bedrock/client";
import { LLMResponseSchema } from "@/lib/validations/chat";

// 분류용 시스템 프롬프트
const CLASSIFIER_SYSTEM_PROMPT = `당신은 태양광 발전 정보 챗봇의 의도 분류기입니다.
사용자 질문을 분석하여 다음 중 하나 이상의 의도로 분류하세요.

## 의도 유형
- GENERATION_TREND: 발전량 추이/그래프/현황 조회
- CALCULATOR: REC/SMP 기반 수익 계산, 가격 조회
- PROCEDURE: 전력시장 참여 절차, 등록 방법
- GENERAL: 용어 설명, 인사, 기타

## 응답 형식 (JSON)
{
  "isMulti": boolean,  // 복합 의도 여부
  "intents": string[], // 의도 배열 (1개 이상)
  "reason": string     // 판단 이유 (한국어, 간단하게)
}

## 규칙
1. 복합 의도가 감지되면 isMulti를 true로 설정
2. intents 배열에는 감지된 모든 의도를 포함
3. 애매한 경우 GENERAL로 분류
4. JSON만 출력, 다른 텍스트 금지`;

/**
 * LLM 기반 의도 분류
 * AWS Bedrock Claude 3.5 Haiku 사용
 */
export async function classifyWithLLM(
  normalizedText: string,
  originalText: string,
  candidates: IntentType[]
): Promise<LLMClassificationResult> {
  const candidateHint =
    candidates.length > 0
      ? `\n참고: 키워드 분석 결과 후보 의도는 [${candidates.join(", ")}]입니다.`
      : "";

  const prompt = `사용자 질문: "${originalText}"
정규화된 텍스트: "${normalizedText}"${candidateHint}

위 질문의 의도를 분류하세요.`;

  try {
    const response = await invokeClaudeModel(prompt, CLASSIFIER_SYSTEM_PROMPT);

    // JSON 추출 (응답에 다른 텍스트가 있을 수 있음)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("LLM 응답에서 JSON을 찾을 수 없습니다.");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const validated = LLMResponseSchema.parse(parsed);

    return validated;
  } catch (error) {
    throw error;
  }
}
