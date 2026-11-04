import { describe, expect, it } from 'vitest';
import { mainFaceStats, monthComputeOrder, monthDate, representativeMonth } from './season';

describe('계절 타임랩스', () => {
  it('대표일은 매월 21일', () => {
    expect(monthDate(2026, 0)).toBe('2026-01-21');
    expect(monthDate(2026, 11)).toBe('2026-12-21');
    expect(representativeMonth('2026-06-21')).toBe(5);
    expect(representativeMonth('2026-12-22')).toBe(-1);
  });

  it('계산 순서: 현재 달 → 12월 → 가까운 달, 12개 모두 한 번씩', () => {
    const order = monthComputeOrder(5);
    expect(order.slice(0, 4)).toEqual([5, 11, 6, 4]);
    expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(monthComputeOrder(11).slice(0, 3)).toEqual([11, 0, 10]);
  });

  it('주향 세대 평균·하위 10%', () => {
    const values = Uint16Array.from([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 999]);
    const main = Uint8Array.from([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0]);
    expect(mainFaceStats(values, main)).toEqual({ mean: 45, p10: 10 });
    expect(mainFaceStats(values, new Uint8Array(11))).toEqual({ mean: 0, p10: 0 });
  });
});
