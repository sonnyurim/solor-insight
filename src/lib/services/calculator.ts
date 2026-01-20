import {
  CalculatorResolver,
  toExtendedCalculatorInput,
  type ICalculatorResolver,
} from "./calculator-resolver";
import {
  calculate,
  calculateRequiredCapacity,
  type ReverseCalculatorInput,
} from "@/lib/chat/calculators";
import { extractParameters } from "@/lib/chat/parameter-extractor";
import type {
  ExtractedParameters,
  RevenueCalculationResult,
  ReverseCalculationResult,
  DataSources,
} from "@/lib/chat/types";
import { DEFAULT_UTILIZATION_RATE } from "@/constants/chat/calculator";

// ==================== 타입 정의 ====================

/**
 * 핸들러 결과 타입
 */
export interface CalculatorHandlerResult {
  type: "question" | "result" | "reverse_result";
  message?: string; // 추가 질문 메시지
  data?: RevenueCalculationResult;
  reverseData?: ReverseCalculationResult; // 역산 결과 (Phase 2)
  sources?: DataSources;
}

// ==================== 인터페이스 정의 (DIP) ====================

/**
 * 계산기 서비스 인터페이스
 */
export interface ICalculatorService {
  handleIntent(userInput: string): Promise<CalculatorHandlerResult>;
}

// ==================== 서비스 구현 ====================

/**
 * 계산기 서비스 구현체
 * 파라미터 추출 → 해결 → 계산 실행
 */
export class CalculatorService implements ICalculatorService {
  constructor(
    private resolver: ICalculatorResolver = new CalculatorResolver()
  ) {}

  /**
   * CALCULATOR 인텐트 메인 핸들러
   *
   * 처리 흐름:
   * 1. 사용자 입력에서 파라미터 추출 (기간/모드/서브인텐트 포함)
   * 2. 분기: 역산형 → 정방향
   * 3. 파라미터 검증 및 폴백 적용
   * 4. 계산 실행 및 결과 반환
   */
  async handleIntent(userInput: string): Promise<CalculatorHandlerResult> {
    // 1. 파라미터 추출 (기간/모드/서브인텐트 포함)
    const extracted: ExtractedParameters = {
      ...extractParameters(userInput),
      userInput, // 지역 판별용 원본 텍스트 저장
    };

    // 2. 역산형 분기 (Phase 2)
    if (extracted.subIntent === "REVERSE") {
      return this.handleReverseCalculation(extracted);
    }

    // 3. 정방향 계산 (기존 로직)
    return this.handleForwardCalculation(extracted);
  }

  /**
   * 정방향 계산 (용량 → 수익)
   */
  private async handleForwardCalculation(
    extracted: ExtractedParameters
  ): Promise<CalculatorHandlerResult> {
    // 파라미터 검증 및 폴백 적용
    const resolved = await this.resolver.resolve(extracted);

    // 용량 누락 시 추가 질문 반환
    if (!resolved.success) {
      return {
        type: "question",
        message: resolved.question,
      };
    }

    // 계산 실행 (기간/모드 포함)
    const calculatorInput = toExtendedCalculatorInput(
      resolved.params,
      extracted.period,
      extracted.calculationMode
    );
    const calculationResult = calculate(calculatorInput);

    // 지역 및 출처 정보 추가
    const resultWithSources: RevenueCalculationResult = {
      ...calculationResult,
      region: resolved.params.region,
      sources: resolved.params.sources,
    };

    return {
      type: "result",
      data: resultWithSources,
      sources: resolved.params.sources,
    };
  }

  /**
   * 역방향 계산 (목표 수익 → 필요 용량) (Phase 2)
   */
  private async handleReverseCalculation(
    extracted: ExtractedParameters
  ): Promise<CalculatorHandlerResult> {
    // 목표 수익이 없으면 추가 질문
    if (!extracted.reverseTarget) {
      return {
        type: "question",
        message:
          "목표 수익을 알려주세요!\n\n" +
          "📌 필수: 목표 수익 (예: 연 3천만원, 월 500만원)\n" +
          "📌 선택: REC 단가, SMP 단가, 지역(제주/육지)\n\n" +
          "▶ 예시\n" +
          '• "연 3천만원 벌려면 몇 kW 필요해?" → 필요 용량 계산\n' +
          '• "월 500만원 목표인데 설비용량 얼마나 필요해?" → 필요 용량 계산',
      };
    }

    // 용량 없이 해결 (SMP/REC만 폴백)
    const tempExtracted = { ...extracted, capacity_kw: 1 }; // 임시 용량 설정
    const resolved = await this.resolver.resolve(tempExtracted);

    if (!resolved.success) {
      // 이 경우는 발생하지 않아야 함 (용량 임시 설정했으므로)
      return {
        type: "question",
        message: resolved.question,
      };
    }

    // 역산 입력 구성
    const reverseInput: ReverseCalculatorInput = {
      targetRevenue: extracted.reverseTarget.targetRevenue,
      targetPeriod: extracted.reverseTarget.period,
      rec_price: resolved.params.recPrice,
      smp_price: resolved.params.smpPrice,
      utilization_rate: extracted.utilization_rate ?? DEFAULT_UTILIZATION_RATE,
      rec_weight: resolved.params.recWeight,
    };

    // 역산 실행
    const reverseResult = calculateRequiredCapacity(reverseInput);

    // 지역 및 출처 정보 추가
    const resultWithSources: ReverseCalculationResult = {
      ...reverseResult,
      region: resolved.params.region,
      sources: resolved.params.sources,
    };

    return {
      type: "reverse_result",
      reverseData: resultWithSources,
      sources: resolved.params.sources,
    };
  }
}

// ==================== 기본 인스턴스 및 Export ====================

const calculatorService = new CalculatorService();

/**
 * CALCULATOR 인텐트 메인 핸들러
 */
export async function handleCalculatorIntent(
  userInput: string
): Promise<CalculatorHandlerResult> {
  return calculatorService.handleIntent(userInput);
}
