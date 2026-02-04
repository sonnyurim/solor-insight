import { db } from "@/lib/db";
import type { PrismaClient } from "@prisma/client";

export type RegionType = "육지" | "제주";

// ==================== 인터페이스 정의 (DIP) ====================

/**
 * SMP Repository 인터페이스
 * 테스트 시 Mock 주입 용이
 */
export interface ISmpRepository {
  getLatestPrice(region: RegionType): Promise<number | null>;
  getLatestDaily(region: RegionType): Promise<{ price: number; date: Date } | null>;
}

// ==================== Repository 구현 ====================

/**
 * SMP Repository 구현체
 */
export class SmpRepository implements ISmpRepository {
  constructor(private prisma: PrismaClient = db) {}

  /**
   * SMP 최근 1개월 평균가 조회
   * 0원 데이터 제외, 삭제되지 않은 데이터만 조회
   */
  async getLatestPrice(region: RegionType = "육지"): Promise<number | null> {
    try {
      // 1개월 전 날짜 계산
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const recent = await this.prisma.smpPriceDaily.findMany({
        where: {
          regionType: region,
          avgPrice: { gt: 0 }, // 0원 제외
          priceDate: { gte: oneMonthAgo },
          deletedAt: null,
        },
        orderBy: { priceDate: "desc" },
      });

      if (recent.length === 0) return null;

      // 1개월 평균 계산
      const avg =
        recent.reduce((sum, r) => sum + Number(r.avgPrice), 0) / recent.length;

      return Math.round(avg * 100) / 100; // 소수점 2자리
    } catch {
      return null;
    }
  }

  /**
   * SMP 최신 일별 가격 조회 (단일)
   */
  async getLatestDaily(
    region: RegionType = "육지"
  ): Promise<{ price: number; date: Date } | null> {
    try {
      const latest = await this.prisma.smpPriceDaily.findFirst({
        where: {
          regionType: region,
          avgPrice: { gt: 0 },
          deletedAt: null,
        },
        orderBy: { priceDate: "desc" },
      });

      if (!latest) return null;

      return {
        price: Number(latest.avgPrice),
        date: latest.priceDate,
      };
    } catch {
      return null;
    }
  }
}

