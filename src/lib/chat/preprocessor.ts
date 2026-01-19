import { SYNONYM_MAP } from "@/constants/chat/synonyms";

// 불용어 목록
const STOPWORDS = ["음", "어", "그", "저", "아", "응", "네", "예", "좀", "요"];

/**
 * 텍스트 전처리
 * 1. 특수문자 제거
 * 2. 연속 공백 정리
 * 3. 소문자 변환 (영문)
 * 4. 불용어 제거
 * 5. 동의어 치환
 */
export function preprocess(input: string): string {
  let result = input;

  // 1. 특수문자 제거 (한글, 영문, 숫자, 공백만 유지)
  result = result.replace(/[^\uAC00-\uD7A3a-zA-Z0-9\s]/g, " ");

  // 2. 연속 공백 정리
  result = result.replace(/\s+/g, " ").trim();

  // 3. 소문자 변환 (영문)
  result = result.toLowerCase();

  // 4. 불용어 제거
  const words = result.split(" ");
  const filteredWords = words.filter((word) => {
    // 단독 불용어만 제거 (다른 단어에 포함된 경우 유지)
    return !STOPWORDS.includes(word);
  });
  result = filteredWords.join(" ");

  // 5. 동의어 치환
  const finalWords = result.split(" ").map((word) => {
    return SYNONYM_MAP.get(word) || word;
  });
  result = finalWords.join(" ");

  return result;
}

/**
 * 토큰화 (단어 분리)
 */
export function tokenize(text: string): string[] {
  return text.split(" ").filter((word) => word.length > 0);
}
