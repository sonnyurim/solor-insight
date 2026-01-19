// 동의어 사전
// 키: 표준어, 값: 동의어 배열
// 전처리 시 동의어를 표준어로 치환

export const SYNONYMS: Record<string, string[]> = {
  수익: ["돈", "이익", "매출", "벌이", "소득"],
  얼마: ["몇", "가격", "비용"],
  방법: ["어떻게", "하는법", "하는방법"],
  발전량: ["출력", "발전실적", "생산량"],
  추이: ["변화", "트렌드", "흐름"],
  절차: ["과정", "순서", "프로세스"],
  등록: ["신청", "가입", "신규"],
};

/**
 * 동의어를 표준어로 변환하는 맵 생성
 * { 동의어: 표준어 } 형태
 */
export function createSynonymMap(): Map<string, string> {
  const map = new Map<string, string>();

  for (const [standard, synonyms] of Object.entries(SYNONYMS)) {
    for (const synonym of synonyms) {
      map.set(synonym, standard);
    }
  }

  return map;
}

// 전역 동의어 맵 (캐싱)
export const SYNONYM_MAP = createSynonymMap();
