import { describe, expect, it } from 'vitest';
import { generateUnits } from '../units/generateUnits';
import { impactSummary, lossPerUnit, virtualRing, virtualToBuilding, type VirtualBuilding } from './virtualBuilding';

const v: VirtualBuilding = { id: 'virtual:1', x: 10, z: -20, widthM: 40, depthM: 20, floors: 20, rotationDeg: 0 };

describe('가상 건물', () => {
  it('직사각형 꼭짓점과 면적·높이', () => {
    const ring = virtualRing(v);
    expect(Array.from(ring)).toEqual([-10, -30, 30, -30, 30, -10, -10, -10]);
    const b = virtualToBuilding(v, 2.9, 0)!;
    expect(b.areaM2).toBeCloseTo(800, 6);
    expect(b.heightM).toBeCloseTo(58, 6);
    expect(b.isVirtual).toBe(true);
    expect(b.name).toBe('가상 건물 1');
  });

  it('90° 돌리면 폭과 깊이가 바뀐다', () => {
    const ring = virtualRing({ ...v, x: 0, z: 0, rotationDeg: 90 });
    const xs = [ring[0]!, ring[2]!, ring[4]!, ring[6]!];
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(20, 6);
  });

  it('세대를 만들지 않는다 (기존 세대 번호 유지)', () => {
    expect(generateUnits([virtualToBuilding(v, 2.9, 0)!]).count).toBe(0);
  });
});

describe('영향 요약', () => {
  it('감소 세대·기준 탈락·충족 비율', () => {
    const s = impactSummary({
      beforeTotal: [300, 300, 200, 100],
      afterTotal: [300, 200, 150, 100],
      beforeMeets: [1, 1, 0, 0],
      afterMeets: [1, 0, 0, 0],
      isMainFace: [1, 1, 1, 1],
    });
    expect(s).toEqual({
      units: 4,
      affected: 2,
      newlyFailing: 1,
      maxLossMin: 100,
      avgLossMin: 75,
      meetsPctBefore: 50,
      meetsPctAfter: 25,
    });
  });

  it('주향 면이 아닌 세대는 빼고, 늘어난 곳은 감소 0', () => {
    const s = impactSummary({
      beforeTotal: [100, 100],
      afterTotal: [0, 0],
      beforeMeets: [0, 0],
      afterMeets: [0, 0],
      isMainFace: [1, 0],
    });
    expect(s.units).toBe(1);
    expect(Array.from(lossPerUnit([100, 50], [120, 20]))).toEqual([0, 30]);
  });
});
