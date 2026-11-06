import { describe, expect, it } from 'vitest';
import { unitScore, type UnitScoreInput } from './unitScore';

const best: UnitScoreInput = {
  windowTotalMinutes: 480,
  windowMaxContinuous: 360,
  meetsCriteria: true,
  azimuthDeg: 180,
  floor: 15,
  topFloor: 25,
  svf: 0.5,
  elementaryM: 200,
  subwayM: 300,
};

describe('세대 생활 환경 점수', () => {
  it('모든 조건이 좋으면 100점 A', () => {
    const s = unitScore(best);
    expect(s.total).toBe(100);
    expect(s.grade).toBe('A');
    expect(s.items.map((i) => i.id)).toEqual(['sun', 'criteria', 'orientation', 'sky', 'floor', 'location']);
  });

  it('북향·일조 없음·저층이면 낮다', () => {
    const s = unitScore({
      ...best,
      windowTotalMinutes: 0,
      windowMaxContinuous: 0,
      meetsCriteria: false,
      azimuthDeg: 0,
      floor: 1,
      svf: 0.2,
    });
    expect(s.total).toBeLessThan(40);
    expect(s.grade).toBe('D');
    expect(s.items.find((i) => i.id === 'orientation')?.score).toBe(0);
  });

  it('동·서향은 향 점수 절반', () => {
    expect(unitScore({ ...best, azimuthDeg: 90 }).items.find((i) => i.id === 'orientation')?.score).toBe(7.5);
    expect(unitScore({ ...best, azimuthDeg: 270 }).items.find((i) => i.id === 'orientation')?.score).toBe(7.5);
  });

  it('천공률·주변 시설이 없으면 그 항목을 빼고 100점으로 환산', () => {
    const s = unitScore({ ...best, svf: null, elementaryM: null, subwayM: null });
    expect(s.items.map((i) => i.id)).toEqual(['sun', 'criteria', 'orientation', 'floor']);
    expect(s.total).toBe(100);
  });

  it('최상층은 층 점수 8점, 1층은 낮게', () => {
    expect(unitScore({ ...best, floor: 25 }).items.find((i) => i.id === 'floor')?.score).toBe(8);
    expect(unitScore({ ...best, floor: 1 }).items.find((i) => i.id === 'floor')?.score).toBeCloseTo(0.8, 1);
  });

  it('입지: 초등학교 1.5km·지하철 2km 밖이면 0', () => {
    const s = unitScore({ ...best, elementaryM: 1600, subwayM: 2500 });
    expect(s.items.find((i) => i.id === 'location')?.score).toBe(0);
  });
});
