// [요구사항: 데이터 처리] 외부 API(V-World 행정구역 경계, 서버 프록시 /api/boundary) — 지도에 지역 테두리
import { pointInPolygon } from '../../domain/geometry/polygon';
import { getJson } from '../apiClient';

/** si = 시 (광역시·특별시는 시·도, 구가 있는 시는 구를 합친 시) */
export type BoundaryLevel = 'sido' | 'si' | 'sigungu' | 'emd' | 'ri';

export interface Boundary {
  level: BoundaryLevel;
  /** 예: 경기도 광주시 남한산성면 */
  name: string;
  code: string;
  /** 바깥 고리들 [경도, 위도] */
  rings: [number, number][][];
}

export interface BoundaryQuery {
  level: BoundaryLevel;
  lat: number;
  lng: number;
  /** 이름으로 먼저 찾을 때 (동): 법정동 이름 + 시·군·구 코드 */
  name?: string;
  sig?: string;
}

const cache = new Map<string, Promise<Boundary>>();

export function getBoundary(q: BoundaryQuery, signal?: AbortSignal): Promise<Boundary> {
  const params = new URLSearchParams({ level: q.level, lat: q.lat.toFixed(6), lng: q.lng.toFixed(6) });
  if (q.name && q.sig) {
    params.set('name', q.name);
    params.set('sig', q.sig);
  }
  const key = params.toString();
  const hit = cache.get(key);
  if (hit) return hit;
  const p = getJson<Boundary & { ok: true }>(`/api/boundary?${key}`, signal);
  cache.set(key, p);
  p.catch(() => cache.delete(key)); // 실패는 다시 시도할 수 있게
  return p;
}

/** 점(위도·경도)이 테두리 안(바깥 고리 중 하나)에 있는지 — 테두리 안을 눌렀는지 판별 */
export function boundaryContains(b: Pick<Boundary, 'rings'>, lat: number, lng: number): boolean {
  return b.rings.some((ring) => pointInPolygon(lng, lat, Float64Array.from(ring.flat())));
}

/**
 * 지도 확대 수준(카카오 1=가장 가까이 ~ 14) → 지도를 눌렀을 때 고를 행정구역 단계
 * 많이 확대(≤5) 동 · 적당히(6~7) 구 · 조금(8~9) 시 · 거의 안 함(≥10) 시·도(광역시·특별자치시·도)
 */
export function levelForZoom(mapLevel: number): BoundaryLevel {
  if (mapLevel <= 5) return 'emd';
  if (mapLevel <= 7) return 'sigungu';
  if (mapLevel <= 9) return 'si';
  return 'sido';
}
