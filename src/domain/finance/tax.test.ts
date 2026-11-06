import { describe, expect, it } from 'vitest';
import { acquisitionTax, estimatePublicPrice, holdingTax, standardAcquisitionRate } from './tax';

const line = (r: { lines: { label: string; amount: number }[] }, prefix: string) =>
  r.lines.find((l) => l.label.startsWith(prefix))?.amount ?? 0;

describe('취득세', () => {
  it('1주택 표준세율: 6억 이하 1%, 7억 약 1.67%, 8억 2.33%, 9억 초과 3%', () => {
    expect(standardAcquisitionRate(50_000)).toBe(0.01);
    expect(standardAcquisitionRate(60_000)).toBe(0.01);
    expect(standardAcquisitionRate(70_000)).toBeCloseTo(0.0167, 4);
    expect(standardAcquisitionRate(80_000)).toBeCloseTo(0.0233, 4);
    expect(standardAcquisitionRate(90_000)).toBe(0.03);
    expect(standardAcquisitionRate(150_000)).toBe(0.03);
  });

  it('10억·84㎡ 1주택: 취득세 3% + 지방교육세 0.3%, 농특세 없음', () => {
    const r = acquisitionTax({ price: 100_000, area: 84.9, homesAfter: 1, areaClass: 'regulated' });
    expect(line(r, '취득세')).toBeCloseTo(3_000);
    expect(line(r, '지방교육세')).toBeCloseTo(300);
    expect(line(r, '농어촌')).toBe(0);
    expect(r.total).toBeCloseTo(3_300);
  });

  it('85㎡ 초과면 농특세 0.2%', () => {
    const r = acquisitionTax({ price: 100_000, area: 114, homesAfter: 1, areaClass: 'other' });
    expect(line(r, '농어촌')).toBeCloseTo(200);
  });

  it('조정대상지역 2주택 8%, 3주택 12% / 비조정 2주택은 표준세율', () => {
    const r2 = acquisitionTax({ price: 100_000, area: 84, homesAfter: 2, areaClass: 'regulated' });
    expect(line(r2, '취득세')).toBeCloseTo(8_000);
    expect(line(r2, '지방교육세')).toBeCloseTo(400);
    const r3 = acquisitionTax({ price: 100_000, area: 114, homesAfter: 3, areaClass: 'regulated' });
    expect(line(r3, '취득세')).toBeCloseTo(12_000);
    expect(line(r3, '농어촌')).toBeCloseTo(1_000);
    const n2 = acquisitionTax({ price: 100_000, area: 84, homesAfter: 2, areaClass: 'capital' });
    expect(line(n2, '취득세')).toBeCloseTo(3_000);
  });

  it('생애최초 감면 최대 200만원 (12억 이하)', () => {
    const r = acquisitionTax({ price: 50_000, area: 59, homesAfter: 1, areaClass: 'regulated', firstHome: true });
    expect(line(r, '생애최초')).toBe(-200);
    expect(r.total).toBeCloseTo(500 + 50 - 200);
    const big = acquisitionTax({ price: 130_000, area: 59, homesAfter: 1, areaClass: 'regulated', firstHome: true });
    expect(line(big, '생애최초')).toBe(0);
  });
});

describe('보유세', () => {
  it('공시가 5억 1주택: 특례 공정시장가액 44%·특례세율, 종부세 없음', () => {
    const r = holdingTax({ publicPrice: 50_000, oneHome: true, homes: 1 });
    // 과표 2.2억 → 특례 0.2% − 18만 = 26만
    expect(line(r, '재산세 (')).toBeCloseTo(26, 3);
    expect(line(r, '지방교육세')).toBeCloseTo(5.2, 3);
    expect(line(r, '종합부동산세')).toBe(0);
    expect(r.notes.join()).toContain('종합부동산세는 없습니다');
  });

  it('공시가 20억 1주택: 종부세 과표 (20−12)억 × 60% = 4.8억 → 0.7% − 60만 = 276만', () => {
    const r = holdingTax({ publicPrice: 200_000, oneHome: true, homes: 1 });
    expect(line(r, '종합부동산세')).toBeCloseTo(276, 3);
    expect(line(r, '농어촌특별세')).toBeCloseTo(55.2, 3);
  });

  it('3주택 이상은 과표 12억 초과 구간 중과', () => {
    const one = holdingTax({ publicPrice: 400_000, oneHome: false, homes: 2 });
    const three = holdingTax({ publicPrice: 400_000, oneHome: false, homes: 3 });
    expect(line(three, '종합부동산세')).toBeGreaterThan(line(one, '종합부동산세'));
  });

  it('공시가격 추정 = 시세 × 69%', () => {
    expect(estimatePublicPrice(100_000)).toBe(69_000);
  });
});
