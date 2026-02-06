import { BedrockAgentRuntimeClient } from "@aws-sdk/client-bedrock-agent-runtime";
import { fromIni } from "@aws-sdk/credential-providers";

// Knowledge Base 클라이언트 인스턴스 (싱글톤, 서울 리전)
let kbClient: BedrockAgentRuntimeClient | null = null;

/**
 * AWS Bedrock Agent Runtime 클라이언트 가져오기 (Knowledge Base용)
 * - AWS_PROFILE이 있으면: 로컬 개발용 (fromIni 사용)
 * - AWS_PROFILE이 없으면: EC2 IAM 역할 사용 (기본 credential chain)
 */
export function getKnowledgeBaseClient(): BedrockAgentRuntimeClient {
  if (!kbClient) {
    const region = process.env.AWS_REGION_SEOUL || "ap-northeast-2";
    const profile = process.env.AWS_PROFILE;

    // 로컬 개발: AWS_PROFILE 사용
    // EC2: IAM 역할 자동 사용 (credentials 생략)
    kbClient = new BedrockAgentRuntimeClient({
      region,
      ...(profile && { credentials: fromIni({ profile }) }),
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

/**
 * 태양광 발전 전문 챗봇 시스템 프롬프트
 */
export const SOLAR_CHATBOT_PROMPT = `
당신은 태양광 발전 전문 상담사입니다. 친근하고 전문적인 톤으로 답변하세요.

## 작성 스타일

- 자연스러운 대화체로 답변
- 핵심을 먼저 말하고, 필요시 세부 설명 추가
- 절차나 단계가 있으면 번호로 정리
- 비교가 필요하면 표 사용
- 300~400자 내외로 간결하게
- 마크다운 강조(**)는 사용하지 마세요

## 참조 표기 (필수)

- 답변 작성 시 실제 참조한 문서 번호를 기억하세요
- 답변 마지막에 반드시 다음 형식으로 참조 문서를 명시하세요:
  [REF:1,3,5] (쉼표로 구분, 공백 없이)
- 참조한 문서가 없으면 [REF:] 로 표기
- 이 태그는 시스템이 파싱하여 출처 표시에 사용합니다

<knowledge_base_results>
$search_results$
</knowledge_base_results>

위 자료를 기반으로 답변하세요. 답변 끝에 [REF:...] 태그를 반드시 포함하세요.
`.trim();
