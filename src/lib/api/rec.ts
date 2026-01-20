/**
 * REC 현물시장 최신가 조회
 * 공공데이터포털 API 활용
 *
 * API 스펙:
 * - URL: https://apis.data.go.kr/B552115/RecMarketInfo2/getRecMarketInfo2
 * - Method: GET
 * - 응답: JSON
 *
 * 주요 응답 필드:
 * - landAvgPrc: 육지 평균가
 * - jejuAvgPrc: 제주 평균가
 * - clsPrc: 종가
 * - bzDd: 거래일 (YYYYMMDD)
 */

export type RecRegionType = "육지" | "제주";

export interface RecPriceResult {
  price: number;
  date: string; // YYYYMMDD
  region: RecRegionType;
}

// ==================== 인터페이스 정의 (DIP) ====================

/**
 * REC Repository 인터페이스
 * 테스트 시 Mock 주입 용이
 */
export interface IRecRepository {
  getLatestPrice(region: RecRegionType): Promise<RecPriceResult | null>;
}

// ==================== Repository 구현 ====================

const REC_API_URL =
  "https://apis.data.go.kr/B552115/RecMarketInfo2/getRecMarketInfo2";

/**
 * REC Repository 구현체
 * 공공데이터포털 API를 통해 REC 가격 조회
 */
export class RecRepository implements IRecRepository {
  private apiKey: string | undefined;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.DATA_GO_KR_API_KEY;
  }

  /**
   * REC 현물시장 최신가 조회
   * API가 오래된 순서로 정렬되어 있어 마지막 페이지에서 최신 데이터를 가져옴
   */
  async getLatestPrice(
    region: RecRegionType = "육지"
  ): Promise<RecPriceResult | null> {
    if (!this.apiKey) {
      console.warn("DATA_GO_KR_API_KEY 환경변수가 설정되지 않았습니다.");
      return null;
    }

    try {
      // 1단계: totalCount 조회를 위한 첫 번째 요청
      const countParams = new URLSearchParams({
        serviceKey: this.apiKey,
        pageNo: "1",
        numOfRows: "1",
        dataType: "json",
      });

      const countRes = await fetch(`${REC_API_URL}?${countParams}`, {
        next: { revalidate: 86400 }, // 24시간 캐시
      });

      if (!countRes.ok) {
        console.warn(
          "REC API 응답 오류:",
          countRes.status,
          countRes.statusText,
          "- 기본값 사용"
        );
        return null;
      }

      const countData = await countRes.json();
      const totalCount = parseInt(
        countData?.response?.body?.totalCount ?? "0",
        10
      );

      if (totalCount === 0) {
        console.warn("REC API 데이터 없음");
        return null;
      }

      // 2단계: 마지막 페이지에서 최신 데이터 조회
      const params = new URLSearchParams({
        serviceKey: this.apiKey,
        pageNo: String(totalCount), // 마지막 페이지
        numOfRows: "1",
        dataType: "json",
      });

      const res = await fetch(`${REC_API_URL}?${params}`, {
        next: { revalidate: 86400 }, // 24시간 캐시
      });

      if (!res.ok) {
        console.warn(
          "REC API 응답 오류:",
          res.status,
          res.statusText,
          "- 기본값 사용"
        );
        return null;
      }

      const data = await res.json();

      // 응답 구조: data.response.header / data.response.body
      const response = data?.response;

      // 에러 코드 체크
      const resultCode = response?.header?.resultCode;
      if (resultCode !== "00") {
        console.error(
          "REC API 에러 코드:",
          resultCode,
          response?.header?.resultMsg
        );
        return null;
      }

      // 배열/객체 모두 대응
      const item = response?.body?.items?.item;
      const targetItem = Array.isArray(item) ? item[0] : item;

      if (!targetItem) {
        console.error("REC API 데이터 없음");
        return null;
      }

      // 지역에 따른 가격 선택
      // 우선순위: 지역별 평균가 > 종가
      let price: number;
      if (region === "제주") {
        price = Number(targetItem.jejuAvgPrc ?? targetItem.clsPrc);
      } else {
        price = Number(targetItem.landAvgPrc ?? targetItem.clsPrc);
      }

      if (isNaN(price) || price <= 0) {
        console.error("REC API 가격 파싱 실패:", targetItem);
        return null;
      }

      return {
        price,
        date: targetItem.bzDd ?? "",
        region,
      };
    } catch (error) {
      console.error("REC API 호출 오류:", error);
      return null;
    }
  }
}

// ==================== 유틸리티 ====================

/**
 * REC 날짜 포맷 변환 (YYYYMMDD → MM/DD)
 */
export function formatRecDate(yyyymmdd: string): string {
  if (!yyyymmdd || yyyymmdd.length !== 8) return "";

  const month = yyyymmdd.slice(4, 6);
  const day = yyyymmdd.slice(6, 8);

  // 앞의 0 제거
  return `${parseInt(month)}/${parseInt(day)}`;
}
