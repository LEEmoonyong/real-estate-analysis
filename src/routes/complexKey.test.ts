import { describe, expect, it } from 'vitest';
import { complexPath, isComplexTab, parseComplexKey, sameTarget, type ComplexTarget } from './complexKey';

const parse = (path: string) => {
  const url = new URL(path, 'http://x');
  const key = url.pathname.split('/')[2];
  return parseComplexKey(key, url.searchParams);
};

describe('단지 주소', () => {
  it('샘플 왕복', () => {
    const t: ComplexTarget = { kind: 'sample', sampleId: 'seoul-jamsil' };
    expect(complexPath(t)).toBe('/complex/sample-seoul-jamsil/sun');
    expect(parse(complexPath(t))).toEqual(t);
  });

  it('좌표 장소 왕복 (이름·주소 포함, 좌표는 소수 6자리)', () => {
    const t: ComplexTarget = {
      kind: 'geo',
      lat: 37.512930855,
      lng: 127.081461187,
      name: '잠실엘스',
      address: '서울 송파구 올림픽로 99',
    };
    const path = complexPath(t);
    expect(path).toMatch(/^\/complex\/geo-37\.512931,127\.081461\/sun\?/);
    expect(parse(path)).toEqual({ ...t, lat: 37.512931, lng: 127.081461 });
  });

  it('잘못된 주소는 null, 이름이 없으면 기본 이름', () => {
    expect(parseComplexKey('geo-abc', new URLSearchParams())).toBeNull();
    expect(parseComplexKey('geo-10,10', new URLSearchParams())).toBeNull(); // 국내 범위 밖
    expect(parseComplexKey('sample-../../etc', new URLSearchParams())).toBeNull();
    expect(parseComplexKey(undefined, new URLSearchParams())).toBeNull();
    expect(parseComplexKey('geo-37.5,127', new URLSearchParams())).toMatchObject({ name: '선택한 위치' });
  });

  it('같은 대상 판단', () => {
    const a: ComplexTarget = { kind: 'geo', lat: 37.5, lng: 127, name: 'A' };
    expect(sameTarget(a, { ...a, name: 'B' })).toBe(true);
    expect(sameTarget(a, { kind: 'sample', sampleId: 'x' })).toBe(false);
    expect(sameTarget({ kind: 'sample', sampleId: 'x' }, { kind: 'sample', sampleId: 'x' })).toBe(true);
    expect(sameTarget(null, null)).toBe(true);
  });

  it('탭 이름 검사', () => {
    expect(isComplexTab('sun')).toBe(true);
    expect(isComplexTab('nope')).toBe(false);
  });
});
