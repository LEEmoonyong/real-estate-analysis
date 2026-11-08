// 부동산 공공데이터 프록시 (확장 X2)
//   GET /api/region?lat=&lng=                 좌표 → 법정동 코드 (카카오 coord2regioncode)
//   GET /api/realestate/trades?lawd=&ym=      아파트 매매 실거래 (시군구 5자리 × 계약년월)
//   GET /api/realestate/rents?lawd=&ym=       아파트 전월세 실거래
//   GET /api/realestate/complexes?sigungu=    공동주택 단지 목록 (시군구)
//   GET /api/realestate/complex?kaptCode=     공동주택 기본정보
// 키(DATA_GO_KR_SERVICE_KEY, KAKAO_REST_API_KEY)는 서버에서만 붙인다. 응답은 CDN 캐시(s-maxage)로 공공데이터 호출을 줄인다.
import { ApiError, fetchWithRetry, json, type ServerEnv } from '../http.js';
import { GEOCODE_CONCURRENCY, geocodeAddress } from '../kakaoGeocode.js';
import {
  dataGoKrError,
  normalizeComplex,
  normalizeComplexInfo,
  normalizeRent,
  normalizeTrade,
  parseXmlItems,
  type AptComplex,
  type AptRent,
  type AptTrade,
} from '../realestate/normalize.js';

const DATA_GO_KR = 'https://apis.data.go.kr/1613000';
const PAGE_SIZE = 1000;
/** 한 시군구·한 달 거래가 이보다 많으면 잘라 낸다 (강남구 성수기 매매도 수백~2천 건 수준) */
const MAX_PAGES = 5;

const DAY = 86_400;

export function requireKey(env: ServerEnv): string {
  const key = env.DATA_GO_KR_SERVICE_KEY;
  if (!key) throw new ApiError('NO_KEY', '공공데이터포털 키가 설정되지 않았습니다.', 503);
  return key;
}

/** 계약년월 'YYYYMM' 검증 — 2006년 1월(실거래 공개 시작) ~ 이번 달 */
export function parseYearMonth(ym: string | null, now = new Date()): string {
  if (!ym || !/^\d{6}$/.test(ym)) throw new ApiError('BAD_REQUEST', 'ym은 YYYYMM 형식이어야 합니다.', 400);
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(4));
  const current = now.getUTCFullYear() * 100 + now.getUTCMonth() + 1;
  if (m < 1 || m > 12 || y * 100 + m < 200601 || y * 100 + m > current) {
    throw new ApiError('BAD_REQUEST', 'ym이 조회 가능한 범위(2006-01 ~ 이번 달)를 벗어났습니다.', 400);
  }
  return ym;
}

export function parseLawdCode(v: string | null, name = 'lawd'): string {
  if (!v || !/^\d{5}$/.test(v)) throw new ApiError('BAD_REQUEST', `${name}는 시군구 코드 5자리여야 합니다.`, 400);
  return v;
}

/** 이번 달·지난달은 아직 신고가 들어오므로 짧게, 그 이전은 길게 캐시 */
export function tradeCacheSeconds(ym: string, now = new Date()): number {
  const current = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const target = Number(ym.slice(0, 4)) * 12 + Number(ym.slice(4)) - 1;
  return current - target <= 1 ? 6 * 3600 : 7 * DAY;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetchWithRetry(url, {}, { timeoutMs: 15_000, retries: 1 });
  const body = await res.text();
  const err = dataGoKrError(body);
  if (err) throw new ApiError(err.code, err.message, err.code === 'NO_KEY' ? 502 : 502);
  if (!res.ok) throw new ApiError('UPSTREAM', `공공데이터포털 응답 ${res.status}`);
  return body;
}

export async function fetchRtms<T>(
  service: string,
  lawd: string,
  ym: string,
  key: string,
  normalize: (it: Record<string, string>) => T | null,
): Promise<{ items: T[]; total: number; truncated: boolean }> {
  const items: T[] = [];
  let total = 0;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${DATA_GO_KR}/${service}/get${service}?serviceKey=${encodeURIComponent(key)}&LAWD_CD=${lawd}&DEAL_YMD=${ym}&numOfRows=${PAGE_SIZE}&pageNo=${page}`;
    const xml = await fetchText(url);
    total = Number(/<totalCount>(\d+)<\/totalCount>/.exec(xml)?.[1] ?? 0);
    for (const raw of parseXmlItems(xml)) {
      const v = normalize(raw);
      if (v) items.push(v);
    }
    if (page * PAGE_SIZE >= total) return { items, total, truncated: false };
  }
  return { items, total, truncated: true };
}

export async function handleTrades(params: URLSearchParams, env: ServerEnv): Promise<Response> {
  const lawd = parseLawdCode(params.get('lawd'));
  const ym = parseYearMonth(params.get('ym'));
  const r = await fetchRtms<AptTrade>('RTMSDataSvcAptTradeDev', lawd, ym, requireKey(env), normalizeTrade);
  return json({ ok: true, lawd, ym, ...r }, 200, tradeCacheSeconds(ym));
}

export async function handleRents(params: URLSearchParams, env: ServerEnv): Promise<Response> {
  const lawd = parseLawdCode(params.get('lawd'));
  const ym = parseYearMonth(params.get('ym'));
  const r = await fetchRtms<AptRent>('RTMSDataSvcAptRent', lawd, ym, requireKey(env), normalizeRent);
  return json({ ok: true, lawd, ym, ...r }, 200, tradeCacheSeconds(ym));
}

export async function handleComplexes(params: URLSearchParams, env: ServerEnv): Promise<Response> {
  const sigungu = parseLawdCode(params.get('sigungu'), 'sigungu');
  const key = requireKey(env);
  const items: AptComplex[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const body = await fetchText(
      `${DATA_GO_KR}/AptListService4/getSigunguAptList4?serviceKey=${encodeURIComponent(key)}&sigunguCode=${sigungu}&numOfRows=${PAGE_SIZE}&pageNo=${page}&_type=json`,
    );
    const parsed = JSON.parse(body) as { response?: { body?: { items?: unknown; totalCount?: number } } };
    const raw = parsed.response?.body?.items;
    const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : [];
    for (const it of list) {
      const c = normalizeComplex(it as Record<string, unknown>);
      if (c) items.push(c);
    }
    if (page * PAGE_SIZE >= (parsed.response?.body?.totalCount ?? 0)) break;
  }
  return json({ ok: true, sigungu, items }, 200, 7 * DAY);
}

export async function handleComplexInfo(params: URLSearchParams, env: ServerEnv): Promise<Response> {
  const code = params.get('kaptCode');
  if (!code || !/^A\d{8}$/.test(code))
    throw new ApiError('BAD_REQUEST', 'kaptCode 형식이 올바르지 않습니다(예: A10023070).', 400);
  const body = await fetchText(
    `${DATA_GO_KR}/AptBasisInfoServiceV5/getAphusBassInfoV5?serviceKey=${encodeURIComponent(requireKey(env))}&kaptCode=${code}&_type=json`,
  );
  const parsed = JSON.parse(body) as { response?: { body?: { item?: Record<string, unknown> } } };
  const info = parsed.response?.body?.item ? normalizeComplexInfo(parsed.response.body.item) : null;
  if (!info) throw new ApiError('NOT_FOUND', `단지 정보를 찾을 수 없습니다(${code}).`, 404);
  return json({ ok: true, info }, 200, 7 * DAY);
}

/** 동시에 보내는 업스트림 요청 수 제한 */
export async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export interface TradeComplex {
  aptSeq: string;
  aptName: string;
  umdName: string;
  jibun: string;
  buildYear: number | null;
  /** 기간 안 매매 건수 (해제 거래 제외) */
  count: number;
  /** 전용면적 ㎡당 매매가 중앙값 [만원/㎡] */
  medianPricePerM2: number;
  lastDate: string;
  lastPrice: number;
  lastArea: number;
  lat: number | null;
  lng: number | null;
}

/** 매매 거래를 실거래 단지(aptSeq)별로 묶어 요약 (해제 거래 제외) */
export function groupTradesByComplex(trades: readonly AptTrade[]): Omit<TradeComplex, 'lat' | 'lng'>[] {
  const groups = new Map<string, AptTrade[]>();
  for (const t of trades) {
    if (t.cancelled) continue;
    const list = groups.get(t.aptSeq);
    if (list) list.push(t);
    else groups.set(t.aptSeq, [t]);
  }
  return [...groups.values()].map((list) => {
    const sorted = [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const last = sorted[0]!;
    const perM2 = list.map((t) => t.price / t.area).sort((a, b) => a - b);
    const mid = perM2.length >> 1;
    const median = perM2.length % 2 ? perM2[mid]! : (perM2[mid - 1]! + perM2[mid]!) / 2;
    return {
      aptSeq: last.aptSeq,
      aptName: last.aptName,
      umdName: last.umdName,
      jibun: last.jibun,
      buildYear: last.buildYear,
      count: list.length,
      medianPricePerM2: Math.round(median * 10) / 10,
      lastDate: last.date,
      lastPrice: last.price,
      lastArea: last.area,
    };
  });
}

/** 지오코딩용 지번 주소: '서울특별시 송파구' + '잠실동' + '19' */
export function jibunAddress(area: string, umdName: string, jibun: string): string {
  return [area, umdName, jibun].filter(Boolean).join(' ');
}

/** 계약년월에서 n달 전 'YYYYMM' */
export function shiftYearMonth(ym: string, back: number): string {
  const t = Number(ym.slice(0, 4)) * 12 + Number(ym.slice(4)) - 1 - back;
  return `${Math.floor(t / 12)}${String((t % 12) + 1).padStart(2, '0')}`;
}

/**
 * 지도 표시용 "거래된 단지" 목록 — 최근 N달(기본 3) 매매를 단지별로 묶고 지번 주소로 좌표를 붙인다.
 *   GET /api/realestate/trade-complexes?lawd=11710&ym=202609&months=3&area=서울특별시 송파구
 * 공공데이터 호출은 달 수만큼이다. 단지별 기본정보는 부르지 않는다(개발 계정의 하루 호출 한도가 작아
 * 2026-11 실측에서 단지 178곳을 한꺼번에 부르자 429로 막힘). 좌표는 카카오 주소 검색(한도 넉넉)으로 단지마다 한 번.
 */
export async function handleTradeComplexes(params: URLSearchParams, env: ServerEnv): Promise<Response> {
  const lawd = parseLawdCode(params.get('lawd'));
  const ym = parseYearMonth(params.get('ym'));
  const months = Math.min(6, Math.max(1, Number(params.get('months') ?? 3) || 3));
  const area = (params.get('area') ?? '').trim();
  if (!/^[가-힣 ]{2,40}$/.test(area)) {
    throw new ApiError('BAD_REQUEST', 'area는 "서울특별시 송파구" 같은 시·군·구 이름이어야 합니다.', 400);
  }
  const key = requireKey(env);
  const yms = Array.from({ length: months }, (_, i) => shiftYearMonth(ym, i)).filter((m) => m >= '200601');
  const monthly = await mapLimit(yms, 3, (m) =>
    fetchRtms<AptTrade>('RTMSDataSvcAptTradeDev', lawd, m, key, normalizeTrade),
  );
  const groups = groupTradesByComplex(monthly.flatMap((r) => r.items));

  const kakao = env.KAKAO_REST_API_KEY;
  const items: TradeComplex[] = await mapLimit(groups, GEOCODE_CONCURRENCY, async (g) => {
    const at = kakao && g.jibun ? await geocodeAddress(jibunAddress(area, g.umdName, g.jibun), kakao) : null;
    return { ...g, lat: at?.lat ?? null, lng: at?.lng ?? null };
  });
  return json({ ok: true, lawd, ym, months: yms, items }, 200, tradeCacheSeconds(ym));
}

/** 좌표 → 법정동(B) 코드. 시군구 코드 = 앞 5자리 */
export async function handleRegion(params: URLSearchParams, env: ServerEnv): Promise<Response> {
  const lat = Number(params.get('lat'));
  const lng = Number(params.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 32 || lat > 40 || lng < 123 || lng > 133) {
    throw new ApiError('BAD_REQUEST', 'lat·lng가 국내 범위를 벗어났습니다.', 400);
  }
  const key = env.KAKAO_REST_API_KEY;
  if (!key) throw new ApiError('NO_KEY', '카카오 REST API 키가 설정되지 않았습니다.', 503);
  const res = await fetchWithRetry(`https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${lng}&y=${lat}`, {
    headers: { Authorization: `KakaoAK ${key}` },
  });
  if (!res.ok) throw new ApiError('UPSTREAM', `카카오 응답 ${res.status}`);
  const body = (await res.json()) as {
    documents?: {
      region_type: string;
      code: string;
      region_1depth_name: string;
      region_2depth_name: string;
      region_3depth_name: string;
    }[];
  };
  const b = body.documents?.find((d) => d.region_type === 'B');
  if (!b) throw new ApiError('NOT_FOUND', '이 위치의 법정동을 찾지 못했습니다.', 404);
  return json(
    {
      ok: true,
      bjdCode: b.code,
      lawdCode: b.code.slice(0, 5),
      sido: b.region_1depth_name,
      sigungu: b.region_2depth_name,
      dong: b.region_3depth_name,
    },
    200,
    30 * DAY,
  );
}
