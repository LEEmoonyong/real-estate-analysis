import { describe, expect, it } from 'vitest';
import { isRelevantPlace } from './handlers/geocode';
import { bboxAround } from './handlers/vworldBuildings';
import { OVERPASS_ENDPOINTS, buildOverpassQuery, endpointOrder } from './handlers/overpassBuildings';
import { parseCenter } from './http';
import { routeApi } from './router';

const NO_KEYS = {};
const get = (path: string, env = NO_KEYS) => routeApi(new Request(`http://localhost${path}`), env);

describe('routeApi', () => {
  it('health는 키 존재 여부만 알려 주고 키 값은 노출하지 않는다', async () => {
    const res = await get('/api/health', { KAKAO_REST_API_KEY: 'secret-kakao' });
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, kakao: true, vworld: false });
    expect(JSON.stringify(body)).not.toContain('secret-kakao');
  });

  it('키가 없으면 geocode는 NO_KEY(503)', async () => {
    const res = await get('/api/geocode?q=잠실엘스');
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false, code: 'NO_KEY' });
  });

  it('검색어가 너무 짧으면 400', async () => {
    const res = await get('/api/geocode?q=a', { KAKAO_REST_API_KEY: 'k' });
    expect(res.status).toBe(400);
  });

  it('키가 없으면 V-World 건물은 NO_KEY', async () => {
    const res = await get('/api/buildings/vworld?lat=37.5&lng=127&r=400');
    expect(await res.json()).toMatchObject({ code: 'NO_KEY' });
  });

  it('알 수 없는 경로는 404, GET 이외는 405', async () => {
    expect((await get('/api/nope')).status).toBe(404);
    const post = await routeApi(new Request('http://localhost/api/health', { method: 'POST' }), NO_KEYS);
    expect(post.status).toBe(405);
  });
});

describe('입력 검증', () => {
  it('한국 영역 밖 좌표와 과도한 반경을 거부한다', () => {
    expect(() => parseCenter(new URLSearchParams('lat=10&lng=127&r=400'))).toThrow();
    expect(() => parseCenter(new URLSearchParams('lat=37.5&lng=127&r=5000'))).toThrow();
    expect(parseCenter(new URLSearchParams('lat=37.5&lng=127&r=400'))).toEqual({ lat: 37.5, lng: 127, radius: 400 });
  });
});

describe('isRelevantPlace (V-World 장소 검색 필터)', () => {
  const place = (label: string) => ({ label, address: '', lat: 36.5, lng: 127.3, kind: 'place' as const });

  it('주소 검색어와 무관한 장소를 제외한다 (실측 사례)', () => {
    expect(isRelevantPlace(place('경부선'), '세종특별자치시 나리로 57')).toBe(false);
    expect(isRelevantPlace(place('고북군립공원'), '세종특별자치시 나리로 57')).toBe(false);
  });

  it('단지명이 들어간 장소는 남긴다', () => {
    expect(isRelevantPlace(place('잠실엘스입구'), '잠실엘스')).toBe(true);
    expect(isRelevantPlace(place('첫마을7단지래미안아파트'), '세종 첫마을')).toBe(true);
  });
});

describe('bboxAround', () => {
  it('반경 400m의 위도 폭은 약 0.0072°이다', () => {
    const [minx, miny, maxx, maxy] = bboxAround(37.5, 127, 400);
    expect(maxy - miny).toBeCloseTo((2 * 400) / 111_320, 5);
    // 위도 37.5°에서는 경도 1°가 더 짧으므로 경도 폭이 더 넓다
    expect(maxx - minx).toBeGreaterThan(maxy - miny);
  });
});

describe('buildOverpassQuery', () => {
  it('way와 multipolygon relation을 around 필터로 조회한다', () => {
    const q = buildOverpassQuery(37.5115, 127.083, 400);
    expect(q).toContain('way["building"](around:400,37.511500,127.083000)');
    expect(q).toContain('relation["building"]["type"="multipolygon"]');
    expect(q).toContain('out tags geom;');
  });

  it('마지막으로 성공한 미러를 맨 앞에 둔다', () => {
    expect(endpointOrder(null)).toEqual([...OVERPASS_ENDPOINTS]);
    const mirror = OVERPASS_ENDPOINTS[2];
    const order = endpointOrder(mirror);
    expect(order[0]).toBe(mirror);
    expect(new Set(order).size).toBe(OVERPASS_ENDPOINTS.length);
  });
});
