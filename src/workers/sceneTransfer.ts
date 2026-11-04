// 장면 → Worker 전송 형식, Worker 부분 결과 → 전체 결과 (메인 스레드 쪽 도우미)

import type { SunlightResult } from '../domain/sunlight/sunlight';
import type { UnitSet } from '../domain/units/generateUnits';
import type { SceneDTO, SunlightPartDTO } from './protocol';

export function toSceneDTO(buildings: readonly { ring: Float64Array; heightM: number }[], units: UnitSet): SceneDTO {
  const offsets = new Uint32Array(buildings.length + 1);
  for (let i = 0; i < buildings.length; i++) offsets[i + 1] = offsets[i]! + buildings[i]!.ring.length;
  const rings = new Float64Array(offsets[buildings.length]!);
  const heights = new Float64Array(buildings.length);
  buildings.forEach((b, i) => {
    rings.set(b.ring, offsets[i]!);
    heights[i] = b.heightM;
  });
  return {
    prisms: { rings, offsets, heights },
    unitPositions: units.positions,
    unitNormals: units.normals,
    unitCount: units.count,
  };
}

/** 계산 결과 + 측정값 (화면 표시·성능 확인용) */
export interface SunlightOutcome extends SunlightResult {
  sceneHash: string;
  unitCount: number;
  rays: number;
  /** 요청부터 결과까지 걸린 시간 [ms] (캐시 적중이면 0) */
  elapsedMs: number;
  workers: number;
  fromCache: boolean;
  /** 칸별로 해가 떠 있으면 1 (타임라인에서 그늘과 밤을 구분) */
  sunUp: Uint8Array;
}

/** from 순서로 정렬된 부분 결과를 세대 순서 배열 하나로 이어 붙인다 */
export function mergeSunlightParts(
  parts: readonly SunlightPartDTO[],
  unitCount: number,
  K: number,
): Pick<SunlightResult, 'mask' | 'totalMinutes' | 'windowTotalMinutes' | 'windowMaxContinuous' | 'meets'> & {
  rays: number;
} {
  const mask = new Uint8Array(unitCount * K);
  const totalMinutes = new Uint16Array(unitCount);
  const windowTotalMinutes = new Uint16Array(unitCount);
  const windowMaxContinuous = new Uint16Array(unitCount);
  const meets = new Uint8Array(unitCount);
  let rays = 0;
  let expected = 0;
  for (const p of parts) {
    if (p.from !== expected) throw new Error(`부분 결과가 비어 있습니다 (${expected}–${p.from})`);
    mask.set(p.mask, p.from * K);
    totalMinutes.set(p.totalMinutes, p.from);
    windowTotalMinutes.set(p.windowTotalMinutes, p.from);
    windowMaxContinuous.set(p.windowMaxContinuous, p.from);
    meets.set(p.meets, p.from);
    rays += p.rays;
    expected = p.to;
  }
  if (expected !== unitCount) throw new Error(`부분 결과가 모자랍니다 (${expected}/${unitCount})`);
  return { mask, totalMinutes, windowTotalMinutes, windowMaxContinuous, meets, rays };
}
