// 부동산 데이터 클라이언트 — /api/region·/api/realestate/* 호출 (키 없는 로컬 실행이면 배포 서버 경유, apiClient가 처리)
// [요구사항: 데이터 처리] 외부 API(국토교통부 실거래가·공동주택, 카카오 좌표→법정동)
// 같은 요청은 메모리에 한 번만 (지도 이동·탭 전환으로 같은 시군구·같은 달을 여러 번 부르지 않게)
import { getJson } from '../apiClient';
import { snapshotBaseMonth } from '../marketSnapshot';
import type { NearbyResponse } from '../../domain/realestate/nearby';
import type { DealKind, DealPlace, PropertyType, RoomFilter } from '../../domain/realestate/property';
import type {
  AptComplex,
  AptComplexInfo,
  AptRent,
  AptTrade,
  Region,
  TradeComplex,
} from '../../domain/realestate/types';

const memo = new Map<string, Promise<unknown>>();

function cached<T>(url: string, signal?: AbortSignal): Promise<T> {
  let p = memo.get(url) as Promise<T> | undefined;
  if (!p) {
    p = getJson<T>(url);
    memo.set(url, p);
    p.catch(() => memo.delete(url)); // 실패는 다음에 다시 시도
  }
  if (!signal) return p;
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    p.then(resolve, reject);
  });
}

/** 테스트·장면 전환용 */
export function clearRealestateCache(): void {
  memo.clear();
}

const q = (params: Record<string, string | number>) =>
  new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();

export function getRegion(lat: number, lng: number, signal?: AbortSignal): Promise<Region> {
  return cached<Region>(`/api/region?${q({ lat: lat.toFixed(6), lng: lng.toFixed(6) })}`, signal);
}

export async function getTrades(lawd: string, ym: string, signal?: AbortSignal): Promise<AptTrade[]> {
  const r = await cached<{ items: AptTrade[] }>(`/api/realestate/trades?${q({ lawd, ym })}`, signal);
  return r.items;
}

export async function getRents(lawd: string, ym: string, signal?: AbortSignal): Promise<AptRent[]> {
  const r = await cached<{ items: AptRent[] }>(`/api/realestate/rents?${q({ lawd, ym })}`, signal);
  return r.items;
}

/** 지도 표시용: 최근 months달 거래된 단지 요약 + 좌표. area는 '서울특별시 송파구' */
export async function getTradeComplexes(
  region: Pick<Region, 'lawdCode' | 'sido' | 'sigungu'>,
  ym: string,
  months = 3,
  signal?: AbortSignal,
): Promise<TradeComplex[]> {
  const area = `${region.sido} ${region.sigungu}`;
  const r = await cached<{ items: TradeComplex[] }>(
    `/api/realestate/trade-complexes?${q({ lawd: region.lawdCode, ym, months, area })}`,
    signal,
  );
  return r.items;
}

/** 지도 표시용 (확장 X8): 유형 하나 · 거래 종류 · 방 구조별 최근 3달 거래를 건물(또는 동)별로 묶은 목록 + 좌표 */
export async function getDealPlaces(
  region: Pick<Region, 'lawdCode' | 'sido' | 'sigungu'>,
  type: PropertyType,
  query: { kind: DealKind; room: RoomFilter },
  ym: string,
  signal?: AbortSignal,
): Promise<{ items: DealPlace[]; total: number; truncated: boolean }> {
  const area = `${region.sido} ${region.sigungu}`;
  return cached<{ items: DealPlace[]; total: number; truncated: boolean }>(
    `/api/realestate/deal-places?${q({ type, kind: query.kind, room: query.room, lawd: region.lawdCode, ym, months: 3, area })}`,
    signal,
  );
}

export async function getComplexes(sigungu: string, signal?: AbortSignal): Promise<AptComplex[]> {
  const r = await cached<{ items: AptComplex[] }>(`/api/realestate/complexes?${q({ sigungu })}`, signal);
  return r.items;
}

export async function getComplexInfo(kaptCode: string, signal?: AbortSignal): Promise<AptComplexInfo> {
  const r = await cached<{ info: AptComplexInfo }>(`/api/realestate/complex?${q({ kaptCode })}`, signal);
  return r.info;
}

/**
 * 실거래 공개 최신 달 — 신고 기한(계약 후 30일) 때문에 이번 달 자료는 거의 비어 있어 지난달을 기준으로 한다.
 * @returns 'YYYYMM'
 */
export function latestDealMonth(now?: Date): string {
  // 샘플 모드(스냅샷)에서는 받아 둔 달을 기준으로 한다 — 오늘 날짜로 만들면 저장된 주소와 맞지 않는다
  if (!now) {
    const base = snapshotBaseMonth();
    if (base) return base;
    now = new Date();
  }
  const kst = new Date(now.getTime() + 9 * 3600_000);
  const t = kst.getUTCFullYear() * 12 + kst.getUTCMonth() - 1;
  return `${Math.floor(t / 12)}${String((t % 12) + 1).padStart(2, '0')}`;
}

/** 주변 시설 (학교·지하철·마트·병원·어린이집) — 카카오 카테고리 검색 */
export function getNearby(lat: number, lng: number, signal?: AbortSignal): Promise<NearbyResponse> {
  return cached<NearbyResponse>(`/api/nearby?${q({ lat: lat.toFixed(5), lng: lng.toFixed(5) })}`, signal);
}
