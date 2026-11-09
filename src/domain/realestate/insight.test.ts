import { describe, expect, it } from 'vitest';
import {
  areaMedians,
  clusterByScreen,
  compareWithArea,
  diffFromAverage,
  jeonseRisk,
  placeJeonseRatios,
  similarComplexes,
  toScreen,
  type SimilarCandidate,
} from './insight';
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

describe('전세가율 위험 단계', () => {
  it('70 / 80 / 90% 경계', () => {
    expect(jeonseRisk(0.69).level).toBe('low');
    expect(jeonseRisk(0.7).level).toBe('mid');
    expect(jeonseRisk(0.8).level).toBe('high');
    expect(jeonseRisk(0.9).level).toBe('danger');
  });
});

describe('동·시군구 평균과 비교', () => {
  const months = ['202601', '202602', '202603', '202604', '202605', '202606', '202607', '202608', '202609', '202610'];

  it('최근 3달 ㎡당 중앙값 — 해제 거래 제외', () => {
    const all = [
      trade({ price: 120_000 }), // 이 단지 1200/㎡
      trade({ aptSeq: 'B', price: 100_000 }), // 같은 동 1000
      trade({ aptSeq: 'C', umdName: '신천동', price: 60_000 }), // 다른 동 600
      trade({ aptSeq: 'B', price: 999_999, cancelled: true }),
    ];
    const c = compareWithArea(all, months, 'A', '잠실동', '송파구');
    expect(c.months).toBe(3);
    expect(c.complex).toBe(1_200);
    expect(c.dong).toEqual({ name: '잠실동', perM2: 1_100, count: 2 });
    expect(c.sigungu.perM2).toBe(1_000);
    expect(diffFromAverage(c.complex, c.dong.perM2)).toBeCloseTo(0.0909, 3);
  });

  it('최근 3달 거래가 없으면 12달로 넓힘', () => {
    const all = [trade({ date: '2026-02-10' }), trade({ aptSeq: 'B', price: 50_000 })];
    const c = compareWithArea(all, months, 'A', '잠실동', '송파구');
    expect(c.months).toBe(10);
    expect(c.complex).toBe(1_000);
  });

  it('평균이 없으면 차이도 없음', () => {
    expect(diffFromAverage(1, null)).toBeNull();
  });
});

describe('비슷한 단지', () => {
  const base = { aptSeq: 'A', lat: 37.5, lng: 127.1, perM2: 1_000, area: 84, buildYear: 2010 };
  const c = (p: Partial<SimilarCandidate>): SimilarCandidate => ({
    aptSeq: 'X',
    aptName: 'X',
    umdName: '잠실동',
    jibun: '1',
    lat: 37.501,
    lng: 127.1,
    buildYear: 2010,
    medianPricePerM2: 1_000,
    ...p,
  });

  it('가격·면적·연식·거리가 비슷한 순, 자기 자신·너무 다른 곳·반경 밖은 제외', () => {
    const areas = new Map([
      ['near', 84],
      ['old', 84],
      ['big', 150],
      ['far', 84],
    ]);
    const list = [
      c({ aptSeq: 'A' }),
      c({ aptSeq: 'old', buildYear: 1990 }),
      c({ aptSeq: 'near' }),
      c({ aptSeq: 'big' }),
      c({ aptSeq: 'pricey', medianPricePerM2: 2_000 }),
      c({ aptSeq: 'far', lat: 37.6 }),
    ];
    expect(similarComplexes(base, list, areas).map((s) => s.aptSeq)).toEqual(['near', 'old']);
  });

  it('단지별 면적 중앙값', () => {
    expect(
      areaMedians([trade({ area: 59 }), trade({ area: 84 }), trade({ area: 999, cancelled: true })]).get('A'),
    ).toBe(71.5);
  });
});

describe('지도 표시 묶기', () => {
  it('가로·세로 범위 안이면 한 묶음', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 50, y: 20 },
      { x: 200, y: 0 },
      { x: 0, y: 100 },
    ];
    expect(clusterByScreen(pts)).toEqual([[0, 1], [2], [3]]);
  });

  it('위경도 → 화면 좌표', () => {
    const b = { south: 37, west: 127, north: 38, east: 128 };
    expect(toScreen({ lat: 37.5, lng: 127.25 }, b, { width: 400, height: 200 })).toEqual({ x: 100, y: 100 });
  });
});

describe('건물별 전세가율', () => {
  it('㎡당 전세 ÷ ㎡당 매매, 짝이 없으면 없음', () => {
    const r = placeJeonseRatios(
      [
        { key: 'a', value: 1_000 },
        { key: 'b', value: 500 },
      ],
      [
        { key: 'a', value: 60_000, areaMedian: 100 },
        { key: 'c', value: 1, areaMedian: 1 },
      ],
    );
    expect(r.get('a')).toBeCloseTo(0.6);
    expect(r.has('b')).toBe(false);
  });
});
