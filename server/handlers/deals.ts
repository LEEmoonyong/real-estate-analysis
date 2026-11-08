// 주택 유형별 지도 표시 (확장 X8)
//   GET /api/realestate/deal-places?type=offi&kind=wolse&room=one&lawd=11710&ym=202610&months=3&area=서울특별시 송파구
//   type: apt(아파트) · offi(오피스텔) · rh(연립·다세대 = 빌라) · sh(단독·다가구) · nrg(상업업무용 = 상가)
//   kind: trade(매매) · jeonse(전세) · wolse(월세) — 상가는 매매만
//   room: all · one(원룸, 전용 33㎡ 이하 추정) · two(투룸, 33~60㎡ 추정)
// 최근 N달(기본 3) 거래를 건물별(지번이 가려진 단독·상가는 법정동별)로 묶어 중앙값과 최근 거래를 붙이고,
// 카카오 주소 검색으로 좌표를 단다. 키는 서버에서만 붙이고, 응답은 CDN 캐시로 공공데이터 호출을 줄인다.
import { ApiError, fetchWithRetry, json, type ServerEnv } from '../http.js';
import {
  DEAL_KINDS,
  PROPERTY_TYPES,
  ROOM_FILTERS,
  RTMS_SERVICES,
  filterDeals,
  groupDeals,
  normalizeDeal,
  type DealKind,
  type DealPlace,
  type PropertyType,
  type RoomFilter,
} from '../realestate/property.js';
import {
  fetchRtms,
  jibunAddress,
  mapLimit,
  parseLawdCode,
  parseYearMonth,
  requireKey,
  shiftYearMonth,
  tradeCacheSeconds,
} from './realestate.js';

/** 한 번에 그리는 표시 수 상한 (거래가 많은 곳부터) — 빌라 월세는 시군구 하나에 수백 건물이 나올 수 있다 */
const MAX_PLACES = 300;

function oneOf<T extends string>(v: string | null, list: readonly T[], fallback: T, name: string): T {
  if (v === null || v === '') return fallback;
  if ((list as readonly string[]).includes(v)) return v as T;
  throw new ApiError('BAD_REQUEST', `${name}는 ${list.join('·')} 중 하나여야 합니다.`, 400);
}

type LatLng = { lat: number; lng: number };

/**
 * 주소 → 좌표 캐시 (서버 인스턴스가 살아 있는 동안). 지번 좌표는 바뀌지 않으므로 성공한 결과만 기억한다.
 * 유형·거래 종류를 바꿔 다시 불러도 같은 건물은 카카오를 다시 부르지 않는다.
 */
const GEO_CACHE_LIMIT = 20_000;
const geoCache = new Map<string, LatLng>();

/** 동시 요청 수 — 빌라 전월세처럼 건물이 수백 곳이면 카카오가 잠깐 429(요청 한도)를 돌려준다(2026-11 실측) */
const GEOCODE_CONCURRENCY = 4;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function geocode(query: string, kakao: string): Promise<LatLng | null> {
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

export async function handleDealPlaces(params: URLSearchParams, env: ServerEnv): Promise<Response> {
  const type = oneOf<PropertyType>(params.get('type'), PROPERTY_TYPES, 'apt', 'type');
  const kind = oneOf<DealKind>(params.get('kind'), DEAL_KINDS, 'trade', 'kind');
  const room = oneOf<RoomFilter>(params.get('room'), ROOM_FILTERS, 'all', 'room');
  const lawd = parseLawdCode(params.get('lawd'));
  const ym = parseYearMonth(params.get('ym'));
  const months = Math.min(6, Math.max(1, Number(params.get('months') ?? 3) || 3));
  const area = (params.get('area') ?? '').trim();
  if (!/^[가-힣 ]{2,40}$/.test(area)) {
    throw new ApiError('BAD_REQUEST', 'area는 "서울특별시 송파구" 같은 시·군·구 이름이어야 합니다.', 400);
  }
  const rent = kind !== 'trade';
  const service = rent ? RTMS_SERVICES[type].rent : RTMS_SERVICES[type].trade;
  if (!service) throw new ApiError('BAD_REQUEST', '상업업무용(상가)은 국토교통부 공개 자료에 매매만 있습니다.', 400);

  const key = requireKey(env);
  const yms = Array.from({ length: months }, (_, i) => shiftYearMonth(ym, i)).filter((m) => m >= '200601');
  const monthly = await mapLimit(yms, 3, (m) =>
    fetchRtms(service, lawd, m, key, (it) => normalizeDeal(type, rent, it)),
  );
  const deals = filterDeals(
    monthly.flatMap((r) => r.items),
    kind,
    room,
  );
  const all = groupDeals(deals, kind);
  const groups = all.slice(0, MAX_PLACES);

  // 좌표: 건물은 지번 주소, 동 단위는 법정동 이름으로 (같은 주소는 한 번만)
  const kakao = env.KAKAO_REST_API_KEY;
  const cache = new Map<string, Promise<LatLng | null>>();
  const items: DealPlace[] = await mapLimit(groups, GEOCODE_CONCURRENCY, async (g) => {
    const query = g.level === 'building' ? jibunAddress(area, g.umdName, g.jibun) : `${area} ${g.umdName}`;
    let p = cache.get(query);
    if (!p) {
      p = kakao ? geocode(query, kakao) : Promise.resolve(null);
      cache.set(query, p);
    }
    const at = await p;
    return { ...g, lat: at?.lat ?? null, lng: at?.lng ?? null };
  });

  return json(
    {
      ok: true,
      type,
      kind,
      room,
      lawd,
      ym,
      months: yms,
      total: deals.length,
      truncated: monthly.some((r) => r.truncated) || groups.length < all.length,
      items,
    },
    200,
    tradeCacheSeconds(ym),
  );
}
