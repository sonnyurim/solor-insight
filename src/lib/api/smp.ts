/**
 * SMP 시장가격 조회
 * EPSIS(전력거래소) API 활용
 *
 * API 스펙:
 * - URL: https://epsis.kpx.or.kr/epsisnew/selectEkmaSmpShd.ajax
 * - Method: POST
 * - 응답: HTML/JavaScript (gridData 포함)
 *
 * 주요 응답 필드:
 * - c1~c24: 시간대별 SMP (01시~24시)
 * - c25: 최대
 * - c26: 최소
 * - c27: 가중평균
 * - Date: 날짜 (YYYY/MM/DD)
 */

export type SmpRegionType = "육지" | "제주";

export interface SmpPriceResult {
  price: number; // 1개월 평균 (가중평균 기준)
  startDate: string; // 조회 시작일 (YYYYMMDD)
  endDate: string; // 조회 종료일 (YYYYMMDD)
  region: SmpRegionType;
  dataCount: number; // 조회된 일수
}

// ==================== 인터페이스 정의 (DIP) ====================

/**
 * SMP Repository 인터페이스
 * 테스트 시 Mock 주입 용이
 */
export interface ISmpRepository {
  getLatestPrice(region: SmpRegionType): Promise<number | null>;
}

// ==================== Repository 구현 ====================

const SMP_API_URL =
  "https://epsis.kpx.or.kr/epsisnew/selectEkmaSmpShd.ajax";

/**
 * SMP Repository 구현체
 * EPSIS(전력거래소) API를 통해 SMP 가격 조회
 */
export class SmpApiRepository implements ISmpRepository {
  /**
   * SMP 최근 1개월 평균가 조회
   * 가중평균(c27) 값들의 평균을 계산
   * Next.js 24시간 캐시 적용
   */
  async getLatestPrice(
    region: SmpRegionType = "육지"
  ): Promise<number | null> {
    try {
      // 1개월 전 날짜 계산
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);

      const beginDateStr = formatDateToYYYYMMDD(startDate);
      const endDateStr = formatDateToYYYYMMDD(endDate);
      const selKind = region === "제주" ? "jeju" : "land";

      // POST body로 파라미터 전송
      const postData = `beginDate=${beginDateStr}&endDate=${endDateStr}&selKind=${selKind}`;

      const res = await fetch(SMP_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: postData,
        next: { revalidate: 86400 }, // 24시간 캐시
      });

      if (!res.ok) {
        return null;
      }

      const htmlText = await res.text();

      // EPSIS 서버 점검/장애 감지
      if (
        htmlText.includes("응급 복구중") ||
        htmlText.includes("장애") ||
        htmlText.includes("에러가 발생")
      ) {
        return null;
      }

      // 응답에서 가중평균(c27) 값들 추출
      const weightedAverages = parseWeightedAverages(htmlText);

      if (weightedAverages.length === 0) {
        return null;
      }

      // 0원 데이터 제외하고 평균 계산
      const validPrices = weightedAverages.filter((price) => price > 0);

      if (validPrices.length === 0) {
        return null;
      }

      const avgPrice =
        validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length;

      const roundedPrice = Math.round(avgPrice * 100) / 100;

      return roundedPrice;
    } catch {
      return null;
    }
  }

  /**
   * SMP 최근 1개월 데이터 상세 조회 (확장용)
   */
  async getLatestPriceDetail(
    region: SmpRegionType = "육지"
  ): Promise<SmpPriceResult | null> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);

      const beginDateStr = formatDateToYYYYMMDD(startDate);
      const endDateStr = formatDateToYYYYMMDD(endDate);
      const selKind = region === "제주" ? "jeju" : "land";

      const postData = `beginDate=${beginDateStr}&endDate=${endDateStr}&selKind=${selKind}`;

      const res = await fetch(SMP_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: postData,
        next: { revalidate: 86400 },
      });

      if (!res.ok) {
        return null;
      }

      const htmlText = await res.text();
      const weightedAverages = parseWeightedAverages(htmlText);

      if (weightedAverages.length === 0) {
        return null;
      }

      const validPrices = weightedAverages.filter((price) => price > 0);

      if (validPrices.length === 0) {
        return null;
      }

      const avgPrice =
        validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length;

      return {
        price: Math.round(avgPrice * 100) / 100,
        startDate: beginDateStr,
        endDate: endDateStr,
        region,
        dataCount: validPrices.length,
      };
    } catch {
      return null;
    }
  }
}

// ==================== 유틸리티 ====================

/**
 * Date 객체를 YYYYMMDD 형식으로 변환
 */
function formatDateToYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/**
 * API 응답(HTML/JavaScript)에서 가중평균(c27) 값들을 추출
 *
 * 응답 형식:
 * c27 = textFormmat("106.45",count);
 * gridData.push({"Date":"2026/01/20", "c1":c1, ..., "c27":c27});
 */
function parseWeightedAverages(htmlText: string): number[] {
  const weightedAverages: number[] = [];

  // c27 = textFormmat("값", count) 패턴 매칭
  const c27Regex = /c27\s*=\s*textFormmat\s*\(\s*"([0-9.]+)"/g;

  let match;
  while ((match = c27Regex.exec(htmlText)) !== null) {
    const value = parseFloat(match[1]);
    if (!isNaN(value)) {
      weightedAverages.push(value);
    }
  }

  return weightedAverages;
}

/**
 * SMP 날짜 포맷 변환 (YYYYMMDD → MM/DD)
 */
export function formatSmpDate(yyyymmdd: string): string {
  if (!yyyymmdd || yyyymmdd.length !== 8) return "";

  const month = yyyymmdd.slice(4, 6);
  const day = yyyymmdd.slice(6, 8);

  return `${parseInt(month)}/${parseInt(day)}`;
}
