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

async function geocode(query: string, kakao: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetchWithRetry(
      `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}&size=1`,
      { headers: { Authorization: `KakaoAK ${kakao}` } },
      { timeoutMs: 8000, retries: 1 },
    );
    if (!res.ok) return null;
    const doc = ((await res.json()) as { documents?: { x: string; y: string }[] }).documents?.[0];
    return doc ? { lat: Number(doc.y), lng: Number(doc.x) } : null;
  } catch {
    return null;
  }
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
  const cache = new Map<string, Promise<{ lat: number; lng: number } | null>>();
  const items: DealPlace[] = await mapLimit(groups, 8, async (g) => {
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
