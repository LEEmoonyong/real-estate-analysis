import { describe, expect, it } from 'vitest';
import type { AptTrade } from '../../domain/realestate/types';
import {
  alertMonths,
  isWatchedComplex,
  latestDealDate,
  markSeen,
  newDeals,
  toggleWatched,
  type WatchedComplex,
} from './watchlist';

const w: WatchedComplex = {
  aptSeq: '11710-6346',
  lawd: '11710',
  name: '잠실엘스',
  lat: 37.51,
  lng: 127.08,
  area: '서울특별시 송파구',
  addedAt: 1,
  seenDealDate: '2026-10-10',
};

const trade = (date: string, extra: Partial<AptTrade> = {}): AptTrade => ({
  aptSeq: '11710-6346',
  aptName: '잠실엘스',
  umdName: '잠실동',
  jibun: '19',
  date,
  price: 330_000,
  area: 84.8,
  floor: 10,
  buildYear: 2008,
  cancelled: false,
  dealType: '중개거래',
  ...extra,
});

describe('관심 단지', () => {
  it('넣고 빼기', () => {
    const added = toggleWatched([], w);
    expect(added).toHaveLength(1);
    expect(toggleWatched(added, w)).toHaveLength(0);
  });

  it('새 거래: 본 날짜 이후, 해제·다른 단지 제외, 최신순', () => {
    const trades = [
      trade('2026-10-10'),
      trade('2026-10-20'),
      trade('2026-11-02'),
      trade('2026-10-25', { cancelled: true }),
      trade('2026-10-30', { aptSeq: '11710-1' }),
    ];
    expect(newDeals(trades, w).map((t) => t.date)).toEqual(['2026-11-02', '2026-10-20']);
    expect(latestDealDate(trades, w.aptSeq)).toBe('2026-11-02');
  });

  it('확인 날짜는 앞으로만', () => {
    const list = [w];
    expect(markSeen(list, w.aptSeq, '2026-09-01')).toBe(list);
    expect(markSeen(list, w.aptSeq, '2026-11-02')[0]!.seenDealDate).toBe('2026-11-02');
  });

  it('확인할 달: 이번 달·지난달 (KST)', () => {
    expect(alertMonths(new Date('2026-11-06T03:00:00Z'))).toEqual(['202611', '202610']);
    expect(alertMonths(new Date('2026-12-31T16:00:00Z'))).toEqual(['202701', '202612']);
  });

  it('검증기', () => {
    expect(isWatchedComplex(w)).toBe(true);
    expect(isWatchedComplex({ ...w, lat: 'x' })).toBe(false);
  });
});
