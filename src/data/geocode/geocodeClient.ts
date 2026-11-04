// 지오코딩 클라이언트 — 프록시(/api/geocode)가 카카오 → V-World 순서로 처리한다
import { getJson } from '../apiClient';

export interface GeoResult {
  label: string;
  address: string;
  lat: number;
  lng: number;
  kind: 'address' | 'place';
  category?: string;
}

export interface GeocodeResponse {
  provider: 'kakao' | 'vworld';
  results: GeoResult[];
}

export async function geocode(query: string, signal?: AbortSignal): Promise<GeocodeResponse> {
  const body = await getJson<GeocodeResponse>(`/api/geocode?q=${encodeURIComponent(query)}`, signal);
  return { provider: body.provider, results: Array.isArray(body.results) ? body.results : [] };
}
