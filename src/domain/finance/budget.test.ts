import { describe, expect, it } from 'vitest';
import { affordablePrice, budgetCap, placeTotal } from './budget';
import { estimateLoan } from './loan';

describe('예산으로 살 수 있는 최대 가격', () => {
  it('지방: LTV 70% — 자기 자금 3억이면 10억', () => {
    const r = affordablePrice({ ownFunds: 30_000, annualIncome: 100_000, areaClass: 'other' });
    expect(r.maxPrice).toBe(100_000);
    expect(r.loan).toBe(70_000);
    expect(r.binding).toBe('ltv');
  });

  it('소득이 적으면 DSR이 한도를 정한다', () => {
    const r = affordablePrice({ ownFunds: 30_000, annualIncome: 3_000, areaClass: 'other' });
    expect(r.binding).toBe('dsr');
    expect(r.maxPrice).toBe(30_000 + r.loan);
    expect(r.maxPrice).toBeLessThan(100_000);
  });

  it('규제지역: 가격대별 총액 한도를 넘지 않고, 한 칸 더 비싸면 자금이 모자란다', () => {
    const input = { ownFunds: 100_000, annualIncome: 200_000, areaClass: 'regulated' as const };
    const r = affordablePrice(input);
    const loanInput = { ...input, buyer: 'none' as const, otherDebtAnnual: 0, ratePct: 4.5, years: 30 };
    expect(estimateLoan({ ...loanInput, price: r.maxPrice }).ownFunds).toBeLessThanOrEqual(100_000);
    expect(estimateLoan({ ...loanInput, price: r.maxPrice + 100 }).ownFunds).toBeGreaterThan(100_000);
  });

  it('소득이 없으면 가진 돈만큼', () => {
    expect(affordablePrice({ ownFunds: 20_000, annualIncome: 0, areaClass: 'capital' }).maxPrice).toBe(20_000);
  });
});

describe('지도 예산 조건', () => {
  const place = { value: 1_000, areaMedian: 84, depositMedian: 5_000 };

  it('매매는 총액, 전세는 보증금, 월세는 보증금 중앙값', () => {
    expect(placeTotal(place, 'trade')).toBe(84_000);
    expect(placeTotal(place, 'jeonse')).toBe(1_000);
    expect(placeTotal(place, 'wolse')).toBe(5_000);
  });

  it('상한 — 매매는 최대 가격, 전세·월세는 자기 자금', () => {
    const r = affordablePrice({ ownFunds: 30_000, annualIncome: 100_000, areaClass: 'other' });
    expect(budgetCap(r, 30_000, 'trade')).toBe(100_000);
    expect(budgetCap(r, 30_000, 'jeonse')).toBe(30_000);
  });
});
