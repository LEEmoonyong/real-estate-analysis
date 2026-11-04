// 지역 접평면 좌표 변환 (PLAN.md 9.2)
//
// 축 규칙 (three.js 오른손 좌표계와 일치, 단위 m):
//   원점 = 검색 중심, +x = 동, +y = 위, +z = 남 (따라서 북 = −z)
//
// WGS84 타원체의 원점 위도 곡률 반경을 쓰는 등장방형 근사:
//   x =  N(φ0)·cos φ0·(λ − λ0)
//   z = −M(φ0)·(φ − φ0)
// 반경 500m 안에서 오차는 약 0.03m 수준 (주요 항: x·tan φ0·Δφ) — 건물 외곽선 오차보다 훨씬 작다.
import type { LatLng } from '../types';

const WGS84_A = 6_378_137; // 장반경 [m]
const WGS84_E2 = 0.00669437999014; // 제1 이심률 제곱
const RAD = Math.PI / 180;

export interface LocalProjection {
  readonly origin: LatLng;
  /** 경도·위도 → 로컬 (x, z) [m] */
  toLocal(lng: number, lat: number): [number, number];
  /** 로컬 (x, z) [m] → [경도, 위도] */
  toLngLat(x: number, z: number): [number, number];
}

/** 자오선 곡률 반경 M(φ) [m] */
export function meridianRadius(latDeg: number): number {
  const s = Math.sin(latDeg * RAD);
  return (WGS84_A * (1 - WGS84_E2)) / (1 - WGS84_E2 * s * s) ** 1.5;
}

/** 묘유선 곡률 반경 N(φ) [m] */
export function primeVerticalRadius(latDeg: number): number {
  const s = Math.sin(latDeg * RAD);
  return WGS84_A / Math.sqrt(1 - WGS84_E2 * s * s);
}

export function createProjection(origin: LatLng): LocalProjection {
  const metersPerRadLat = meridianRadius(origin.lat);
  const metersPerRadLng = primeVerticalRadius(origin.lat) * Math.cos(origin.lat * RAD);
  return {
    origin,
    toLocal(lng, lat) {
      return [metersPerRadLng * (lng - origin.lng) * RAD, -metersPerRadLat * (lat - origin.lat) * RAD];
    },
    toLngLat(x, z) {
      return [origin.lng + x / metersPerRadLng / RAD, origin.lat - z / metersPerRadLat / RAD];
    },
  };
}

/** 경위도 링 → 로컬 좌표 Float64Array (x0, z0, x1, z1, …) */
export function projectRing(projection: LocalProjection, ring: readonly (readonly [number, number])[]): Float64Array {
  const out = new Float64Array(ring.length * 2);
  ring.forEach(([lng, lat], i) => {
    const [x, z] = projection.toLocal(lng, lat);
    out[i * 2] = x;
    out[i * 2 + 1] = z;
  });
  return out;
}
