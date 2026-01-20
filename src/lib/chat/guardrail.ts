import type { GuardrailType, GuardrailResult } from "@/lib/chat/types";
import { GUARDRAIL_MESSAGES } from "@/lib/chat/types";

// 가드레일 패턴 정의
interface GuardrailPattern {
  type: GuardrailType;
  patterns: RegExp[];
}

const GUARDRAIL_PATTERNS: GuardrailPattern[] = [
  {
    // 2016년 이전 데이터 요청
    type: "out_of_data_range",
    patterns: [
      /201[0-5]년/,
      /199\d년/,
      /198\d년/,
      /200\d년/,
      /\b(2015|2014|2013|2012|2011|2010|200\d|199\d)\b/,
    ],
  },
  {
    // 미래 예측 요청
    type: "future_prediction",
    patterns: [/내년/, /다음\s*해/, /예측/, /전망/, /앞으로/, /미래/, /내후년/],
  },
  {
    // 설비 상담 요청
    type: "equipment_consult",
    patterns: [
      /어떤\s*모듈/,
      /추천\s*업체/,
      /어떤\s*인버터/,
      /설치\s*업체/,
      /모듈\s*추천/,
      /패널\s*추천/,
    ],
  },
  {
    // 세금/법적 문의
    type: "legal_tax",
    patterns: [/세금/, /세무/, /법적/, /소송/, /세액/, /과세/, /탈세/, /법률/],
  },
  {
    // 직접 작업 요청
    type: "direct_task",
    patterns: [
      /작성해\s*줘/,
      /대신\s*해\s*줘/,
      /대신\s*해줘/,
      /작성해줘/,
      /만들어\s*줘/,
      /만들어줘/,
      /보고서\s*써/,
      /문서\s*작성/,
    ],
  },
  {
    // 불법/부정 요청
    type: "illegal",
    patterns: [/부풀리/, /허위/, /조작/, /편법/, /불법/, /탈루/, /사기/],
  },
  {
    // 타인 정보 요청
    type: "private_data",
    patterns: [
      /옆집/,
      /다른\s*사람/,
      /타인/,
      /남의/,
      /이웃/,
      /개인\s*정보/,
      /다른\s*집/,
    ],
  },
  {
    // 욕설/비속어
    type: "abuse",
    patterns: [
      /시발/,
      /씨발/,
      /병신/,
      /지랄/,
      /개새끼/,
      /꺼져/,
      /닥쳐/,
      /멍청/,
    ],
  },
];

/**
 * 가드레일 검사
 * 원본 입력을 대상으로 부적절한 질문을 차단
 */
export function checkGuardrail(input: string): GuardrailResult {
  for (const { type, patterns } of GUARDRAIL_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(input)) {
        return {
          blocked: true,
          type,
          message: GUARDRAIL_MESSAGES[type],
        };
      }
    }
  }

  return { blocked: false };
}
