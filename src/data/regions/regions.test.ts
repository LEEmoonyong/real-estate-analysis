import { describe, expect, it } from 'vitest';
import { REGIONS, SIDO_LIST, findRegion, regionLabel, shortSido, sidoCenter, sigunguOf } from './regions';

describe('시·도 / 시·군·구 목록', () => {
  it('17개 시·도, 실거래 코드는 5자리이고 겹치지 않는다', () => {
    expect(SIDO_LIST).toHaveLength(17);
    expect(REGIONS.every((r) => /^\d{5}$/.test(r.lawdCode))).toBe(true);
    expect(new Set(REGIONS.map((r) => r.lawdCode)).size).toBe(REGIONS.length);
  });

  it('개편된 지역과 특수 코드', () => {
    expect(findRegion('11710')?.sigungu).toBe('송파구');
    expect(findRegion('36110')?.sido).toBe('세종특별자치시'); // 세종은 36110으로 조회
    expect(sigunguOf('인천광역시').map((r) => r.sigungu)).toContain('검단구');
    expect(sigunguOf('경기도').map((r) => r.sigungu)).toContain('화성시 동탄구');
  });

  it('이름 줄이기와 시·도 중심', () => {
    expect(shortSido('서울특별시')).toBe('서울');
    expect(shortSido('경상남도')).toBe('경남');
    expect(regionLabel({ sido: '경기도', sigungu: '수원시 장안구' })).toBe('경기 수원시 장안구');
    expect(regionLabel({ sido: '세종특별자치시', sigungu: '' })).toBe('세종특별자치시');
    const c = sidoCenter('서울특별시')!;
    expect(c.lat).toBeGreaterThan(37.4);
    expect(c.lat).toBeLessThan(37.7);
  });
});
