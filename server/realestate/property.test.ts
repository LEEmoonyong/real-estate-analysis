import { describe, expect, it } from 'vitest';
import { filterDeals, groupDeals, normalizeDeal, type PropertyDeal } from './property';

const base = { dealYear: '2026', dealMonth: '10', dealDay: '5', umdNm: '잠실동', floor: '3', buildYear: '2015' };

describe('유형별 실거래 정규화', () => {
  it('오피스텔 매매: 이름·전용면적·건물 단위 열쇠', () => {
    const d = normalizeDeal('offi', false, {
      ...base,
      offiNm: '잠실아이스페이스',
      jibun: '7',
      excluUseAr: '29.5',
      dealAmount: '25,000',
    })!;
    expect(d).toMatchObject({ name: '잠실아이스페이스', area: 29.5, price: 25000, masked: false, date: '2026-10-05' });
    expect(d.key).toBe('offi|잠실동|7|잠실아이스페이스');
  });

  it('빌라 전월세: 보증금·월세, 세부 유형', () => {
    const d = normalizeDeal('rh', true, {
      ...base,
      mhouseNm: '해피빌',
      houseType: '다세대',
      jibun: '12-3',
      excluUseAr: '45',
      deposit: '1,000',
      monthlyRent: '65',
    })!;
    expect(d).toMatchObject({ deposit: 1000, monthlyRent: 65, subType: '다세대', price: 0 });
  });

  it('단독·다가구와 상가는 지번이 가려져 동 단위', () => {
    const sh = normalizeDeal('sh', false, {
      ...base,
      houseType: '다가구',
      jibun: '1**',
      totalFloorAr: '200',
      dealAmount: '150,000',
    })!;
    expect(sh).toMatchObject({ masked: true, jibun: '', key: 'sh|잠실동', name: '다가구', area: 200 });
    const nrg = normalizeDeal('nrg', false, {
      ...base,
      buildingUse: '제2종근린생활',
      buildingAr: '80',
      dealAmount: '90,000',
    })!;
    expect(nrg).toMatchObject({ masked: true, name: '제2종근린생활', area: 80 });
  });

  it('필수 값이 없으면 null', () => {
    expect(normalizeDeal('offi', false, { ...base, offiNm: 'x', dealAmount: '100' })).toBeNull();
    expect(normalizeDeal('rh', true, { ...base, excluUseAr: '30' })).toBeNull();
  });
});

const deal = (over: Partial<PropertyDeal>): PropertyDeal => ({
  type: 'rh',
  key: 'k1',
  name: '해피빌',
  subType: '다세대',
  umdName: '잠실동',
  jibun: '1',
  masked: false,
  date: '2026-10-01',
  price: 0,
  deposit: 1000,
  monthlyRent: 50,
  area: 30,
  floor: 2,
  buildYear: 2010,
  cancelled: false,
  ...over,
});

describe('거르기·묶기', () => {
  const list = [
    deal({}),
    deal({ monthlyRent: 0, deposit: 20000 }),
    deal({ area: 50, monthlyRent: 80, date: '2026-10-09' }),
    deal({ key: 'k2', area: 70, monthlyRent: 100 }),
    deal({ cancelled: true }),
  ];

  it('전세·월세와 원룸·투룸(면적 추정)', () => {
    expect(filterDeals(list, 'jeonse', 'all')).toHaveLength(1);
    expect(filterDeals(list, 'wolse', 'all')).toHaveLength(3);
    expect(filterDeals(list, 'wolse', 'one').map((d) => d.area)).toEqual([30]);
    expect(filterDeals(list, 'wolse', 'two').map((d) => d.area)).toEqual([50]);
  });

  it('건물별 묶음: 월세 중앙값·보증금 중앙값·최근 거래 순', () => {
    const g = groupDeals(filterDeals(list, 'wolse', 'all'), 'wolse');
    expect(g[0]).toMatchObject({
      key: 'k1',
      count: 2,
      value: 65,
      depositMedian: 1000,
      lastDate: '2026-10-09',
      level: 'building',
    });
    expect(g[0]!.recent[0]!.date).toBe('2026-10-09');
  });

  it('매매는 ㎡당 중앙값, 동 단위 이름', () => {
    const g = groupDeals(
      [deal({ masked: true, key: 'sh|잠실동', name: '다가구', price: 100000, area: 200, monthlyRent: 0 })],
      'trade',
    );
    expect(g[0]).toMatchObject({ value: 500, level: 'dong', name: '잠실동 다가구' });
  });
});
