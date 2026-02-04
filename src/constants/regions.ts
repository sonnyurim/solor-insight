/**
 * 광역시도 목록 (17개)
 * 이 목록에 포함된 지역은 실제 데이터(actual)로 조회 (is_estimated = false)
 * 포함되지 않은 지역(시군구)은 추정 데이터(estimated)로 조회 (is_estimated = true)
 */
export const SIDO_LIST = [
  '서울특별시',
  '부산광역시',
  '대구광역시',
  '인천광역시',
  '광주광역시',
  '대전광역시',
  '울산광역시',
  '세종특별자치시',
  '경기도',
  '강원특별자치도',
  '충청북도',
  '충청남도',
  '전북특별자치도',
  '전라남도',
  '경상북도',
  '경상남도',
  '제주특별자치도',
] as const;

export type SidoName = (typeof SIDO_LIST)[number];

/**
 * 광역시도 여부 확인
 */
export function isSido(region: string): boolean {
  return SIDO_LIST.includes(region as SidoName);
}
