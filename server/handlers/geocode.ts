// 지오코딩 프록시: 카카오(주소+키워드 병렬) → 실패·키 없음 시 V-World(지오코더+검색)
import { ApiError, fetchWithRetry, json, type ServerEnv } from '../http';

export interface GeoResult {
  label: string; // 표시 이름 (장소명 또는 주소)
  address: string; // 주소 문자열
  lat: number;
  lng: number;
  kind: 'address' | 'place';
  category?: string;
}

const MAX_RESULTS = 10;
const DEDUPE_METERS = 10;

// ---- 카카오 ----------------------------------------------------------------

interface KakaoAddressDoc {
  address_name: string;
  x: string;
  y: string;
  road_address?: { address_name: string; building_name?: string } | null;
}
interface KakaoKeywordDoc {
  place_name: string;
  address_name: string;
  road_address_name?: string;
  category_name?: string;
  x: string;
  y: string;
}

async function kakaoGet<T>(path: string, query: string, key: string, size: number): Promise<T[]> {
  const url = `https://dapi.kakao.com${path}?query=${encodeURIComponent(query)}&size=${size}`;
  const res = await fetchWithRetry(url, { headers: { Authorization: `KakaoAK ${key}` } });
  if (res.status === 401 || res.status === 403) {
    throw new ApiError('NO_KEY', `카카오 인증 실패(${res.status})`, 502);
  }
  if (!res.ok) throw new ApiError('UPSTREAM', `카카오 응답 ${res.status}`);
  const body = (await res.json()) as { documents?: T[] };
  return Array.isArray(body.documents) ? body.documents : [];
}

async function geocodeKakao(query: string, key: string): Promise<GeoResult[]> {
  const [addr, places] = await Promise.all([
    kakaoGet<KakaoAddressDoc>('/v2/local/search/address.json', query, key, 10),
    kakaoGet<KakaoKeywordDoc>('/v2/local/search/keyword.json', query, key, 15),
  ]);
  const fromAddr: GeoResult[] = addr.map((d) => ({
    label: d.road_address?.building_name || d.road_address?.address_name || d.address_name,
    address: d.road_address?.address_name || d.address_name,
    lat: Number(d.y),
    lng: Number(d.x),
    kind: 'address',
  }));
  // 아파트 카테고리를 앞에 둔다
  const sortedPlaces = [...places].sort(
    (a, b) => Number(isApartment(b.category_name)) - Number(isApartment(a.category_name)),
  );
  const fromPlaces: GeoResult[] = sortedPlaces.map((d) => ({
    label: d.place_name,
    address: d.road_address_name || d.address_name,
    lat: Number(d.y),
    lng: Number(d.x),
    kind: 'place',
    ...(d.category_name ? { category: d.category_name } : {}),
  }));
  return [...fromAddr, ...fromPlaces];
}

function isApartment(category?: string): boolean {
  return Boolean(category && category.includes('아파트'));
}

// ---- V-World ---------------------------------------------------------------

interface VworldGeocoderBody {
  response?: {
    status?: string;
    refined?: { text?: string };
    result?: { point?: { x?: string; y?: string } };
    error?: { code?: string; text?: string };
  };
}
interface VworldSearchItem {
  title?: string;
  point?: { x?: string; y?: string };
  address?: { road?: string; parcel?: string };
}

function vworldCommon(env: ServerEnv): string {
  const domain = env.VWORLD_DOMAIN ? `&domain=${encodeURIComponent(env.VWORLD_DOMAIN)}` : '';
  return `key=${encodeURIComponent(env.VWORLD_API_KEY ?? '')}${domain}&format=json`;
}

function throwVworldError(code: string | undefined, text: string | undefined): never {
  if (code === 'INVALID_KEY' || code === 'INCORRECT_KEY' || code === 'UNAVAILABLE_KEY') {
    throw new ApiError('NO_KEY', `V-World 인증 오류: ${code}`);
  }
  if (code === 'OVER_REQUEST_LIMIT') throw new ApiError('QUOTA', 'V-World 일일 한도 초과', 503);
  throw new ApiError('UPSTREAM', `V-World 오류: ${code ?? ''} ${text ?? ''}`.trim());
}

async function vworldGeocoder(query: string, type: 'ROAD' | 'PARCEL', env: ServerEnv): Promise<GeoResult | null> {
  const url =
    `https://api.vworld.kr/req/address?service=address&request=GetCoord&version=2.0&crs=EPSG:4326` +
    `&type=${type}&refine=true&simple=false&address=${encodeURIComponent(query)}&${vworldCommon(env)}`;
  const res = await fetchWithRetry(url);
  const body = (await res.json()) as VworldGeocoderBody;
  const r = body.response;
  if (r?.status === 'NOT_FOUND') return null;
  if (r?.status !== 'OK') throwVworldError(r?.error?.code, r?.error?.text);
  const x = Number(r.result?.point?.x);
  const y = Number(r.result?.point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const text = r.refined?.text ?? query;
  return { label: text, address: text, lat: y, lng: x, kind: 'address' };
}

async function vworldPlaceSearch(query: string, env: ServerEnv): Promise<GeoResult[]> {
  const url =
    `https://api.vworld.kr/req/search?service=search&request=search&version=2.0&type=PLACE&size=10&page=1` +
    `&crs=EPSG:4326&query=${encodeURIComponent(query)}&${vworldCommon(env)}`;
  const res = await fetchWithRetry(url);
  const raw = (await res.json()) as Record<string, unknown>;
  // 문서상 최상위 response 래퍼 유무가 불분명하여 두 형태 모두 처리 (docs/api-verification.md)
  const body = (raw.response ?? raw) as {
    status?: string;
    error?: { code?: string; text?: string };
    result?: { items?: VworldSearchItem[] | { item?: VworldSearchItem[] } };
  };
  if (body.status === 'NOT_FOUND') return [];
  if (body.status !== 'OK') throwVworldError(body.error?.code, body.error?.text);
  const itemsField = body.result?.items;
  const items = Array.isArray(itemsField) ? itemsField : (itemsField?.item ?? []);
  return items
    .map((it): GeoResult => ({
      label: it.title ?? query,
      address: it.address?.road || it.address?.parcel || '',
      lat: Number(it.point?.y),
      lng: Number(it.point?.x),
      kind: 'place',
    }))
    .filter((g) => Number.isFinite(g.lat) && Number.isFinite(g.lng));
}

async function geocodeVworld(query: string, env: ServerEnv): Promise<GeoResult[]> {
  const [road, places] = await Promise.all([
    vworldGeocoder(query, 'ROAD', env),
    vworldPlaceSearch(query, env).catch(() => [] as GeoResult[]),
  ]);
  const parcel = road ? null : await vworldGeocoder(query, 'PARCEL', env);
  return [road, parcel, ...places.filter((p) => isRelevantPlace(p, query))].filter(
    (g): g is GeoResult => g !== null,
  );
}

/**
 * V-World 장소 검색은 주소 검색어에도 느슨하게 매칭된다
 * (실측: "세종특별자치시 나리로 57" → "경부선", "고북군립공원").
 * 검색어의 숫자가 아닌 2글자 이상 토큰이 이름에 하나라도 들어간 장소만 남긴다.
 */
export function isRelevantPlace(place: GeoResult, query: string): boolean {
  const tokens = query.split(/\s+/).filter((t) => t.length >= 2 && !/^\d+(-\d+)?$/.test(t));
  return tokens.length === 0 || tokens.some((t) => place.label.includes(t));
}

// ---- 공통 ------------------------------------------------------------------

function dedupe(results: GeoResult[]): GeoResult[] {
  const out: GeoResult[] = [];
  for (const r of results) {
    if (!Number.isFinite(r.lat) || !Number.isFinite(r.lng)) continue;
    const dup = out.some((o) => approxDistanceM(o, r) < DEDUPE_METERS && o.label === r.label);
    if (!dup) out.push(r);
    if (out.length >= MAX_RESULTS) break;
  }
  return out;
}

function approxDistanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dy = (a.lat - b.lat) * 111_320;
  const dx = (a.lng - b.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dx, dy);
}

export async function handleGeocode(params: URLSearchParams, env: ServerEnv): Promise<Response> {
  const query = (params.get('q') ?? '').trim();
  if (query.length < 2 || query.length > 100) {
    throw new ApiError('BAD_REQUEST', '검색어는 2~100자여야 합니다.', 400);
  }
  if (!env.KAKAO_REST_API_KEY && !env.VWORLD_API_KEY) {
    throw new ApiError('NO_KEY', '지오코딩 API 키가 설정되지 않았습니다.', 503);
  }

  let kakaoError: unknown = null;
  if (env.KAKAO_REST_API_KEY) {
    try {
      const results = dedupe(await geocodeKakao(query, env.KAKAO_REST_API_KEY));
      if (results.length > 0) return json({ ok: true, provider: 'kakao', results }, 200, 3600);
    } catch (err) {
      kakaoError = err;
    }
  }
  if (env.VWORLD_API_KEY) {
    const results = dedupe(await geocodeVworld(query, env));
    return json({ ok: true, provider: 'vworld', results }, 200, 3600);
  }
  if (kakaoError) throw kakaoError;
  return json({ ok: true, provider: 'kakao', results: [] });
}
