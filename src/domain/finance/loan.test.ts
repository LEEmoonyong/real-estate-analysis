import { describe, expect, it } from 'vitest';
import { classifyArea, estimateLoan, monthlyPayment, principalForPayment, type LoanInput } from './loan';

describe('지역 구분', () => {
  it('서울 전역·경기 12곳은 규제지역, 그 밖 수도권은 수도권, 지방', () => {
    expect(classifyArea('서울특별시', '송파구')).toBe('regulated');
    expect(classifyArea('경기도', '성남시 분당구')).toBe('regulated');
    expect(classifyArea('경기도', '과천시')).toBe('regulated');
    expect(classifyArea('경기도', '성남시 중원구')).toBe('regulated');
    expect(classifyArea('경기도', '고양시 일산동구')).toBe('capital');
    expect(classifyArea('인천광역시', '연수구')).toBe('capital');
    expect(classifyArea('부산광역시', '해운대구')).toBe('other');
    expect(classifyArea('세종특별자치시', '')).toBe('other');
  });
});

describe('원리금 균등', () => {
  it('월 상환액과 역산이 맞는다', () => {
    const m = monthlyPayment(30000, 4, 30); // 3억, 4%, 30년
    expect(m).toBeCloseTo(143.22, 1); // 약 143만원
    expect(principalForPayment(m, 4, 30)).toBeCloseTo(30000, 3);
    expect(monthlyPayment(1200, 0, 1)).toBe(100);
  });
});

describe('주담대 한도', () => {
  const base: LoanInput = {
    price: 200_000,
    areaClass: 'regulated',
    buyer: 'none',
    annualIncome: 15_000,
    otherDebtAnnual: 0,
    ratePct: 4,
    years: 40,
  };

  it('서울 20억, 무주택, 연소득 1.5억: LTV 8억·가격 한도 4억·DSR 중 최소 = 가격 한도 4억', () => {
    const r = estimateLoan(base);
    expect(r.ltv).toBe(0.4);
    expect(r.byLtv).toBe(80_000);
    expect(r.byPriceCap).toBe(40_000);
    expect(r.termYears).toBe(30); // 만기 30년 제한
    expect(r.stressRatePct).toBe(3);
    expect(r.binding).toBe('priceCap');
    expect(r.maxLoan).toBe(40_000);
    expect(r.ownFunds).toBe(160_000);
    expect(r.notes.join()).toContain('30년');
  });

  it('소득이 낮으면 DSR이 한도를 정한다 (스트레스 금리 반영)', () => {
    const r = estimateLoan({ ...base, price: 80_000, annualIncome: 5_000 });
    // 연 2,000만 = 월 166.7만, 금리 4+3=7%, 30년 → 약 2.5억
    expect(r.binding).toBe('dsr');
    expect(r.byDsr).toBeGreaterThan(24_000);
    expect(r.byDsr).toBeLessThan(26_000);
    expect(r.maxLoan % 100).toBe(0);
  });

  it('다주택자는 수도권에서 0, 지방은 LTV 60%', () => {
    expect(estimateLoan({ ...base, buyer: 'multi' }).maxLoan).toBe(0);
    const other = estimateLoan({ ...base, areaClass: 'other', buyer: 'multi', price: 50_000, annualIncome: 30_000 });
    expect(other.ltv).toBe(0.6);
    expect(other.byPriceCap).toBeNull();
    expect(other.stressRatePct).toBe(0.75);
    expect(other.maxLoan).toBe(30_000);
  });

  it('생애최초는 규제지역에서도 LTV 70%', () => {
    const r = estimateLoan({ ...base, buyer: 'firstTime', price: 100_000, annualIncome: 50_000 });
    expect(r.ltv).toBe(0.7);
    expect(r.maxLoan).toBe(60_000); // 70% = 7억이지만 15억 이하 6억 한도
  });

  it('다른 대출 상환액이 DSR 여유를 줄인다', () => {
    const a = estimateLoan({ ...base, price: 60_000, annualIncome: 6_000 });
    const b = estimateLoan({ ...base, price: 60_000, annualIncome: 6_000, otherDebtAnnual: 1_200 });
    expect(b.byDsr).toBeLessThan(a.byDsr);
  });
});
