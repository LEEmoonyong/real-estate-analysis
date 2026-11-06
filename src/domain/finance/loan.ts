// 주택담보대출 한도 추정 (확장 X4) — LTV·주택가격별 총액 한도·DSR(스트레스 금리) 중 가장 작은 값
// 규칙 숫자는 src/config/regulations.ts. 화면에는 "참고용 추정, 실제 한도는 금융기관 심사"를 함께 표시한다.
import {
  CAPITAL_AREA_SIDO,
  DSR_LIMIT,
  LTV,
  MAX_TERM_YEARS_CAPITAL,
  PRICE_CAPS,
  REGULATED_AREAS,
  STRESS_RATE,
  type BuyerType,
} from '../../config/regulations';

export type AreaClass = 'regulated' | 'capital' | 'other';

/** 시·도 + 시·군·구 이름 → 규제지역 / 수도권 비규제 / 지방 */
export function classifyArea(sido: string, sigungu: string): AreaClass {
  const list = REGULATED_AREAS[sido];
  if (list && (list.includes('*') || list.some((s) => sigungu === s || sigungu.startsWith(`${s} `))))
    return 'regulated';
  return (CAPITAL_AREA_SIDO as readonly string[]).includes(sido) ? 'capital' : 'other';
}

/** 원리금 균등 상환 월 납입액 [만원] */
export function monthlyPayment(principal: number, annualRatePct: number, years: number): number {
  const n = years * 12;
  const r = annualRatePct / 100 / 12;
  if (n <= 0) return principal;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - (1 + r) ** -n);
}

/** 월 납입액으로 갚을 수 있는 최대 원금 (원리금 균등) */
export function principalForPayment(payment: number, annualRatePct: number, years: number): number {
  const n = years * 12;
  const r = annualRatePct / 100 / 12;
  if (n <= 0 || payment <= 0) return 0;
  if (r === 0) return payment * n;
  return (payment * (1 - (1 + r) ** -n)) / r;
}

export interface LoanInput {
  /** 주택 가격(시가) [만원] */
  price: number;
  areaClass: AreaClass;
  buyer: BuyerType;
  /** 연소득 [만원] */
  annualIncome: number;
  /** 다른 대출의 연간 원리금 상환액 [만원] */
  otherDebtAnnual: number;
  /** 대출 금리 [%] */
  ratePct: number;
  years: number;
  lender?: 'bank' | 'nonBank';
}

export interface LoanResult {
  /** 실제 추정 한도 = 아래 셋 중 최소 [만원] */
  maxLoan: number;
  byLtv: number;
  /** 주택가격별 총액 한도 (해당 없으면 null) */
  byPriceCap: number | null;
  byDsr: number;
  /** 한도를 정한 요인 */
  binding: 'ltv' | 'priceCap' | 'dsr';
  ltv: number;
  stressRatePct: number;
  termYears: number;
  /** 한도만큼 빌렸을 때 실제 금리로 월 상환액 [만원] */
  monthlyPayment: number;
  /** 필요한 자기 자금 = 가격 − 한도 [만원] (취득세 등 부대비용 제외) */
  ownFunds: number;
  notes: string[];
}

export function estimateLoan(input: LoanInput): LoanResult {
  const notes: string[] = [];
  const ltv = LTV[input.areaClass][input.buyer];
  const strict = input.areaClass !== 'other';
  const termYears = strict ? Math.min(input.years, MAX_TERM_YEARS_CAPITAL) : input.years;
  if (termYears < input.years)
    notes.push(`수도권·규제지역 주담대 만기는 최대 ${MAX_TERM_YEARS_CAPITAL}년으로 계산했습니다.`);
  if (ltv === 0) notes.push('다주택자는 이 지역에서 주택 구입 목적 주담대를 받을 수 없습니다.');

  const byLtv = input.price * ltv;
  const byPriceCap = strict ? (PRICE_CAPS.find((c) => input.price <= c.upTo)?.cap ?? null) : null;

  // DSR: (연소득 × 한도 − 다른 대출 연 상환액) 안에서, 스트레스 금리를 더한 금리로 상환 가능한 원금
  const stressRatePct = strict ? STRESS_RATE.capitalOrRegulated : STRESS_RATE.other;
  const dsrLimit = DSR_LIMIT[input.lender ?? 'bank'];
  const annualRoom = Math.max(0, input.annualIncome * dsrLimit - input.otherDebtAnnual);
  const byDsr = principalForPayment(annualRoom / 12, input.ratePct + stressRatePct, termYears);

  const candidates: [LoanResult['binding'], number][] = [
    ['ltv', byLtv],
    ['dsr', byDsr],
    ...(byPriceCap !== null ? ([['priceCap', byPriceCap]] as [LoanResult['binding'], number][]) : []),
  ];
  const [binding, raw] = candidates.reduce((a, b) => (b[1] < a[1] ? b : a));
  const maxLoan = Math.max(0, Math.floor(raw / 100) * 100); // 100만원 단위 내림
  return {
    maxLoan,
    byLtv,
    byPriceCap,
    byDsr,
    binding,
    ltv,
    stressRatePct,
    termYears,
    monthlyPayment: monthlyPayment(maxLoan, input.ratePct, termYears),
    ownFunds: Math.max(0, input.price - maxLoan),
    notes,
  };
}
