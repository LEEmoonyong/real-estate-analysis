import { describe, expect, it } from 'vitest';
import { outerRings, simplifyRing, unionRings } from './boundary';
import { regionLevel } from './geocode';

describe('행정구역 경계 좌표 줄이기', () => {
  it('앞 점과 가까운 점은 버리고 첫·끝 점은 남긴다', () => {
    const ring: [number, number][] = [
      [127, 37],
      [127.00001, 37],
      [127.001, 37],
      [127.001, 37.001],
      [127.00100001, 37.00100002],
      [127, 37],
    ];
    const out = simplifyRing(ring, 0.0001);
    expect(out[0]).toEqual([127, 37]);
    expect(out.at(-1)).toEqual([127, 37]);
    expect(out).toHaveLength(4);
  });

  it('너무 줄면 원본(반올림만)을 쓴다', () => {
    const tri: [number, number][] = [
      [127, 37],
      [127.000001, 37],
      [127, 37.000001],
      [127, 37],
    ];
    expect(simplifyRing(tri, 1)).toHaveLength(4);
  });

  it('Polygon·MultiPolygon의 바깥 고리만', () => {
    const r = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ];
    expect(outerRings({ type: 'Polygon', coordinates: [r, r] })).toHaveLength(1);
    expect(outerRings({ type: 'MultiPolygon', coordinates: [[r], [r, r]] })).toHaveLength(2);
    expect(outerRings({ type: 'Point', coordinates: [0, 0] })).toEqual([]);
  });
});

describe('구 경계 합치기 (시 단계)', () => {
  it('맞닿은 두 사각형 → 바깥 테두리 하나 (공유 변 제거)', () => {
    const left: [number, number][] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ];
    const right: [number, number][] = [
      [1, 0],
      [2, 0],
      [2, 1],
      [1, 1],
      [1, 0],
    ];
    const out = unionRings([left, right]);
    expect(out).toHaveLength(1);
    // 공유 변(1,0)-(1,1)이 빠져 꼭짓점 6개 + 닫는 점
    expect(out[0]).toHaveLength(7);
  });
  it('떨어진 고리는 그대로', () => {
    const a: [number, number][] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ];
    const b: [number, number][] = [
      [5, 5],
      [6, 5],
      [6, 6],
      [5, 5],
    ];
    expect(unionRings([a, b])).toHaveLength(2);
  });
});

describe('검색 결과의 지역 단계 (카카오 2026-11 실측 형식)', () => {
  const doc = (name: string, r2: string, r3: string, h = '') => ({
    address_name: name,
    address_type: 'REGION',
    address: { region_2depth_name: r2, region_3depth_name: r3, region_3depth_h_name: h },
    x: '127',
    y: '37',
  });
  it('시·도 / 시·군·구(일반구 포함) / 읍·면·동 / 리', () => {
    expect(regionLevel(doc('경기', '', ''))).toBe('sido');
    expect(regionLevel(doc('서울 송파구', '송파구', ''))).toBe('sigungu');
    expect(regionLevel(doc('경기 수원시 장안구', '수원시 장안구', ''))).toBe('sigungu');
    expect(regionLevel(doc('경기 광주시 남한산성면', '광주시', '남한산성면', '남한산성면'))).toBe('emd');
    expect(regionLevel(doc('경기 광주시 남한산성면 산성리', '광주시', '남한산성면 산성리'))).toBe('ri');
  });
  it('행정동·도로명 주소는 테두리 없음', () => {
    expect(regionLevel(doc('서울 송파구 잠실본동', '송파구', '', '잠실본동'))).toBeUndefined();
    expect(
      regionLevel({ ...doc('서울 송파구 올림픽로 300', '송파구', '신천동'), address_type: 'ROAD_ADDR' }),
    ).toBeUndefined();
  });
});
