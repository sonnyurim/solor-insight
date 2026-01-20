import {
  SmpApiRepository,
  type ISmpRepository,
  type SmpRegionType as RegionType,
} from "@/lib/api/smp";
import {
  RecRepository,
  formatRecDate,
  type IRecRepository,
} from "@/lib/api/rec";
import {
  DEFAULT_SMP,
  DEFAULT_REC,
  DEFAULT_UTILIZATION_RATE,
  DEFAULT_REC_WEIGHT_SMALL,
  DEFAULT_REC_WEIGHT_LARGE,
  REC_WEIGHT_THRESHOLD_KW,
} from "@/constants/chat/calculator";
import type {
  ExtractedParameters,
  ResolveResult,
  ResolvedCalculatorParams,
  DataSources,
  CalculatorInput,
  PeriodInfo,
  CalculationMode,
} from "@/lib/chat/types";
import type { ExtendedCalculatorInput } from "@/lib/chat/calculators";

// ==================== 인터페이스 정의 (DIP) ====================

/**
 * 파라미터 리졸버 인터페이스
 */
export interface ICalculatorResolver {
  resolve(extracted: ExtractedParameters): Promise<ResolveResult>;
}

// ==================== 유틸리티 함수 ====================

/**
 * 사용자 입력에서 지역 판별
 * "제주" 키워드 포함 시 제주, 아니면 육지
 */
function detectRegion(userInput: string): RegionType {
  const normalizedInput = userInput.toLowerCase();
  return normalizedInput.includes("제주") ? "제주" : "육지";
}

/**
 * 용량 기반 REC 가중치 자동 판단
 * - 100kW 미만: 1.2
 * - 100kW 이상: 1.0
 */
function determineRecWeight(capacityKw: number): number {
  return capacityKw < REC_WEIGHT_THRESHOLD_KW
    ? DEFAULT_REC_WEIGHT_SMALL
    : DEFAULT_REC_WEIGHT_LARGE;
}

// ==================== 리졸버 구현 ====================

/**
 * 계산기 파라미터 리졸버 구현체
 * Repository를 통해 SMP/REC 가격을 조회하고 폴백 적용
 */
export class CalculatorResolver implements ICalculatorResolver {
  constructor(
    private smpRepository: ISmpRepository = new SmpApiRepository(),
    private recRepository: IRecRepository = new RecRepository()
  ) {}

  /**
   * 파라미터 검증 및 폴백 적용
   *
   * 처리 흐름:
   * 1. 용량 필수 체크 (없으면 추가 질문)
   * 2. SMP 폴백 (EPSIS API 1개월 평균 → 기본값)
   * 3. REC 폴백 (API 최신가 → 기본값)
   * 4. 가중치 자동 판단 (용량 기준)
   */
  async resolve(extracted: ExtractedParameters): Promise<ResolveResult> {
    const userInput = extracted.userInput || "";

    // 1. 용량 필수 체크
    if (!extracted.capacity_kw) {
      return {
        success: false,
        question:
          "설비 용량을 알려주세요!\n\n" +
          "📌 필수: 설비 용량 (예: 100kW)\n" +
          "📌 선택: REC 단가, SMP 단가, 지역(제주/육지)\n\n" +
          "▶ 예시\n" +
          "• \"100kW 수익 계산해줘\" → 육지 기준, 최신 시세로 계산\n" +
          "• \"100kW 제주 계산해줘\" → 제주 기준, 최신 시세로 계산\n" +
          "• \"REC 4만원, SMP 110원으로 100kW 계산해줘\" → 입력한 단가로 계산",
      };
    }

    // 2. 지역 판별
    const region = detectRegion(userInput);

    // 3. SMP 처리
    const smpResult = await this.resolveSmpPrice(extracted.smp_price, region);

    // 4. REC 처리
    const recResult = await this.resolveRecPrice(extracted.rec_price, region);

    // 5. 가중치 자동 판단 (사용자 미입력 시)
    const recWeight =
      extracted.rec_weight ?? determineRecWeight(extracted.capacity_kw);

    // 6. 이용률 기본값 적용
    const utilizationRate =
      extracted.utilization_rate ?? DEFAULT_UTILIZATION_RATE;

    const resolvedParams: ResolvedCalculatorParams = {
      capacityKw: extracted.capacity_kw,
      smpPrice: smpResult.price,
      recPrice: recResult.price,
      utilizationRate,
      recWeight,
      region,
      sources: {
        smp: smpResult.source,
        rec: recResult.source,
      },
    };

    return {
      success: true,
      params: resolvedParams,
    };
  }

  /**
   * SMP 가격 해결 (사용자 입력 → EPSIS API → 기본값)
   */
  private async resolveSmpPrice(
    userPrice: number | undefined,
    region: RegionType
  ): Promise<{ price: number; source: DataSources["smp"] }> {
    if (userPrice) {
      return {
        price: userPrice,
        source: { type: "user", label: "" },
      };
    }

    const apiPrice = await this.smpRepository.getLatestPrice(region);
    if (apiPrice) {
      return {
        price: apiPrice,
        source: { type: "api", label: `최근 1개월 평균 (${region})` },
      };
    }

    return {
      price: DEFAULT_SMP,
      source: { type: "default", label: "기본값" },
    };
  }

  /**
   * REC 가격 해결 (사용자 입력 → API → 기본값)
   */
  private async resolveRecPrice(
    userPrice: number | undefined,
    region: RegionType
  ): Promise<{ price: number; source: DataSources["rec"] }> {
    if (userPrice) {
      return {
        price: userPrice,
        source: { type: "user", label: "" },
      };
    }

    const apiResult = await this.recRepository.getLatestPrice(region);
    if (apiResult) {
      return {
        price: apiResult.price,
        source: {
          type: "api",
          label: `${formatRecDate(apiResult.date)} 현물시장`,
          date: apiResult.date,
        },
      };
    }

    return {
      price: DEFAULT_REC,
      source: { type: "default", label: "기본값" },
    };
  }
}

// ==================== 유틸리티 Export ====================

/**
 * ResolvedCalculatorParams를 CalculatorInput 형태로 변환
 */
export function toCalculatorInput(
  params: ResolvedCalculatorParams
): CalculatorInput {
  return {
    rec_price: params.recPrice,
    smp_price: params.smpPrice,
    capacity_kw: params.capacityKw,
    utilization_rate: params.utilizationRate,
    rec_weight: params.recWeight,
  };
}

/**
 * ResolvedCalculatorParams를 ExtendedCalculatorInput으로 변환 (Phase 1)
 * 기간/모드 정보 포함
 */
export function toExtendedCalculatorInput(
  params: ResolvedCalculatorParams,
  period?: PeriodInfo,
  calculationMode?: CalculationMode
): ExtendedCalculatorInput {
  return {
    rec_price: params.recPrice,
    smp_price: params.smpPrice,
    capacity_kw: params.capacityKw,
    utilization_rate: params.utilizationRate,
    rec_weight: params.recWeight,
    period,
    calculationMode,
  };
}
