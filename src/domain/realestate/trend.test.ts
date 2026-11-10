import { describe, expect, it } from 'vitest';
import { changeText, floorAnalysis, priceChange } from './trend';
import type { AptTrade } from './types';

const trade = (p: Partial<AptTrade>): AptTrade => ({
  aptSeq: 'A',
  aptName: '가단지',
  umdName: '잠실동',
  jibun: '1',
  date: '2026-10-01',
  price: 100_000,
  area: 100,
  floor: 5,
  buildYear: 2010,
  cancelled: false,
  dealType: '중개거래',
  ...p,
});

const MONTHS = [
  '202511',
  '202512',
  '202601',
  '202602',
  '202603',
  '202604',
  '202605',
  '202606',
  '202607',
  '202608',
  '202609',
  '202610',
];

describe('가격 변화 요약', () => {
  const trades = [
    trade({ date: '2025-11-10', price: 100_000 }), // 1년 전 1000/㎡
    trade({ date: '2026-03-10', price: 130_000 }), // 최고 1300
    trade({ date: '2026-06-10', price: 120_000 }),
    trade({ date: '2026-07-10', price: 120_000 }),
    trade({ date: '2026-09-10', price: 110_000 }), // 지금 1100
    trade({ date: '2026-10-10', price: 999_999, cancelled: true }),
  ];

  it('1년 전 대비 · 최고가 대비 · 거래량', () => {
    const c = priceChange(trades, MONTHS);
    expect(c.now).toBe(1_100);
    expect(c.yoy).toBeCloseTo(0.1);
    expect(c.peak).toEqual({ month: '2026-03', perM2: 1_300 });
    expect(c.fromPeak).toBeCloseTo(1_100 / 1_300 - 1);
    expect(c.volumeNow).toBe(1);
    expect(c.volumePrev).toBe(2);
    expect(c.volumeChange).toBeCloseTo(-0.5);
  });

  it('거래가 없으면 null', () => {
    const c = priceChange([], MONTHS);
    expect(c.now).toBeNull();
    expect(c.yoy).toBeNull();
    expect(c.peak).toBeNull();
    expect(c.volumeChange).toBeNull();
  });

  it('조건(평형대)에 맞는 거래만', () => {
    const c = priceChange(trades, MONTHS, (t) => t.price > 115_000);
    expect(c.now).toBeNull();
    expect(c.volumePrev).toBe(2);
  });
});

describe('층별 가격', () => {
  it('최고층 기준 3등분, 고층 프리미엄', () => {
    const trades = [
      trade({ floor: 2, price: 100_000 }),
      trade({ floor: 5, price: 100_000 }),
      trade({ floor: 12, price: 105_000 }),
      trade({ floor: 22, price: 110_000 }),
      trade({ floor: 30, price: 110_000 }),
      trade({ floor: 28, price: 110_000 }),
    ];
    const f = floorAnalysis(trades)!;
    expect(f.top).toBe(30);
    expect(f.bands.map((b) => [b.from, b.to, b.count])).toEqual([
      [1, 10, 2],
      [11, 20, 1],
      [21, 30, 3],
    ]);
    expect(f.highVsLow).toBeCloseTo(0.1);
  });

  it('거래가 적거나 저층 건물이면 나누지 않음', () => {
    expect(floorAnalysis([trade({})])).toBeNull();
    expect(floorAnalysis(Array.from({ length: 8 }, (_, i) => trade({ floor: (i % 5) + 1 })))).toBeNull();
  });
});

describe('변화율 글자', () => {
  it('부호와 반올림', () => {
    expect(changeText(0.084)).toBe('+8%');
    expect(changeText(-0.05)).toBe('−5%');
    expect(changeText(0.001)).toBe('변화 없음');
  });
});
