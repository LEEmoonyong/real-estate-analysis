import { describe, expect, it } from 'vitest';
import {
  bandsWithTrades,
  distanceM,
  jeonseRatio,
  median,
  monthlyJeonseMedians,
  monthlyTradeMedians,
  nearbyTradeComplexes,
  recentMonths,
} from './aggregate';
import type { AptRent, AptTrade, TradeComplex } from './types';

const trade = (date: string, price: number, area = 84, cancelled = false): AptTrade => ({
  aptSeq: '1',
  aptName: 'A',
  umdName: '잠실동',
  jibun: '19',
  date,
  price,
  area,
  floor: 10,
  buildYear: 2008,
  cancelled,
  dealType: '',
});
const rent = (date: string, deposit: number, monthlyRent = 0, area = 84): AptRent => ({
  aptSeq: '1',
  aptName: 'A',
  umdName: '잠실동',
  jibun: '19',
  date,
  deposit,
  monthlyRent,
  area,
  floor: 10,
  buildYear: 2008,
  contractType: '',
});

describe('시세 집계', () => {
  it('중앙값', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it('최근 n달 (해 넘김)', () => {
    expect(recentMonths('202602', 4)).toEqual(['202511', '202512', '202601', '202602']);
  });

  it('달별 매매 중앙값 — 해제 제외, 평형대 필터, 거래 없는 달은 null', () => {
    const trades = [
      trade('2026-09-01', 300000),
      trade('2026-09-15', 320000),
      trade('2026-09-20', 999999, 84, true),
      trade('2026-09-21', 150000, 59),
      trade('2026-10-02', 310000),
    ];
    expect(monthlyTradeMedians(trades, ['202608', '202609', '202610'], 'mid')).toEqual([
      { month: '2026-08', median: null, count: 0 },
      { month: '2026-09', median: 310000, count: 2 },
      { month: '2026-10', median: 310000, count: 1 },
    ]);
    expect(monthlyTradeMedians(trades, ['202609'])[0]).toMatchObject({ count: 3, median: 300000 });
    expect(bandsWithTrades(trades)).toEqual([
      { band: 'mid', count: 3 },
      { band: 'small', count: 1 },
    ]);
  });

  it('전세 중앙값은 월세 없는 계약만, 전세가율', () => {
    const rents = [rent('2026-09-01', 150000), rent('2026-09-05', 170000), rent('2026-09-09', 50000, 200)];
    expect(monthlyJeonseMedians(rents, ['202609'])[0]).toEqual({ month: '2026-09', median: 160000, count: 2 });
    expect(jeonseRatio(320000, 160000)).toBe(0.5);
    expect(jeonseRatio(null, 160000)).toBeNull();
  });

  it('근처 거래 단지 (가까운 순, 좌표 없는 단지 제외)', () => {
    const c = (aptSeq: string, lat: number | null, lng: number | null): TradeComplex => ({
      aptSeq,
      aptName: aptSeq,
      umdName: '',
      jibun: '',
      buildYear: null,
      count: 1,
      medianPricePerM2: 1,
      lastDate: '',
      lastPrice: 1,
      lastArea: 1,
      lat,
      lng,
    });
    const at = { lat: 37.5, lng: 127 };
    const near = nearbyTradeComplexes([c('far', 37.51, 127), c('near', 37.5005, 127), c('none', null, null)], at, 400);
    expect(near.map((x) => x.aptSeq)).toEqual(['near']);
    expect(Math.round(distanceM(at, { lat: 37.501, lng: 127 }))).toBe(111);
  });
});
