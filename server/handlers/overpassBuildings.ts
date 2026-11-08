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
    '[out:json][timeout:15];',
    `(way["building"](${around});`,
    `relation["building"]["type"="multipolygon"](${around}););`,
    'out tags geom;',
  ].join('\n');
}

// 1일차 실측: 공개 인스턴스가 과부하로 502/504를 자주 반환하고 응답이 20초 이상 걸리기도 한다.
// 마지막으로 성공한 미러를 먼저 시도해 대기 시간을 줄인다(인스턴스 메모리, 콜드 스타트 시 초기화).
let preferredEndpoint: string | null = null;

/** 미러 하나당 대기 상한, 전체 대기 상한 [ms] */
export const OVERPASS_ENDPOINT_TIMEOUT_MS = 15_000;
export const OVERPASS_BUDGET_MS = 25_000;

export function endpointOrder(preferred: string | null): string[] {
  const all: string[] = [...OVERPASS_ENDPOINTS];
  return preferred && all.includes(preferred) ? [preferred, ...all.filter((e) => e !== preferred)] : all;
}

export async function handleOverpassBuildings(params: URLSearchParams): Promise<Response> {
  const { lat, lng, radius } = parseCenter(params);
  const body = new URLSearchParams({ data: buildOverpassQuery(lat, lng, radius) }).toString();

  // 2026-11 실측: 미러마다 30초씩 기다리면 실패까지 90초가 넘었다(배포 서버에서 70초 넘게 응답 없음).
  // 미러 하나는 최대 15초, 전체는 25초 안에서만 시도하고 넘기면 실패로 돌려준다(화면은 실패 안내 + 다시 시도).
  const deadline = Date.now() + OVERPASS_BUDGET_MS;
  let lastError: unknown = null;
  for (const endpoint of endpointOrder(preferredEndpoint)) {
    const left = deadline - Date.now();
    if (left < 3_000) break;
    try {
      const res = await fetchWithRetry(
        endpoint,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
          body,
        },
        { timeoutMs: Math.min(OVERPASS_ENDPOINT_TIMEOUT_MS, left), retries: 0 },
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
