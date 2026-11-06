// 가상 건물 영향 분석 (확장 X6) — "여기에 N층 건물이 들어서면 우리 세대 일조가 얼마나 줄까?"
// 가상 건물은 직사각형 상자로 단순화하고, 기존 건물 뒤에 붙여 계산한다.
// 세대는 만들지 않으므로(용도 = 가상 건물) 기존 세대 순서·개수가 그대로 유지되어 전후 값을 같은 번호끼리 비교할 수 있다.
import { cleanFootprint } from '../geometry/polygon';
import type { Building } from '../types';

export const VIRTUAL_USAGE = '가상 건물';
export const VIRTUAL_ID_PREFIX = 'virtual:';

export interface VirtualBuilding {
  id: string;
  /** 중심 로컬 좌표 [m] (x = 동쪽, z = 남쪽) */
  x: number;
  z: number;
  /** 동서 폭·남북 깊이 [m] (회전 전) */
  widthM: number;
  depthM: number;
  floors: number;
  /** 시계 방향 회전 [°] */
  rotationDeg: number;
}

export const VIRTUAL_LIMITS = {
  widthM: { min: 10, max: 120 },
  depthM: { min: 10, max: 60 },
  floors: { min: 1, max: 70 },
} as const;

export const isVirtualId = (id: string) => id.startsWith(VIRTUAL_ID_PREFIX);

/** 직사각형 네 꼭짓점 (x0, z0, …) — 정리(cleanFootprint)를 거쳐 실제 건물과 같은 방향 규칙을 따른다 */
export function virtualRing(v: VirtualBuilding): Float64Array {
  const hw = v.widthM / 2;
  const hd = v.depthM / 2;
  const t = (v.rotationDeg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  const corners: [number, number][] = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ];
  const ring = new Float64Array(8);
  corners.forEach(([dx, dz], i) => {
    ring[i * 2] = v.x + dx * c - dz * s;
    ring[i * 2 + 1] = v.z + dx * s + dz * c;
  });
  return ring;
}

export function virtualToBuilding(v: VirtualBuilding, floorHeightM: number, index: number): Building | null {
  const cleaned = cleanFootprint(virtualRing(v));
  if (!cleaned) return null;
  return {
    id: v.id,
    source: 'sample',
    ring: cleaned.ring,
    areaM2: cleaned.area,
    floors: v.floors,
    heightM: v.floors * floorHeightM,
    heightSource: 'user',
    isEstimated: false,
    isUserCorrected: false,
    originalFloors: v.floors,
    originalHeightSource: 'floors',
    name: `가상 건물 ${index + 1}`,
    usage: VIRTUAL_USAGE,
    geometryRepaired: false,
    isVirtual: true,
  };
}

export interface ImpactInput {
  /** 가상 건물 전·후 08~16시 총 일조 [분] (같은 세대 순서) */
  beforeTotal: ArrayLike<number>;
  afterTotal: ArrayLike<number>;
  beforeMeets: ArrayLike<number>;
  afterMeets: ArrayLike<number>;
  /** 주향(거실) 면 세대만 센다 */
  isMainFace: ArrayLike<number>;
}

export interface ImpactSummary {
  /** 비교한 세대 수 (주향 면) */
  units: number;
  /** 30분 이상 줄어든 세대 */
  affected: number;
  /** 기준 충족 → 미충족이 된 세대 */
  newlyFailing: number;
  /** 가장 크게 줄어든 시간 [분] */
  maxLossMin: number;
  /** 영향받은 세대의 평균 감소 [분] */
  avgLossMin: number;
  /** 충족 비율 전·후 [%] */
  meetsPctBefore: number;
  meetsPctAfter: number;
}

export const AFFECTED_LOSS_MIN = 30;

/** 세대별 감소량 [분] (늘어난 곳은 0) */
export function lossPerUnit(before: ArrayLike<number>, after: ArrayLike<number>): Float32Array {
  const out = new Float32Array(before.length);
  for (let i = 0; i < before.length; i++) out[i] = Math.max(0, before[i]! - (after[i] ?? 0));
  return out;
}

export function impactSummary(input: ImpactInput): ImpactSummary {
  let units = 0;
  let affected = 0;
  let lossSum = 0;
  let newlyFailing = 0;
  let maxLoss = 0;
  let meetsBefore = 0;
  let meetsAfter = 0;
  for (let i = 0; i < input.beforeTotal.length; i++) {
    if (!input.isMainFace[i]) continue;
    units++;
    const loss = Math.max(0, input.beforeTotal[i]! - input.afterTotal[i]!);
    if (loss >= AFFECTED_LOSS_MIN) {
      affected++;
      lossSum += loss;
    }
    maxLoss = Math.max(maxLoss, loss);
    if (input.beforeMeets[i]) meetsBefore++;
    if (input.afterMeets[i]) meetsAfter++;
    if (input.beforeMeets[i] && !input.afterMeets[i]) newlyFailing++;
  }
  const pct = (n: number) => (units ? Math.round((n / units) * 1000) / 10 : 0);
  return {
    units,
    affected,
    newlyFailing,
    maxLossMin: maxLoss,
    avgLossMin: affected ? Math.round(lossSum / affected) : 0,
    meetsPctBefore: pct(meetsBefore),
    meetsPctAfter: pct(meetsAfter),
  };
}
