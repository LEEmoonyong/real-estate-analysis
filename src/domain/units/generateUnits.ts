// 세대 샘플 지점 생성 (PLAN.md 9.4)
//
// 각 건물 외곽선의 변(벽면)마다 unitWidth 간격으로 라인을 나누고, 층마다 창 높이(바닥 + 1.2m)에 샘플 점을 둔다.
// 점은 벽에서 바깥으로 0.05m 띄워 광선이 자기 벽에 바로 막히지 않게 한다.
//
// 세대 수가 수만 개라 객체 배열 대신 필드별 typed array(SoA)로 담는다.
// → Worker로 보낼 때 복사 비용이 작고, 결과 배열(마스크·통계)과 인덱스가 1:1로 맞는다.

import { edgeOutwardNormal } from '../geometry/polygon';
import type { Building } from '../types';
import { formatHo } from './hoNumber';

export interface UnitOptions {
  /** 세대 라인 폭 [m] */
  unitWidthM: number;
  /** 이보다 짧은 변에는 세대를 두지 않는다 [m] */
  minEdgeM: number;
  /** 층 바닥에서 창 중심까지 높이 [m] */
  sillOffsetM: number;
  /** 벽에서 바깥으로 띄우는 거리 [m] */
  normalOffsetM: number;
}

/**
 * 세대를 두는 건물: 주거 용도이거나 용도를 모르는 건물.
 * 상가·학교·종교시설 등은 그림자를 드리우는 장애물로만 쓰고 세대는 만들지 않는다.
 * (OSM building 태그 / V-World 주용도 코드 01000 단독주택·02000 공동주택)
 */
const RESIDENTIAL_USAGES = new Set([
  'apartments',
  'residential',
  'house',
  'detached',
  'dormitory',
  'terrace',
  'yes',
  '01000',
  '02000',
]);

export function isResidentialUsage(usage: string | undefined): boolean {
  return usage === undefined || RESIDENTIAL_USAGES.has(usage);
}

export const DEFAULT_UNIT_OPTIONS: UnitOptions = {
  unitWidthM: 6,
  minEdgeM: 4,
  sillOffsetM: 1.2,
  normalOffsetM: 0.05,
};

export interface UnitSet {
  count: number;
  /** buildings 배열의 인덱스 */
  buildingIndex: Uint32Array;
  floor: Uint16Array;
  faceIndex: Uint16Array;
  lineIndex: Uint16Array;
  /** 주향(거실) 면이면 1 — 호수 대상 */
  isMainFace: Uint8Array;
  /** 주향 면 라인 번호(1부터, 바깥에서 볼 때 왼쪽부터). 측면은 0 */
  hoLine: Uint16Array;
  /** 건물별 주향 면 라인 수 */
  mainLineCount: Uint16Array;
  /** 건물 b의 세대는 [buildingStart[b], buildingStart[b+1]) — 길이 B + 1 (세대는 건물 순서로 연속 배치) */
  buildingStart: Uint32Array;
  /** 세대 라인 폭 [m] (면 길이 ÷ 라인 수) */
  lineWidth: Float32Array;
  /** 층고 [m] (건물 높이 ÷ 층수) */
  floorHeight: Float32Array;
  /** (x, y, z) × count */
  positions: Float32Array;
  /** (nx, nz) × count — 수평 외향 단위 법선 */
  normals: Float32Array;
}

/** 화면 표시용 세대 정보 (부록 A의 Unit) */
export interface Unit {
  id: string;
  buildingId: string;
  floor: number;
  faceIndex: number;
  lineIndex: number;
  isMainFace: boolean;
  position: [number, number, number];
  normal: [number, number, number];
  /** 창이 바라보는 방위 [°] 북=0, 동=90, 남=180 */
  azimuthDeg: number;
  /** 추정 호수 (주향 면만) */
  hoNumber?: string;
}

interface Face {
  index: number;
  ax: number;
  az: number;
  ex: number;
  ez: number;
  length: number;
  nx: number;
  nz: number;
  lines: number;
}

/** 법선 (nx, nz) → 방위각 [°] (북 = −z) */
export function normalAzimuthDeg(nx: number, nz: number): number {
  const deg = (Math.atan2(nx, -nz) * 180) / Math.PI;
  return (deg + 360) % 360;
}

function facesOf(ring: Float64Array, options: UnitOptions): Face[] {
  const n = ring.length / 2;
  const faces: Face[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ax = ring[i * 2]!;
    const az = ring[i * 2 + 1]!;
    const ex = ring[j * 2]! - ax;
    const ez = ring[j * 2 + 1]! - az;
    const length = Math.hypot(ex, ez);
    if (length < options.minEdgeM) continue;
    const [nx, nz] = edgeOutwardNormal(ring, i);
    faces.push({
      index: i,
      ax,
      az,
      ex,
      ez,
      length,
      nx,
      nz,
      lines: Math.max(1, Math.floor(length / options.unitWidthM + 1e-9)),
    }); // 부동소수점 오차로 30m/6m가 4.999…가 되지 않게
  }
  return faces;
}

/**
 * 주향 면 결정: 가장 긴 두 변 중 남쪽 성분(+z)이 큰 변이 기준 면.
 * 탑상형처럼 남측 두 면이 비슷하면(남쪽 성분 차 ≤ 0.15, 길이 ≥ 기준의 70%, 남쪽 성분 > 0.3) 함께 주향 면으로 본다.
 */
export function mainFaces(faces: readonly Face[]): Face[] {
  if (faces.length === 0) return [];
  const byLength = [...faces].sort((a, b) => b.length - a.length);
  const candidates = byLength.slice(0, 2);
  const main = candidates.reduce((best, f) => (f.nz > best.nz ? f : best));
  if (main.nz <= 0.3) return [main];
  return faces.filter((f) => f === main || (f.nz > 0.3 && main.nz - f.nz <= 0.15 && f.length >= main.length * 0.7));
}

export function generateUnits(buildings: readonly Building[], options: UnitOptions = DEFAULT_UNIT_OPTIONS): UnitSet {
  // 1차: 건물별 면 목록과 전체 세대 수
  const perBuilding = buildings.map((b) => {
    const faces = isResidentialUsage(b.usage) ? facesOf(b.ring, options) : [];
    return { faces, main: new Set(mainFaces(faces)) };
  });
  let count = 0;
  buildings.forEach((b, i) => {
    for (const f of perBuilding[i]!.faces) count += f.lines * b.floors;
  });

  const set: UnitSet = {
    count,
    buildingIndex: new Uint32Array(count),
    floor: new Uint16Array(count),
    faceIndex: new Uint16Array(count),
    lineIndex: new Uint16Array(count),
    isMainFace: new Uint8Array(count),
    hoLine: new Uint16Array(count),
    mainLineCount: new Uint16Array(buildings.length),
    buildingStart: new Uint32Array(buildings.length + 1),
    lineWidth: new Float32Array(count),
    floorHeight: new Float32Array(count),
    positions: new Float32Array(count * 3),
    normals: new Float32Array(count * 2),
  };

  let u = 0;
  buildings.forEach((b, bi) => {
    const { faces, main } = perBuilding[bi]!;
    set.buildingStart[bi] = u;

    // 주향 면 라인 번호: 바깥에서 주향 면을 바라볼 때 왼쪽 → 오른쪽 순서.
    // 바라보는 사람의 오른쪽 방향 = 평균 법선 (nx, nz)를 (nz, −nx)로 돌린 벡터
    const mainList = [...main];
    let mx = 0;
    let mz = 0;
    for (const f of mainList) {
      mx += f.nx;
      mz += f.nz;
    }
    const rightX = mz;
    const rightZ = -mx;
    const mainLines: { face: number; line: number; key: number }[] = [];
    for (const f of mainList) {
      for (let j = 0; j < f.lines; j++) {
        const t = (j + 0.5) / f.lines;
        mainLines.push({ face: f.index, line: j, key: (f.ax + f.ex * t) * rightX + (f.az + f.ez * t) * rightZ });
      }
    }
    mainLines.sort((a, b) => a.key - b.key);
    const hoOf = new Map(mainLines.map((m, k) => [`${m.face}:${m.line}`, k + 1]));
    set.mainLineCount[bi] = mainLines.length;

    const floorHeight = b.heightM / b.floors;
    for (const f of faces) {
      const isMain = main.has(f) ? 1 : 0;
      for (let j = 0; j < f.lines; j++) {
        const t = (j + 0.5) / f.lines;
        const px = f.ax + f.ex * t + f.nx * options.normalOffsetM;
        const pz = f.az + f.ez * t + f.nz * options.normalOffsetM;
        const ho = isMain ? (hoOf.get(`${f.index}:${j}`) ?? 0) : 0;
        for (let fl = 1; fl <= b.floors; fl++) {
          set.buildingIndex[u] = bi;
          set.floor[u] = fl;
          set.faceIndex[u] = f.index;
          set.lineIndex[u] = j;
          set.isMainFace[u] = isMain;
          set.hoLine[u] = ho;
          set.positions[u * 3] = px;
          // 층고는 높이 ÷ 층수 (실측 높이가 있는 건물도 층 위치가 지붕을 넘지 않도록)
          set.positions[u * 3 + 1] = (fl - 1) * floorHeight + Math.min(options.sillOffsetM, floorHeight * 0.5);
          set.positions[u * 3 + 2] = pz;
          set.normals[u * 2] = f.nx;
          set.normals[u * 2 + 1] = f.nz;
          set.lineWidth[u] = f.length / f.lines;
          set.floorHeight[u] = floorHeight;
          u++;
        }
      }
    }
  });
  set.buildingStart[buildings.length] = u;
  return set;
}

/** 세대 id 형식: `${buildingId}:${면}:${라인}:${층}` */
export function unitId(buildingId: string, face: number, line: number, floor: number): string {
  return `${buildingId}:${face}:${line}:${floor}`;
}

/** SoA의 i번째 세대를 화면 표시용 객체로 */
export function unitAt(set: UnitSet, i: number, buildings: readonly Building[]): Unit {
  const bi = set.buildingIndex[i]!;
  const b = buildings[bi]!;
  const nx = set.normals[i * 2]!;
  const nz = set.normals[i * 2 + 1]!;
  const hoLine = set.hoLine[i]!;
  const floor = set.floor[i]!;
  return {
    id: unitId(b.id, set.faceIndex[i]!, set.lineIndex[i]!, floor),
    buildingId: b.id,
    floor,
    faceIndex: set.faceIndex[i]!,
    lineIndex: set.lineIndex[i]!,
    isMainFace: set.isMainFace[i] === 1,
    position: [set.positions[i * 3]!, set.positions[i * 3 + 1]!, set.positions[i * 3 + 2]!],
    normal: [nx, 0, nz],
    azimuthDeg: normalAzimuthDeg(nx, nz),
    hoNumber: hoLine > 0 ? formatHo(floor, hoLine, set.mainLineCount[bi]!) : undefined,
  };
}

/** 세대 id → 인덱스 (없으면 -1). 건물 id에 ':'가 들어갈 수 있어 뒤에서부터 나눈다 */
export function findUnitIndex(set: UnitSet, buildings: readonly Building[], id: string): number {
  const parts = id.split(':');
  if (parts.length < 4) return -1;
  const floor = Number(parts.at(-1));
  const line = Number(parts.at(-2));
  const face = Number(parts.at(-3));
  const buildingId = parts.slice(0, -3).join(':');
  const bi = buildings.findIndex((b) => b.id === buildingId);
  if (bi < 0) return -1;
  for (let i = set.buildingStart[bi]!; i < set.buildingStart[bi + 1]!; i++) {
    if (set.faceIndex[i] === face && set.lineIndex[i] === line && set.floor[i] === floor) return i;
  }
  return -1;
}

/**
 * 건물 표면의 한 점에서 가장 가까운 세대 (3D 클릭 → 세대 선택).
 * 수만 개 창문 패치를 매번 광선 검사하는 대신, 건물 메시의 클릭 지점으로 그 건물 세대만 찾는다.
 * 지붕을 클릭했으면(지붕 높이와 같으면) -1.
 */
export function nearestUnitOnBuilding(
  set: UnitSet,
  buildingIndex: number,
  point: [number, number, number],
  roofHeightM: number,
): number {
  if (point[1] >= roofHeightM - 0.05) return -1;
  let best = -1;
  let bestDist = Infinity;
  for (let i = set.buildingStart[buildingIndex]!; i < set.buildingStart[buildingIndex + 1]!; i++) {
    // 같은 층을 우선하도록 높이 차에 가중치
    const dx = set.positions[i * 3]! - point[0];
    const dy = (set.positions[i * 3 + 1]! - point[1]) * 1.5;
    const dz = set.positions[i * 3 + 2]! - point[2];
    const d = dx * dx + dy * dy + dz * dz;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}
