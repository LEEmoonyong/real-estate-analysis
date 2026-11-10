// 시세 해석 2 — 가격 변화 요약(1년 전 대비·최고가 대비·거래량 변화)과 층별 가격 차이.
// 평형 구성이 달라도 비교되도록 모두 전용 ㎡당 가격 중앙값으로 계산한다. React와 무관한 순수 함수.
import { median } from './aggregate';
import type { AptTrade } from './types';

type Pick = (t: AptTrade) => boolean;
const ALL: Pick = () => true;

const ymOf = (date: string) => date.slice(0, 7).replace('-', '');

/** 그 달들의 유효 거래 (해제 제외) */
function inMonths(trades: readonly AptTrade[], months: readonly string[], pick: Pick): AptTrade[] {
  const set = new Set(months);
  return trades.filter((t) => !t.cancelled && t.area > 0 && set.has(ymOf(t.date)) && pick(t));
}

const perM2 = (list: readonly AptTrade[]) => median(list.map((t) => t.price / t.area));

export interface PriceChange {
  /** 최근 3달 ㎡당 중앙값 [만원/㎡] */
  now: number | null;
  /** 약 1년 전(기간의 첫 3달) 대비 변화율 (0.08 = 8% 상승). 어느 한쪽에 거래가 없으면 null */
  yoy: number | null;
  /** 기간 중 달별 ㎡당 중앙값이 가장 높았던 달 */
  peak: { month: string; perM2: number } | null;
  /** 최고가 달 대비 지금 (−0.05 = 5% 낮음, 0 이상이면 지금이 최고 수준) */
  fromPeak: number | null;
  /** 최근 3달 / 그 앞 3달 거래 건수 */
  volumeNow: number;
  volumePrev: number;
  /** 거래량 변화율 (앞 3달이 0건이면 null) */
  volumeChange: number | null;
}

/**
 * 가격·거래량 변화 요약.
 * @param months 'YYYYMM' 목록 (오래된 달이 앞, 보통 12달)
 */
export function priceChange(trades: readonly AptTrade[], months: readonly string[], pick: Pick = ALL): PriceChange {
  const recent = inMonths(trades, months.slice(-3), pick);
  const now = perM2(recent);
  // 1년 전: 12달 가운데 첫 3달 (기간이 6달보다 짧으면 겹치므로 비교하지 않는다)
  const old = months.length >= 6 ? perM2(inMonths(trades, months.slice(0, 3), pick)) : null;
  let peak: PriceChange['peak'] = null;
  for (const m of months) {
    const v = perM2(inMonths(trades, [m], pick));
    if (v !== null && (!peak || v > peak.perM2)) peak = { month: `${m.slice(0, 4)}-${m.slice(4)}`, perM2: v };
  }
  const volumeNow = recent.length;
  const volumePrev = inMonths(trades, months.slice(-6, -3), pick).length;
  return {
    now,
    yoy: now !== null && old ? now / old - 1 : null,
    peak,
    fromPeak: now !== null && peak ? now / peak.perM2 - 1 : null,
    volumeNow,
    volumePrev,
    volumeChange: volumePrev > 0 ? volumeNow / volumePrev - 1 : null,
  };
}

export interface FloorBand {
  id: 'low' | 'mid' | 'high';
  label: string;
  /** 층 범위 (포함) */
  from: number;
  to: number;
  /** ㎡당 중앙값 [만원/㎡] */
  perM2: number | null;
  count: number;
}

export interface FloorAnalysis {
  /** 거래에 나온 가장 높은 층 (건물 최고층의 추정) */
  top: number;
  bands: FloorBand[];
  /** 고층이 저층보다 비싼 정도 (0.07 = 7% 비쌈). 한쪽 거래가 2건 미만이면 null */
  highVsLow: number | null;
}

/** 층 정보가 있는 거래가 이만큼은 있어야 나눠 본다 */
export const FLOOR_MIN_TRADES = 6;

/**
 * 층별 가격: 거래에 나온 최고층을 기준으로 저층(아래 1/3)·중층·고층(위 1/3)으로 나눠 ㎡당 중앙값을 비교한다.
 * 최고층이 6층 미만이거나 거래가 적으면 null.
 */
export function floorAnalysis(trades: readonly AptTrade[], pick: Pick = ALL): FloorAnalysis | null {
  const list = trades.filter((t) => !t.cancelled && t.area > 0 && t.floor !== null && t.floor >= 1 && pick(t));
  if (list.length < FLOOR_MIN_TRADES) return null;
  const top = Math.max(...list.map((t) => t.floor!));
  if (top < 6) return null;
  const lowTo = Math.floor(top / 3);
  const midTo = Math.floor((top * 2) / 3);
  const ranges = [
    { id: 'low', label: '저층', from: 1, to: lowTo },
    { id: 'mid', label: '중층', from: lowTo + 1, to: midTo },
    { id: 'high', label: '고층', from: midTo + 1, to: top },
  ] as const;
  const bands: FloorBand[] = ranges.map((r) => {
    const inBand = list.filter((t) => t.floor! >= r.from && t.floor! <= r.to);
    return { ...r, perM2: perM2(inBand), count: inBand.length };
  });
  const low = bands[0]!;
  const high = bands[2]!;
  const highVsLow =
    low.count >= 2 && high.count >= 2 && low.perM2 && high.perM2 !== null ? high.perM2 / low.perM2 - 1 : null;
  return { top, bands, highVsLow };
}

/** 변화율 글자: +8% / −5% / 변화 없음 */
export function changeText(v: number): string {
  const pct = Math.round(v * 100);
  if (pct === 0) return '변화 없음';
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`;
}
