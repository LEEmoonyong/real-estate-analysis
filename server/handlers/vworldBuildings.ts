// V-World 2D 데이터 API 2.0 — 건축물정보(LT_C_BLDGINFO) 프록시
// 원시 GeoJSON 피처를 그대로 넘기고, 정규화는 클라이언트(src/data/normalize)에서 한다.
import { ApiError, fetchWithRetry, json, parseCenter, type ServerEnv } from '../http.js';

const PAGE_SIZE = 1000; // 문서상 최대값
const MAX_PAGES = 5;

interface VworldDataBody {
  response?: {
    status?: string;
    error?: { code?: string; text?: string };
    page?: { total?: string | number; current?: string | number };
    result?: { featureCollection?: { features?: unknown[] } };
  };
}

/** 중심·반경(m) → BOX(minx,miny,maxx,maxy) (경위도) */
export function bboxAround(lat: number, lng: number, radiusM: number): [number, number, number, number] {
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  const r = (v: number) => Number(v.toFixed(6));
  return [r(lng - dLng), r(lat - dLat), r(lng + dLng), r(lat + dLat)];
}

export async function handleVworldBuildings(params: URLSearchParams, env: ServerEnv): Promise<Response> {
  if (!env.VWORLD_API_KEY) throw new ApiError('NO_KEY', 'V-World API 키가 설정되지 않았습니다.', 503);
  const { lat, lng, radius } = parseCenter(params);
  const box = bboxAround(lat, lng, radius).join(',');
  const domain = env.VWORLD_DOMAIN ? `&domain=${encodeURIComponent(env.VWORLD_DOMAIN)}` : '';

  const features: unknown[] = [];
  let truncated = false;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url =
      `https://api.vworld.kr/req/data?service=data&version=2.0&request=GetFeature&data=LT_C_BLDGINFO` +
      `&geomFilter=BOX(${box})&geometry=true&attribute=true&crs=EPSG:4326&format=json` +
      `&size=${PAGE_SIZE}&page=${page}&key=${encodeURIComponent(env.VWORLD_API_KEY)}${domain}`;
    const res = await fetchWithRetry(url, {}, { timeoutMs: 10_000 });
    const body = (await res.json()) as VworldDataBody;
    const r = body.response;
    if (r?.status === 'NOT_FOUND') break;
    if (r?.status !== 'OK') {
      const code = r?.error?.code;
      if (code === 'OVER_REQUEST_LIMIT') throw new ApiError('QUOTA', 'V-World 일일 한도 초과', 503);
      const isKey = code === 'INVALID_KEY' || code === 'INCORRECT_KEY' || code === 'UNAVAILABLE_KEY';
      throw new ApiError(isKey ? 'NO_KEY' : 'UPSTREAM', `V-World 오류: ${code ?? '응답 형식 불명'} ${r?.error?.text ?? ''}`.trim());
    }
    features.push(...(r.result?.featureCollection?.features ?? []));
    const totalPages = Number(r.page?.total ?? 1);
    if (page >= totalPages) break;
    if (page === MAX_PAGES) truncated = true;
  }
  return json({ ok: true, features, truncated }, 200, 3600);
}
