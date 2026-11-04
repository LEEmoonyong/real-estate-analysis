// 데이터 소스 건물(RawBuilding) → 3D·계산용 건물(Building)
// 좌표 변환 → 외곽선 정리 → 사용자 보정값(층수·동 번호) 병합 → 높이 결정
import { createProjection, projectRing } from '../geo/localProjection';
import { cleanFootprint } from '../geometry/polygon';
import type { Building, LatLng, RawBuilding } from '../types';

export interface SceneOverrides {
  /** buildingId → 사용자가 보정한 지상층수 */
  floors: Record<string, number>;
  /** buildingId → 사용자가 지정한 동 번호 */
  dongs: Record<string, string>;
}

export interface BuildResult {
  buildings: Building[];
  /** 외곽선이 너무 작거나 잘못되어 제외한 건물 수 */
  dropped: number;
}

/** 실측 높이가 없을 때 높이 = 층수 × 층고 */
export function resolveHeightM(raw: RawBuilding, floors: number, floorHeightM: number, corrected: boolean): number {
  if (!corrected && raw.heightSource === 'measured' && raw.heightM !== null) return raw.heightM;
  return floors * floorHeightM;
}

export function buildBuildings(
  raws: readonly RawBuilding[],
  origin: LatLng,
  floorHeightM: number,
  overrides: SceneOverrides,
): BuildResult {
  const projection = createProjection(origin);
  const buildings: Building[] = [];
  let dropped = 0;

  for (const raw of raws) {
    const cleaned = cleanFootprint(projectRing(projection, raw.footprint));
    if (!cleaned) {
      dropped++;
      continue;
    }
    const correctedFloors = overrides.floors[raw.id];
    const isUserCorrected = correctedFloors !== undefined && correctedFloors !== raw.floors;
    const floors = isUserCorrected ? correctedFloors : raw.floors;
    const userDong = overrides.dongs[raw.id];

    buildings.push({
      id: raw.id,
      source: raw.source,
      ring: cleaned.ring,
      areaM2: cleaned.area,
      floors,
      heightM: resolveHeightM(raw, floors, floorHeightM, isUserCorrected),
      heightSource: isUserCorrected ? 'user' : raw.heightSource,
      isEstimated: !isUserCorrected && raw.heightSource === 'default',
      isUserCorrected,
      originalFloors: raw.floors,
      originalHeightSource: raw.heightSource,
      ...(userDong
        ? { dongNumber: userDong, dongSource: 'user' as const }
        : raw.dongNumber
          ? { dongNumber: raw.dongNumber, dongSource: 'data' as const }
          : {}),
      ...(raw.name ? { name: raw.name } : {}),
      ...(raw.usage ? { usage: raw.usage } : {}),
      geometryRepaired: cleaned.repaired,
    });
  }
  return { buildings, dropped };
}

/** 장면 반경 [m] — 원점에서 가장 먼 정점까지 거리 (카메라·그림자 범위 결정용) */
export function sceneRadius(buildings: readonly Building[]): number {
  let r = 0;
  for (const b of buildings) {
    for (let i = 0; i < b.ring.length; i += 2) r = Math.max(r, Math.hypot(b.ring[i]!, b.ring[i + 1]!));
  }
  return r;
}

/** 장면에서 가장 높은 건물 높이 [m] */
export function maxBuildingHeight(buildings: readonly Building[]): number {
  return buildings.reduce((m, b) => Math.max(m, b.heightM), 0);
}
