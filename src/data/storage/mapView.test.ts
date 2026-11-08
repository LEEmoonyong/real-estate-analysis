import { describe, expect, it } from 'vitest';
import { isMapView, readMapView, saveMapView } from './mapView';

describe('지도 위치 기억', () => {
  it('국내 범위·확대 수준만 받는다', () => {
    expect(isMapView({ lat: 37.5, lng: 127, level: 5 })).toBe(true);
    expect(isMapView({ lat: 0, lng: 0, level: 5 })).toBe(false);
    expect(isMapView({ lat: 37.5, lng: 127, level: 20 })).toBe(false);
    expect(isMapView('x')).toBe(false);
  });

  it('저장한 위치를 다시 읽는다 (단지 상세에서 돌아올 때)', () => {
    saveMapView({ lat: 37.51, lng: 127.08, level: 4 });
    expect(readMapView()).toEqual({ lat: 37.51, lng: 127.08, level: 4 });
  });
});
