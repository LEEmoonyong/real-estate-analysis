// OSM Overpass 프록시 — 주 인스턴스 실패 시 미러로 대체 (키 불필요)
import { ApiError, USER_AGENT, fetchWithRetry, json, parseCenter } from '../http.js';

export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
] as const;

export function buildOverpassQuery(lat: number, lng: number, radius: number): string {
  const around = `around:${Math.round(radius)},${lat.toFixed(6)},${lng.toFixed(6)}`;
  return [
    '[out:json][timeout:25];',
    `(way["building"](${around});`,
    `relation["building"]["type"="multipolygon"](${around}););`,
    'out tags geom;',
  ].join('\n');
}

// 1일차 실측: 공개 인스턴스가 과부하로 502/504를 자주 반환하고 응답이 20초 이상 걸리기도 한다.
// 마지막으로 성공한 미러를 먼저 시도해 대기 시간을 줄인다(인스턴스 메모리, 콜드 스타트 시 초기화).
let preferredEndpoint: string | null = null;

export function endpointOrder(preferred: string | null): string[] {
  const all: string[] = [...OVERPASS_ENDPOINTS];
  return preferred && all.includes(preferred) ? [preferred, ...all.filter((e) => e !== preferred)] : all;
}

export async function handleOverpassBuildings(params: URLSearchParams): Promise<Response> {
  const { lat, lng, radius } = parseCenter(params);
  const body = new URLSearchParams({ data: buildOverpassQuery(lat, lng, radius) }).toString();

  let lastError: unknown = null;
  for (const endpoint of endpointOrder(preferredEndpoint)) {
    try {
      const res = await fetchWithRetry(
        endpoint,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
          body,
        },
        { timeoutMs: 30_000, retries: 0 },
      );
      if (!res.ok) throw new ApiError('UPSTREAM', `Overpass 응답 ${res.status} (${endpoint})`);
      const data = (await res.json()) as { elements?: unknown[] };
      preferredEndpoint = endpoint;
      return json({ ok: true, endpoint, elements: data.elements ?? [] }, 200, 3600);
    } catch (err) {
      lastError = err; // 다음 미러 시도 (정책상 병렬 요청 금지 → 순차)
    }
  }
  throw lastError ?? new ApiError('UPSTREAM', 'Overpass 요청 실패');
}
