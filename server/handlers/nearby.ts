// 주변 시설 (확장 X5 학군·교통) — 카카오 로컬 카테고리 검색
//   GET /api/nearby?lat=&lng=
// 학교(SC4)·지하철역(SW8)·대형마트(MT1)·병원(HP8)·유치원(PS3)을 거리순으로. 새 키 없이 카카오 REST 키로 동작한다.
import { ApiError, fetchWithRetry, json, type ServerEnv } from '../http.js';

export const NEARBY_CATEGORIES = [
  { code: 'SC4', key: 'school', radius: 1500 },
  { code: 'SW8', key: 'subway', radius: 2000 },
  { code: 'MT1', key: 'mart', radius: 2000 },
  { code: 'HP8', key: 'hospital', radius: 1000 },
  { code: 'PS3', key: 'kindergarten', radius: 1000 },
] as const;

export interface NearbyPlace {
  name: string;
  /** 카카오 분류 (예: '교육,학습 > 학교 > 초등학교', '교통,수송 > 지하철,전철 > 수도권9호선') */
  category: string;
  distanceM: number;
  lat: number;
  lng: number;
  address: string;
}

interface KakaoPlace {
  place_name: string;
  category_name: string;
  distance: string;
  x: string;
  y: string;
  road_address_name?: string;
  address_name?: string;
}

export function normalizePlaces(docs: readonly KakaoPlace[]): NearbyPlace[] {
  return docs
    .map((d) => ({
      name: d.place_name,
      category: d.category_name,
      distanceM: Number(d.distance),
      lat: Number(d.y),
      lng: Number(d.x),
      address: d.road_address_name || d.address_name || '',
    }))
    .filter((p) => Number.isFinite(p.distanceM) && Number.isFinite(p.lat))
    .sort((a, b) => a.distanceM - b.distanceM);
}

export async function handleNearby(params: URLSearchParams, env: ServerEnv): Promise<Response> {
  const lat = Number(params.get('lat'));
  const lng = Number(params.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 32 || lat > 40 || lng < 123 || lng > 133) {
    throw new ApiError('BAD_REQUEST', 'lat·lng가 국내 범위를 벗어났습니다.', 400);
  }
  const key = env.KAKAO_REST_API_KEY;
  if (!key) throw new ApiError('NO_KEY', '카카오 REST API 키가 설정되지 않았습니다.', 503);
  const entries = await Promise.all(
    NEARBY_CATEGORIES.map(async (c) => {
      const url = `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=${c.code}&x=${lng}&y=${lat}&radius=${c.radius}&sort=distance&size=15`;
      const res = await fetchWithRetry(url, { headers: { Authorization: `KakaoAK ${key}` } });
      if (!res.ok) throw new ApiError('UPSTREAM', `카카오 응답 ${res.status}`);
      const body = (await res.json()) as { documents?: KakaoPlace[] };
      return [c.key, normalizePlaces(body.documents ?? [])] as const;
    }),
  );
  return json({ ok: true, ...Object.fromEntries(entries) }, 200, 7 * 86_400);
}
