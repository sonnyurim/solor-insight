import type { IntentType } from "@/lib/chat/types";

// 강한 구문 정의
// 이 구문이 포함되면 즉시 해당 시나리오로 확정 (신뢰도 HIGH)
export const STRONG_PHRASES: Record<
  Exclude<IntentType, "GENERAL">,
  string[]
> = {
  GENERATION_TREND: [
    "발전량 추이",
    "발전량 그래프",
    "발전량 현황",
    "출력 추이",
    "발전량 얼마",
    "발전량 비교",
    "그래프 그려",
    "그래프 보여",
    "차트 보여",
    "차트 그려",
    "월별 발전량",
    "시간별 발전량",
    "연간 발전량",
    "연도별 발전량",
    "계절별 발전량",
    "년 발전량",
  ],
  CALCULATOR: [
    "매출 계산",
    "수익 계산",
    "수익 얼마",
    "rec 얼마",
    "smp 얼마",
    "rec 단가",
    "smp 단가",
    "rec 가격",
    "smp 가격",
    // 구어체 추가 (Phase 1)
    "깔면 얼마",
    "돌리면 얼마",
    "나와",
    "벌어",
    // 기간 변형 (Phase 1)
    "월 수익",
    "연 수익",
    "하루 매출",
    "년 수익",
    // 역산형 추가 (Phase 2)
    "벌려면 몇",
    "목표 수익",
    "필요 용량",
    "kw 필요",
  ],
  PROCEDURE: [
    "참여 방법",
    "참여 절차",
    "등록 방법",
    "등록 절차",
    "신청 방법",
    "신청 절차",
    "어떻게 참여",
    "어떻게 등록",
    "rec 발급",
  ],
};

// ==================== 역산형 강한 구문 (Phase 2) ====================

/**
 * 역산형 감지 강한 구문
 * 이 구문이 포함되면 역산 모드로 확정
 */
export const REVERSE_PHRASES = [
  "벌려면 몇",
  "목표 수익",
  "필요 용량",
  "kw 필요",
  "mw 필요",
  "얼마나 깔아야",
  "설비 얼마나",
] as const;

/**
 * 모든 강한 구문을 의도와 매핑
 */
export function createPhraseMap(): Map<string, Exclude<IntentType, "GENERAL">> {
  const map = new Map<string, Exclude<IntentType, "GENERAL">>();

  for (const [intent, phrases] of Object.entries(STRONG_PHRASES)) {
    for (const phrase of phrases) {
      map.set(phrase, intent as Exclude<IntentType, "GENERAL">);
    }
  }

  return map;
}

// 전역 구문 맵 (캐싱)
export const PHRASE_MAP = createPhraseMap();

// 모든 강한 구문 목록 (검색용)
export const ALL_PHRASES = Object.values(STRONG_PHRASES).flat();
