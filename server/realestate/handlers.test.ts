import { describe, expect, it } from 'vitest';
import {
  groupTradesByComplex,
  jibunAddress,
  parseYearMonth,
  shiftYearMonth,
  tradeCacheSeconds,
} from '../handlers/realestate';
import { routeApi } from '../router';

const get = (path: string, env = {}) => routeApi(new Request(`http://localhost${path}`), env);

describe('부동산 프록시 입력 검증', () => {
  it('계약년월: 형식·범위(2006-01 ~ 이번 달)', () => {
    const now = new Date(Date.UTC(2026, 10, 6));
    expect(parseYearMonth('202609', now)).toBe('202609');
    expect(() => parseYearMonth('2026-09', now)).toThrow();
    expect(() => parseYearMonth('200512', now)).toThrow();
    expect(() => parseYearMonth('202612', now)).toThrow(); // 미래
    expect(() => parseYearMonth('202613', now)).toThrow();
  });

  it('최근 두 달은 6시간, 그 이전은 7일 캐시', () => {
    const now = new Date(Date.UTC(2026, 10, 6));
    expect(tradeCacheSeconds('202611', now)).toBe(6 * 3600);
    expect(tradeCacheSeconds('202610', now)).toBe(6 * 3600);
    expect(tradeCacheSeconds('202609', now)).toBe(7 * 86400);
  });

  it('잘못된 요청은 400, 키가 없으면 503', async () => {
    expect((await get('/api/realestate/trades?lawd=117&ym=202609')).status).toBe(400);
    expect((await get('/api/realestate/complex?kaptCode=XYZ')).status).toBe(400);
    expect((await get('/api/region?lat=10&lng=10', { KAKAO_REST_API_KEY: 'k' })).status).toBe(400);
    const noKey = await get('/api/realestate/trades?lawd=11710&ym=202001');
    expect(noKey.status).toBe(503);
    expect(await noKey.json()).toMatchObject({ code: 'NO_KEY' });
  });

  it('health는 키 유무만 알린다', async () => {
    const body = await (await get('/api/health', { DATA_GO_KR_SERVICE_KEY: 'secret-x' })).json();
    expect(body).toMatchObject({ realestate: true, finlife: false });
    expect(JSON.stringify(body)).not.toContain('secret-x');
  });
});

describe('거래된 단지 묶기', () => {
  it('단지별 건수·㎡당 중앙값·최근 거래, 해제 거래 제외', () => {
    const t = (seq: string, date: string, price: number, area: number, cancelled = false) => ({
      aptSeq: seq,
      aptName: 'A',
      umdName: '잠실동',
      jibun: '19',
      date,
      price,
      area,
      floor: 5,
      buildYear: 2008,
      cancelled,
      dealType: '',
    });
    const g = groupTradesByComplex([
      t('1', '2026-09-01', 100000, 100),
      t('1', '2026-09-20', 300000, 100),
      t('1', '2026-09-25', 999999, 100, true),
      t('2', '2026-08-01', 50000, 50),
    ]);
    expect(g).toHaveLength(2);
    expect(g.find((x) => x.aptSeq === '1')).toMatchObject({
      count: 2,
      medianPricePerM2: 2000,
      lastDate: '2026-09-20',
      lastPrice: 300000,
    });
  });

  it('주소·계약년월 보조', () => {
    expect(jibunAddress('서울특별시 송파구', '잠실동', '19')).toBe('서울특별시 송파구 잠실동 19');
    expect(shiftYearMonth('202602', 2)).toBe('202512');
    expect(shiftYearMonth('202609', 0)).toBe('202609');
  });

  it('area 검증', async () => {
    const res = await get('/api/realestate/trade-complexes?lawd=11710&ym=202001&area=%3Cscript%3E', {
      DATA_GO_KR_SERVICE_KEY: 'k',
    });
    expect(res.status).toBe(400);
  });
});
