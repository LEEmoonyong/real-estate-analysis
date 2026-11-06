// 취득세·보유세(재산세·종부세) 개략 계산 (확장 X4) — 규칙 숫자는 src/config/regulations.ts
// 감면·세액공제(고령자·장기보유)·세부담 상한·지역자원시설세 등은 넣지 않은 "개략"이다. 화면에 함께 밝힌다.
import {
  ACQ_HEAVY,
  ACQ_STD,
  COMPREHENSIVE,
  FIRST_HOME_RELIEF,
  PROPERTY_EXTRA,
  PROPERTY_FAIR_RATIO,
  PROPERTY_RATES,
  PUBLIC_PRICE_RATIO,
} from '../../config/regulations';
import type { AreaClass } from './loan';

export interface AcquisitionInput {
  /** 취득가액 [만원] */
  price: number;
  /** 전용면적 [㎡] — 85㎡ 초과면 농어촌특별세 */
  area: number;
  /** 취득 후 보유 주택 수 (이 집 포함) */
  homesAfter: number;
  areaClass: AreaClass;
  /** 생애최초 감면 대상 */
  firstHome?: boolean;
}

export interface TaxLine {
  label: string;
  /** [만원] */
  amount: number;
  /** 세율 표시용 (예: '1.67%') */
  rate?: string;
}

export interface TaxResult {
  lines: TaxLine[];
  total: number;
  notes: string[];
}

const pct = (r: number) => `${(Math.round(r * 10000) / 100).toString()}%`;

/** 1주택 표준 본세율 (6억 이하 1%, 6~9억 비례, 9억 초과 3%) — 소수 넷째 자리 반올림 */
export function standardAcquisitionRate(price: number): number {
  if (price <= ACQ_STD.low) return 0.01;
  if (price > ACQ_STD.high) return 0.03;
  // (취득가액 × 2/3억 − 3) / 100, 가액은 억 단위
  const eok = price / 10_000;
  return Math.round(((eok * 2) / 3 - 3) * 100) / 10_000;
}

export function acquisitionTax(input: AcquisitionInput): TaxResult {
  const notes: string[] = [];
  const over85 = input.area > 85;
  let base: number;
  let edu: number;
  let rural: number;
  const regulated = input.areaClass === 'regulated';
  // 다주택 중과: 규제(조정대상)지역 2주택 8%, 3주택 이상 12% / 비조정 3주택 8%, 4주택 이상 12%
  const heavy =
    (regulated && input.homesAfter >= 3) || (!regulated && input.homesAfter >= 4)
      ? ACQ_HEAVY.rate12
      : (regulated && input.homesAfter === 2) || (!regulated && input.homesAfter === 3)
        ? ACQ_HEAVY.rate8
        : null;
  if (heavy) {
    base = heavy.base;
    edu = heavy.edu;
    rural = over85 ? heavy.rural : 0;
    notes.push(
      `보유 주택 ${input.homesAfter}채(${regulated ? '조정대상지역' : '비조정지역'}) 중과세율을 적용했습니다. 일시적 2주택은 중과에서 빠질 수 있습니다.`,
    );
  } else {
    base = standardAcquisitionRate(input.price);
    edu = base / 10; // 지방교육세: 본세율의 10%
    rural = over85 ? 0.002 : 0;
  }
  const lines: TaxLine[] = [
    { label: '취득세', amount: input.price * base, rate: pct(base) },
    { label: '지방교육세', amount: input.price * edu, rate: pct(edu) },
  ];
  if (rural > 0) lines.push({ label: '농어촌특별세 (85㎡ 초과)', amount: input.price * rural, rate: pct(rural) });
  if (input.firstHome && !heavy && input.price <= FIRST_HOME_RELIEF.maxPrice) {
    const relief = Math.min(FIRST_HOME_RELIEF.maxManwon, input.price * base);
    lines.push({ label: '생애최초 감면', amount: -relief });
    notes.push('생애최초 감면(최대 200만원)은 3개월 안 전입 등 조건을 지켜야 유지됩니다.');
  }
  const total = lines.reduce((s, l) => s + l.amount, 0);
  return { lines, total, notes };
}

/** 누진 구간표로 세액 = 과표 × 세율 − 누진공제 */
function progressive(base: number, table: readonly { upTo: number; rate: number; deduct: number }[]): number {
  if (base <= 0) return 0;
  const row = table.find((r) => base <= r.upTo) ?? table[table.length - 1]!;
  return Math.max(0, base * row.rate - row.deduct);
}

export interface HoldingInput {
  /** 공시가격 [만원] (모르면 시세 × 현실화율로 추정) */
  publicPrice: number;
  /** 1세대 1주택 여부 */
  oneHome: boolean;
  /** 보유 주택 수 (종부세 3주택 중과 판단) */
  homes: number;
}

/** 시세로 공시가격 추정 */
export function estimatePublicPrice(marketPrice: number): number {
  return Math.round(marketPrice * PUBLIC_PRICE_RATIO);
}

export function holdingTax(input: HoldingInput): TaxResult {
  const notes: string[] = [];
  // 재산세
  const fairRatio = input.oneHome
    ? (PROPERTY_FAIR_RATIO.oneHome.find((r) => input.publicPrice <= r.upTo) ?? PROPERTY_FAIR_RATIO.oneHome[2]).ratio
    : PROPERTY_FAIR_RATIO.other;
  const propertyBase = input.publicPrice * fairRatio;
  const special = input.oneHome && input.publicPrice <= PROPERTY_RATES.specialMaxPublicPrice;
  const propertyTax = progressive(propertyBase, special ? PROPERTY_RATES.oneHomeSpecial : PROPERTY_RATES.standard);
  const lines: TaxLine[] = [
    { label: `재산세 (과표 = 공시가 × ${pct(fairRatio)})`, amount: propertyTax },
    { label: '재산세 도시지역분', amount: propertyBase * PROPERTY_EXTRA.urban, rate: pct(PROPERTY_EXTRA.urban) },
    { label: '지방교육세 (재산세의 20%)', amount: propertyTax * PROPERTY_EXTRA.eduOfTax },
  ];
  if (special) notes.push('1세대 1주택 재산세 특례세율(공시가 9억 이하)을 적용했습니다.');

  // 종합부동산세
  const deduction = input.oneHome ? COMPREHENSIVE.deduction.oneHome : COMPREHENSIVE.deduction.other;
  const compBase = Math.max(0, (input.publicPrice - deduction) * COMPREHENSIVE.fairRatio);
  if (compBase > 0) {
    const comp = progressive(compBase, input.homes >= 3 ? COMPREHENSIVE.ratesMulti : COMPREHENSIVE.rates);
    // 재산세와 겹치는 부분 공제는 단순화해 생략 → 실제보다 다소 높게 나올 수 있음
    lines.push({ label: `종합부동산세 (공제 ${deduction / 10_000}억)`, amount: comp });
    lines.push({ label: '농어촌특별세 (종부세의 20%)', amount: comp * COMPREHENSIVE.ruralOfTax });
    notes.push(
      '종부세는 재산세 중복분 공제·고령자·장기보유 세액공제·세부담 상한을 넣지 않아 실제보다 높게 나올 수 있습니다.',
    );
  } else {
    notes.push(`공시가격이 종부세 공제(${deduction / 10_000}억) 이하라 종합부동산세는 없습니다.`);
  }
  const total = lines.reduce((s, l) => s + l.amount, 0);
  return { lines, total, notes };
}
