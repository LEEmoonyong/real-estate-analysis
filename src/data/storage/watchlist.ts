// 관심 단지·새 거래 알림 규칙 (확장 X6) — React와 무관한 순수 함수, 단위 테스트한다.
// 관심 단지마다 "마지막으로 본 거래 날짜"를 두고, 그보다 새 매매 신고가 올라오면 새 거래로 센다.
import type { AptTrade } from '../../domain/realestate/types';
import { isArrayOf, isRecord } from './schema';

export const MAX_WATCHED = 30;

export interface WatchedComplex {
  /** 실거래 단지 식별자 (예: 11710-6346) */
  aptSeq: string;
  /** 시군구 코드 5자리 */
  lawd: string;
  name: string;
  lat: number;
  lng: number;
  /** 예: 서울특별시 송파구 */
  area: string;
  addedAt: number;
  /** 마지막으로 확인한 거래 날짜 YYYY-MM-DD ('' = 거래 없음) */
  seenDealDate: string;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export const isWatchedComplex = (x: unknown): x is WatchedComplex =>
  isRecord(x) &&
  typeof x.aptSeq === 'string' &&
  typeof x.lawd === 'string' &&
  typeof x.name === 'string' &&
  typeof x.area === 'string' &&
  typeof x.seenDealDate === 'string' &&
  isNum(x.lat) &&
  isNum(x.lng) &&
  isNum(x.addedAt);

export const isWatchList = isArrayOf(isWatchedComplex);

export function isWatched(list: readonly WatchedComplex[], aptSeq: string): boolean {
  return list.some((w) => w.aptSeq === aptSeq);
}

/** 있으면 빼고, 없으면 맨 앞에 넣는다 (최대 30곳) */
export function toggleWatched(list: readonly WatchedComplex[], entry: WatchedComplex): WatchedComplex[] {
  if (isWatched(list, entry.aptSeq)) return list.filter((w) => w.aptSeq !== entry.aptSeq);
  return [entry, ...list].slice(0, MAX_WATCHED);
}

/** 확인한 거래 날짜를 앞으로만 옮긴다 (바뀐 게 없으면 같은 배열) */
export function markSeen(list: readonly WatchedComplex[], aptSeq: string, date: string): readonly WatchedComplex[] {
  const target = list.find((w) => w.aptSeq === aptSeq);
  if (!target || date <= target.seenDealDate) return list;
  return list.map((w) => (w.aptSeq === aptSeq ? { ...w, seenDealDate: date } : w));
}

/** 이 단지의 가장 최근 매매 날짜 (해제 거래 제외, 없으면 '') */
export function latestDealDate(trades: readonly AptTrade[], aptSeq: string): string {
  let latest = '';
  for (const t of trades) if (t.aptSeq === aptSeq && !t.cancelled && t.date > latest) latest = t.date;
  return latest;
}

/** 마지막으로 본 날짜 이후의 새 매매 (해제 제외, 최신순) */
export function newDeals(trades: readonly AptTrade[], entry: WatchedComplex): AptTrade[] {
  return trades
    .filter((t) => t.aptSeq === entry.aptSeq && !t.cancelled && t.date > entry.seenDealDate)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** 새 거래를 확인할 달: 이번 달과 지난달 (YYYYMM, KST) — 신고 기한이 30일이라 두 달이면 충분 */
export function alertMonths(now = new Date()): string[] {
  const kst = new Date(now.getTime() + 9 * 3600_000);
  const t = kst.getUTCFullYear() * 12 + kst.getUTCMonth();
  const ym = (n: number) => `${Math.floor(n / 12)}${String((n % 12) + 1).padStart(2, '0')}`;
  return [ym(t), ym(t - 1)];
}
