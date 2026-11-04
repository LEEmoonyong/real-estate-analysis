// 카메라 이동 목표 계산 (동·호수 검색 → 세대/건물을 화면 가운데로)
// three.js에 의존하지 않는 순수 함수 — 단위 테스트한다.
import type { Vec3 } from '../domain/types';

export interface CameraPose {
  position: Vec3;
  lookAt: Vec3;
}

/** 세대를 볼 때 올려다보지 않고 약간 위에서 내려다보는 각도 */
const UNIT_ELEVATION_RAD = (22 * Math.PI) / 180;

/**
 * 세대 창문 정면 바깥에서 바라보는 시점.
 * 거리는 건물 높이에 비례(낮은 동은 가깝게, 초고층은 멀리)하되 70~170m로 제한한다.
 */
export function unitFocusPose(position: Vec3, normal: [number, number], buildingHeightM: number): CameraPose {
  const distance = Math.min(170, Math.max(70, buildingHeightM * 1.2));
  const [px, py, pz] = position;
  const [nx, nz] = normal;
  const horizontal = distance * Math.cos(UNIT_ELEVATION_RAD);
  return {
    position: [px + nx * horizontal, Math.max(3, py + distance * Math.sin(UNIT_ELEVATION_RAD)), pz + nz * horizontal],
    lookAt: [px, py, pz],
  };
}

/**
 * 건물 전체가 보이는 시점 — 현재 카메라가 바라보는 방향은 유지하고 거리만 맞춘다.
 * @param ring 로컬 평면 외곽선 (x, z)…
 * @param viewDir 현재 시선의 반대 방향(대상 → 카메라) 단위 벡터
 */
export function buildingFocusPose(ring: Float64Array, heightM: number, viewDir: Vec3): CameraPose {
  const n = ring.length / 2;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < n; i++) {
    cx += ring[i * 2]!;
    cz += ring[i * 2 + 1]!;
  }
  cx /= n;
  cz /= n;
  let r = 0;
  for (let i = 0; i < n; i++) r = Math.max(r, Math.hypot(ring[i * 2]! - cx, ring[i * 2 + 1]! - cz));
  const lookAt: Vec3 = [cx, heightM * 0.5, cz];
  // 너무 수평이면(지면에 붙은 시선) 위에서 보도록 고도를 올린다
  let [dx, dy, dz] = viewDir;
  if (dy < 0.35) {
    const h = Math.hypot(dx, dz) || 1;
    dx = (dx / h) * 0.9;
    dz = (dz / h) * 0.9;
    dy = 0.45;
    const len = Math.hypot(dx, dy, dz);
    dx /= len;
    dy /= len;
    dz /= len;
  }
  const distance = Math.max(80, heightM * 2, r * 3);
  return {
    position: [lookAt[0] + dx * distance, lookAt[1] + dy * distance, lookAt[2] + dz * distance],
    lookAt,
  };
}

/** 0~1 → 0~1, 시작과 끝이 부드러운 보간 */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}
