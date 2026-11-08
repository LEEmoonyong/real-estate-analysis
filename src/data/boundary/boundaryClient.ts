// [요구사항: 데이터 처리] 외부 API(V-World 행정구역 경계, 서버 프록시 /api/boundary) — 지도에 지역 테두리
import { getJson } from '../apiClient';

export type BoundaryLevel = 'sido' | 'sigungu' | 'emd' | 'ri';

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
