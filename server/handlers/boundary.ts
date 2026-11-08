// 행정구역 경계 프록시 — V-World 2D 데이터 API 2.0 (시·도 / 시·군·구 / 읍·면·동 / 리)
//   GET /api/boundary?level=emd&lat=37.45&lng=127.24            그 점이 들어 있는 구역
//   GET /api/boundary?level=emd&sig=11710&name=잠실동&lat=..&lng=.. 이름으로 찾고, 없으면 점으로
// 지도에 테두리만 그리므로 좌표를 줄여(가까운 점 생략, 소수 5자리) 보낸다. 경계는 거의 바뀌지 않아 오래 캐시한다.
// 2026-11 실측: 점 조회 30~140ms, 송파구 원본 좌표 약 65KB.
import { ApiError, fetchWithRetry, json, requireNumber, type ServerEnv } from '../http.js';

export const BOUNDARY_LEVELS = ['sido', 'sigungu', 'emd', 'ri'] as const;
export type BoundaryLevel = (typeof BOUNDARY_LEVELS)[number];

const LAYERS: Record<BoundaryLevel, { data: string; name: string; code: string }> = {
  sido: { data: 'LT_C_ADSIDO_INFO', name: 'ctp_kor_nm', code: 'ctprvn_cd' },
  sigungu: { data: 'LT_C_ADSIGG_INFO', name: 'sig_kor_nm', code: 'sig_cd' },
  emd: { data: 'LT_C_ADEMD_INFO', name: 'emd_kor_nm', code: 'emd_cd' },
  ri: { data: 'LT_C_ADRI_INFO', name: 'li_kor_nm', code: 'li_cd' },
};

/** 좌표를 줄이는 간격 [도] — 넓은 구역일수록 성기게 (화면에서 보이는 정도만) */
const TOLERANCE: Record<BoundaryLevel, number> = { sido: 0.002, sigungu: 0.0004, emd: 0.0001, ri: 0.0001 };

type Ring = [number, number][];

/**
 * 바로 앞에 남긴 점과 tol보다 가까운 점은 버리고, 소수 5자리(약 1m)로 반올림한다.
 * 고리의 첫 점과 마지막 점은 항상 남긴다. 점이 4개 미만으로 줄면 원본을 쓴다.
 */
export function simplifyRing(ring: readonly [number, number][], tol: number): Ring {
  const round = (v: number) => Math.round(v * 1e5) / 1e5;
  if (ring.length < 4) return ring.map(([x, y]) => [round(x), round(y)]);
  const out: Ring = [];
  let last: [number, number] | null = null;
  ring.forEach((p, i) => {
    const keep = i === 0 || i === ring.length - 1 || !last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= tol;
    if (keep) {
      out.push([round(p[0]), round(p[1])]);
      last = p;
    }
  });
  return out.length >= 4 ? out : ring.map(([x, y]) => [round(x), round(y)]);
}

/** GeoJSON Polygon/MultiPolygon → 바깥 고리 목록 (구멍은 테두리에 필요 없어 버림) */
export function outerRings(geometry: { type?: string; coordinates?: unknown }): Ring[] {
  if (geometry.type === 'Polygon') return [((geometry.coordinates as Ring[]) ?? [])[0] ?? []].filter((r) => r.length);
  if (geometry.type === 'MultiPolygon')
    return ((geometry.coordinates as Ring[][]) ?? []).map((poly) => poly[0] ?? []).filter((r) => r.length);
  return [];
}

interface VworldFeature {
  properties?: Record<string, string>;
  geometry?: { type?: string; coordinates?: unknown };
}
interface VworldBody {
  response?: {
    status?: string;
    error?: { text?: string };
    result?: { featureCollection?: { features?: VworldFeature[] } };
  };
}

async function query(env: ServerEnv, data: string, filter: string): Promise<VworldFeature | null> {
  const domain = env.VWORLD_DOMAIN ? `&domain=${encodeURIComponent(env.VWORLD_DOMAIN)}` : '';
  const url =
    `https://api.vworld.kr/req/data?service=data&version=2.0&request=GetFeature&data=${data}` +
    `&${filter}&geometry=true&attribute=true&crs=EPSG:4326&format=json&size=1` +
    `&key=${encodeURIComponent(env.VWORLD_API_KEY ?? '')}${domain}`;
  const res = await fetchWithRetry(url, {}, { timeoutMs: 10_000 });
  const body = (await res.json()) as VworldBody;
  const r = body.response;
  if (r?.status === 'NOT_FOUND') return null;
  if (r?.status !== 'OK') {
    const text = r?.error?.text ?? r?.status ?? '알 수 없는 오류';
    throw new ApiError(/인증|KEY/i.test(text) ? 'NO_KEY' : 'UPSTREAM', `V-World 오류: ${text}`);
  }
  return r.result?.featureCollection?.features?.[0] ?? null;
}

export async function handleBoundary(params: URLSearchParams, env: ServerEnv): Promise<Response> {
  if (!env.VWORLD_API_KEY) throw new ApiError('NO_KEY', 'V-World API 키가 설정되지 않았습니다.', 503);
  const level = params.get('level') as BoundaryLevel | null;
  if (!level || !BOUNDARY_LEVELS.includes(level)) {
    throw new ApiError('BAD_REQUEST', `level은 ${BOUNDARY_LEVELS.join('·')} 중 하나여야 합니다.`, 400);
  }
  const layer = LAYERS[level];
  const name = (params.get('name') ?? '').trim();
  const sig = (params.get('sig') ?? '').trim();
  const hasPoint = params.has('lat') && params.has('lng');

  let feature: VworldFeature | null = null;
  // 이름으로 (같은 이름의 동이 여러 시·군·구에 있으므로 시·군·구 코드로 좁힌다)
  if (name && /^[가-힣0-9·]{1,20}$/.test(name) && /^\d{5}$/.test(sig)) {
    feature = await query(
      env,
      layer.data,
      `attrFilter=${encodeURIComponent(`${layer.name}:=:${name}|${layer.code}:like:${sig}`)}`,
    );
  }
  // 점으로 (이름 조회가 없거나 실패 — 예: 개편으로 코드가 바뀐 구역)
  if (!feature && hasPoint) {
    const lat = requireNumber(params, 'lat', 33, 39);
    const lng = requireNumber(params, 'lng', 124, 132);
    feature = await query(env, layer.data, `geomFilter=POINT(${lng.toFixed(6)}%20${lat.toFixed(6)})`);
  }
  if (!feature && !hasPoint && !name) throw new ApiError('BAD_REQUEST', 'lat·lng 또는 name·sig가 필요합니다.', 400);
  if (!feature) throw new ApiError('NOT_FOUND', '이 위치의 행정구역 경계를 찾지 못했습니다.', 404);

  const rings = outerRings(feature.geometry ?? {}).map((r) => simplifyRing(r, TOLERANCE[level]));
  const props = feature.properties ?? {};
  return json(
    {
      ok: true,
      level,
      name: props.full_nm ?? props[layer.name] ?? '',
      code: props[layer.code] ?? '',
      rings,
    },
    200,
    7 * 86_400,
  );
}
