// 시세 집계 — 단지 하나의 실거래를 달·평형대별로 묶는다 (시세·실거래 탭 그래프와 표)
import { areaBandOf, type AreaBandId } from './format';
import type { AptRent, AptTrade, TradeComplex } from './types';

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** 'YYYYMM'부터 거꾸로 n달 (오래된 달이 앞) */
export function recentMonths(latest: string, n: number): string[] {
  const t0 = Number(latest.slice(0, 4)) * 12 + Number(latest.slice(4)) - 1;
  return Array.from({ length: n }, (_, i) => {
    const t = t0 - (n - 1 - i);
    return `${Math.floor(t / 12)}${String((t % 12) + 1).padStart(2, '0')}`;
  });
}

export interface MonthlyPoint {
  /** 'YYYY-MM' */
  month: string;
  /** 매매 중앙값 [만원] (거래 없으면 null) */
  median: number | null;
  count: number;
}

/** 달별 매매 중앙값 — 해제 거래 제외, band가 있으면 그 평형대만 */
export function monthlyTradeMedians(
  trades: readonly AptTrade[],
  months: readonly string[],
  band?: AreaBandId,
): MonthlyPoint[] {
  return months.map((ym) => {
    const month = `${ym.slice(0, 4)}-${ym.slice(4)}`;
    const prices = trades
      .filter((t) => !t.cancelled && t.date.startsWith(month) && (!band || areaBandOf(t.area) === band))
      .map((t) => t.price);
    return { month, median: median(prices), count: prices.length };
  });
}

/** 달별 전세 보증금 중앙값 (월세 0인 계약만) */
export function monthlyJeonseMedians(
  rents: readonly AptRent[],
  months: readonly string[],
  band?: AreaBandId,
): MonthlyPoint[] {
  return months.map((ym) => {
    const month = `${ym.slice(0, 4)}-${ym.slice(4)}`;
    const deposits = rents
      .filter((r) => r.monthlyRent === 0 && r.date.startsWith(month) && (!band || areaBandOf(r.area) === band))
      .map((r) => r.deposit);
    return { month, median: median(deposits), count: deposits.length };
  });
}

/** 거래가 있는 평형대 목록 (거래 많은 순) */
export function bandsWithTrades(trades: readonly AptTrade[]): { band: AreaBandId; count: number }[] {
  const counts = new Map<AreaBandId, number>();
  for (const t of trades) if (!t.cancelled) counts.set(areaBandOf(t.area), (counts.get(areaBandOf(t.area)) ?? 0) + 1);
  return [...counts].map(([band, count]) => ({ band, count })).sort((a, b) => b.count - a.count);
}

/** 전세가율 = 전세 중앙값 / 매매 중앙값 (같은 평형대·기간) */
export function jeonseRatio(tradeMedian: number | null, jeonseMedian: number | null): number | null {
  if (!tradeMedian || !jeonseMedian) return null;
  return jeonseMedian / tradeMedian;
}

/** 두 좌표 사이 거리 [m] (짧은 거리용 평면 근사) */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dy = (a.lat - b.lat) * 111_320;
  const dx = (a.lng - b.lng) * 111_320 * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  return Math.hypot(dx, dy);
}

/** 위치 근처의 거래 단지 (가까운 순) */
export function nearbyTradeComplexes(
  list: readonly TradeComplex[],
  at: { lat: number; lng: number },
  radiusM: number,
): (TradeComplex & { distanceM: number })[] {
  return list
    .filter((c) => c.lat !== null && c.lng !== null)
    .map((c) => ({ ...c, distanceM: distanceM(at, { lat: c.lat!, lng: c.lng! }) }))
    .filter((c) => c.distanceM <= radiusM)
    .sort((a, b) => a.distanceM - b.distanceM);
}
