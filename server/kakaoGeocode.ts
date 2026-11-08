// 카카오 주소 → 좌표 (서버 전용, 캐시·동시 요청 제한·429 재시도) — 지도 표시(deal-places)와 거래 단지 목록이 함께 쓴다.
// 2026-11 실측: 단지 수백 곳을 동시에 찾으면 카카오가 잠깐 429(요청 한도)를 돌려줘 좌표가 빠졌다
//   (예: 하남시 "위례신도시신안인스빌아스트로" 학암동 663 → 좌표 없음 → 단지 연결 실패).
import { ApiError, fetchWithRetry } from './http.js';

export type LatLng = { lat: number; lng: number };

/** 동시 요청 수 */
export const GEOCODE_CONCURRENCY = 4;

/** 주소 → 좌표 캐시 (서버 인스턴스가 살아 있는 동안). 지번 좌표는 바뀌지 않으므로 성공한 결과만 기억한다 */
const GEO_CACHE_LIMIT = 20_000;
const geoCache = new Map<string, LatLng>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function geocodeAddress(query: string, kakao: string): Promise<LatLng | null> {
  const hit = geoCache.get(query);
  if (hit) return hit;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetchWithRetry(
        `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}&size=1`,
        { headers: { Authorization: `KakaoAK ${kakao}` } },
        { timeoutMs: 8000, retries: 1 },
      );
      if (!res.ok) return null;
      const doc = ((await res.json()) as { documents?: { x: string; y: string }[] }).documents?.[0];
      if (!doc) return null;
      const at = { lat: Number(doc.y), lng: Number(doc.x) };
      if (geoCache.size >= GEO_CACHE_LIMIT) geoCache.delete(geoCache.keys().next().value!);
      geoCache.set(query, at);
      return at;
    } catch (e) {
      // 요청 한도(429)면 잠깐 쉬었다가 다시 — 그 밖의 오류는 좌표 없이 둔다(목록에는 남음)
      if (!(e instanceof ApiError && e.code === 'QUOTA')) return null;
      await sleep(400 * (attempt + 1));
    }
  }
  return null;
}
