// 지오코딩 클라이언트 — 프록시(/api/geocode)가 카카오 → V-World 순서로 처리한다
import { getJson } from '../apiClient';

export interface GeoResult {
  label: string;
  address: string;
  lat: number;
  lng: number;
  kind: 'address' | 'place';
  category?: string;
  /** 지역 이름 자체를 찾은 결과면 그 단계 (지도에 행정구역 테두리) */
  region?: 'sido' | 'sigungu' | 'emd' | 'ri';
}

export interface GeocodeResponse {
  provider: 'kakao' | 'vworld';
  results: GeoResult[];
}

export async function geocode(query: string, signal?: AbortSignal): Promise<GeocodeResponse> {
  const body = await getJson<GeocodeResponse>(`/api/geocode?q=${encodeURIComponent(query)}`, signal);
  return { provider: body.provider, results: Array.isArray(body.results) ? body.results : [] };
}
