// 예산으로 찾기 — 자기 자금과 연소득으로 살 수 있는 최대 주택 가격을 구한다.
// 필요한 자기 자금(가격 − 대출 한도)은 가격이 오를수록 늘어나므로 이분 탐색으로 찾는다.
// 대출 한도 규칙은 loan.ts(estimateLoan) 그대로. 취득세·중개보수 등 부대비용은 넣지 않은 참고용 값이다.
import { estimateLoan, type AreaClass, type LoanResult } from './loan';
import type { BuyerType } from '../../config/regulations';
import { formatManwon } from '../realestate/format';

export interface BudgetInput {
  /** 자기 자금 [만원] */
  ownFunds: number;
  /** 연소득 [만원] */
  annualIncome: number;
  areaClass: AreaClass;
  buyer?: BuyerType;
  ratePct?: number;
  years?: number;
}

export interface BudgetResult {
  /** 살 수 있는 최대 가격 [만원] (100만원 단위) */
  maxPrice: number;
  /** 그 가격에서의 대출 한도 [만원] */
  loan: number;
  binding: LoanResult['binding'];
  monthlyPayment: number;
}

/** 계산기 기본값과 같은 가정 */
export const BUDGET_DEFAULTS = { buyer: 'none' as BuyerType, ratePct: 4.5, years: 30 };

const STEP = 100;
/** 탐색 상한 [만원] — 500억 */
const MAX_PRICE = 5_000_000;

export function affordablePrice(input: BudgetInput): BudgetResult {
  const base = {
    areaClass: input.areaClass,
    buyer: input.buyer ?? BUDGET_DEFAULTS.buyer,
    annualIncome: Math.max(0, input.annualIncome),
    otherDebtAnnual: 0,
    ratePct: input.ratePct ?? BUDGET_DEFAULTS.ratePct,
    years: input.years ?? BUDGET_DEFAULTS.years,
  };
  const own = Math.max(0, input.ownFunds);
  const loanAt = (price: number) => estimateLoan({ ...base, price });
  // 가격(100만원 단위 칸) 가운데 필요한 자기 자금이 가진 돈 이하인 가장 큰 값
  let lo = 0;
  let hi = MAX_PRICE / STEP;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (loanAt(mid * STEP).ownFunds <= own) lo = mid;
    else hi = mid - 1;
  }
  const maxPrice = lo * STEP;
  const loan = loanAt(maxPrice);
  return { maxPrice, loan: loan.maxLoan, binding: loan.binding, monthlyPayment: loan.monthlyPayment };
}

type Kind = 'trade' | 'jeonse' | 'wolse';

/** 예산과 견줄 한 곳의 금액 [만원] — 매매는 총액(㎡당 중앙값 × 면적 중앙값), 전세·월세는 보증금 중앙값 */
export function placeTotal(place: { value: number; areaMedian: number; depositMedian: number }, kind: Kind): number {
  if (kind === 'trade') return place.value * place.areaMedian;
  return kind === 'jeonse' ? place.value : place.depositMedian;
}

/** 지도에서 거를 상한 [만원] — 매매는 살 수 있는 최대 가격, 전세·월세는 자기 자금(보증금, 전세대출 제외) */
export function budgetCap(result: BudgetResult, ownFunds: number, kind: Kind): number {
  return kind === 'trade' ? result.maxPrice : Math.max(0, ownFunds);
}

/** 지금 지역·거래 종류 기준 예산 계산 결과 (지도 패널 표시용) */
export interface BudgetInfo extends BudgetResult {
  /** 지도에서 거를 상한 [만원] — 매매는 최대 가격, 전세·월세는 자기 자금 */
  cap: number;
  kind: Kind;
  /** 계산에 쓴 지역 이름 (규제지역 여부가 지역마다 다르다) */
  area: string;
}

/** 예산 조건 칩 글자 */
export function budgetLabel(info: Pick<BudgetInfo, 'kind' | 'cap'>): string {
  return `${info.kind === 'trade' ? '예산' : '보증금'} ${formatManwon(info.cap)} 이하`;
}
