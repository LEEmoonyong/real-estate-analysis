import { describe, expect, it } from 'vitest';
import { findSummary, isSunSummary, summarize, upsertSummary, type SunSummary } from './sunSummary';

const base: SunSummary = {
  name: 'A',
  lat: 37.5,
  lng: 127.1,
  date: '2026-12-21',
  meetsPct: 80,
  medianWindowMin: 300,
  unitCount: 100,
  at: 1,
};

describe('단지 일조 요약', () => {
  it('충족 비율·중앙값', () => {
    const total = [0, 120, 240, 480];
    expect(summarize(total.map((t) => ({ windowTotal: t, meets: t >= 240 })))).toEqual({
      meetsPct: 50,
      medianWindowMin: 180,
      unitCount: 4,
    });
    expect(summarize([])).toBeNull();
  });

  it('같은 단지(400m 안)는 바꾸고 맨 앞에', () => {
    const far = { ...base, name: 'B', lat: 37.6 };
    const list = upsertSummary([base, far], { ...base, lat: 37.5005, meetsPct: 10, at: 2 });
    expect(list.map((s) => [s.name, s.meetsPct])).toEqual([
      ['A', 10],
      ['B', 80],
    ]);
  });

  it('가장 가까운 요약 찾기, 멀면 null', () => {
    const near = { ...base, name: 'near', lat: 37.5003 };
    expect(findSummary([base, near], { lat: 37.5004, lng: 127.1 })?.name).toBe('near');
    expect(findSummary([base], { lat: 37.51, lng: 127.1 })).toBeNull();
  });

  it('검증기', () => {
    expect(isSunSummary(base)).toBe(true);
    expect(isSunSummary({ ...base, meetsPct: 'x' })).toBe(false);
  });
});
