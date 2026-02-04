/**
 * 날짜 관련 유틸리티 함수
 */

export type SeasonKr = '봄' | '여름' | '가을' | '겨울';

/**
 * 현재 계절 반환 (한글)
 * 봄: 3-5월, 여름: 6-8월, 가을: 9-11월, 겨울: 12-2월
 */
export function getCurrentSeason(): SeasonKr {
  const month = new Date().getMonth() + 1;

  if ([3, 4, 5].includes(month)) return '봄';
  if ([6, 7, 8].includes(month)) return '여름';
  if ([9, 10, 11].includes(month)) return '가을';
  return '겨울';
}

/**
 * 현재 연도 반환
 */
export function getCurrentYear(): number {
  return new Date().getFullYear();
}

/**
 * 계절을 월 범위로 변환
 */
export function getSeasonMonthRange(season: SeasonKr): { start: number; end: number } {
  switch (season) {
    case '봄':
      return { start: 3, end: 5 };
    case '여름':
      return { start: 6, end: 8 };
    case '가을':
      return { start: 9, end: 11 };
    case '겨울':
      return { start: 12, end: 2 };
  }
}

/**
 * 계절 한글 → 영문 변환
 */
export function seasonKrToEn(season: SeasonKr): string {
  const map: Record<SeasonKr, string> = {
    '봄': 'spring',
    '여름': 'summer',
    '가을': 'fall',
    '겨울': 'winter',
  };
  return map[season];
}

/**
 * 해당 계절이 현재 시점에서 이미 끝났는지 확인
 * - 봄(3-5월): 6월 이후면 끝남
 * - 여름(6-8월): 9월 이후면 끝남
 * - 가을(9-11월): 12월 이후면 끝남
 * - 겨울(12-2월): 3월 이후면 끝남
 */
export function isSeasonPassed(season: SeasonKr): boolean {
  const currentMonth = new Date().getMonth() + 1;
  const range = getSeasonMonthRange(season);
  
  // 겨울은 특수 처리 (12월~2월, 3월 이후면 끝남)
  if (season === '겨울') {
    return currentMonth >= 3 && currentMonth <= 11;
  }
  
  return currentMonth > range.end;
}

/**
 * 월(1-12)로부터 계절 반환
 */
export function getSeasonFromMonth(month: number): SeasonKr {
  if ([3, 4, 5].includes(month)) return '봄';
  if ([6, 7, 8].includes(month)) return '여름';
  if ([9, 10, 11].includes(month)) return '가을';
  return '겨울';
}
