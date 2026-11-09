// 시세 해석 (확장) — 전세가율 위험 단계, 동·시군구 평균과 비교, 비슷한 단지 찾기, 지도 표시 묶기, 건물별 전세가율.
// React와 무관한 순수 함수라 테스트로 확인한다.
import { distanceM, median } from './aggregate';
import type { DealPlace } from './property';
import type { AptRent, AptTrade } from './types';

// ---- 전세가율 ----------------------------------------------------------------

export type JeonseRiskLevel = 'low' | 'mid' | 'high' | 'danger';

export interface JeonseRisk {
  level: JeonseRiskLevel;
  label: string;
  note: string;
}

/**
 * 전세가율(전세 ÷ 매매) 위험 단계.
 * 흔히 쓰는 기준: 70% 미만 낮음, 70~80% 보통, 80~90% 주의(집값이 조금만 내려도 보증금을 못 돌려받을 수 있음), 90% 이상 위험.
 */
export function jeonseRisk(ratio: number): JeonseRisk {
  if (ratio >= 0.9)
    return { level: 'danger', label: '위험', note: '매매가와 전세가가 거의 같아 깡통전세 위험이 큽니다.' };
  if (ratio >= 0.8)
    return {
      level: 'high',
      label: '주의',
      note: '집값이 조금만 내려도 보증금을 다 돌려받지 못할 수 있습니다. 보증보험 가입을 확인하세요.',
    };
  if (ratio >= 0.7) return { level: 'mid', label: '보통', note: '전세 비중이 다소 높은 편입니다.' };
  return { level: 'low', label: '낮음', note: '매매가 대비 전세 비중이 낮아 상대적으로 안정적입니다.' };
}

// ---- 평균과 비교 ---------------------------------------------------------------

/** 'YYYYMM' 목록 → 'YYYY-MM' 집합 */
export function monthSet(months: readonly string[]): Set<string> {
  return new Set(months.map((m) => `${m.slice(0, 4)}-${m.slice(4)}`));
}

/** 거래들의 ㎡당 가격 중앙값 [만원/㎡] (해제 제외, 기간·조건에 맞는 것만) */
export function perM2Median(
  trades: readonly AptTrade[],
  months: ReadonlySet<string>,
  pick: (t: AptTrade) => boolean = () => true,
): { perM2: number | null; count: number } {
  const v = trades
    .filter((t) => !t.cancelled && t.area > 0 && months.has(t.date.slice(0, 7)) && pick(t))
    .map((t) => t.price / t.area);
  return { perM2: median(v), count: v.length };
}

/** 전세 계약(월세 0)의 ㎡당 보증금 중앙값 [만원/㎡] */
export function jeonsePerM2Median(
  rents: readonly AptRent[],
  months: ReadonlySet<string>,
  pick: (r: AptRent) => boolean = () => true,
): number | null {
  return median(
    rents
      .filter((r) => r.monthlyRent === 0 && r.area > 0 && months.has(r.date.slice(0, 7)) && pick(r))
      .map((r) => r.deposit / r.area),
  );
}

/** 평균 대비 차이 [%] (예: 0.12 = 12% 비쌈). 평균이 없으면 null */
export function diffFromAverage(value: number | null, average: number | null): number | null {
  if (value === null || average === null || average <= 0) return null;
  return value / average - 1;
}

export interface AreaComparison {
  /** 비교에 쓴 기간 [달] — 최근 3달 거래가 없으면 12달로 넓힌다 */
  months: number;
  complex: number | null;
  dong: { name: string; perM2: number | null; count: number };
  sigungu: { name: string; perM2: number | null; count: number };
  /** 같은 법정동 아파트 전세가율 (㎡당 전세 ÷ ㎡당 매매, 최근 3달) */
  dongJeonseRatio: number | null;
}

/**
 * 이 단지 ㎡당 가격을 같은 법정동·같은 시군구 아파트 매매 중앙값과 비교한다.
 * @param all 시군구 전체 매매 (최근 12달)
 * @param months 'YYYYMM' 최근 12달 (오래된 달이 앞)
 */
export function compareWithArea(
  all: readonly AptTrade[],
  months: readonly string[],
  aptSeq: string,
  dong: string,
  sigungu: string,
  rents: readonly AptRent[] = [],
): AreaComparison {
  const recent3 = monthSet(months.slice(-3));
  const dongTrade = perM2Median(all, recent3, (t) => t.umdName === dong).perM2;
  const dongJeonse = jeonsePerM2Median(rents, recent3, (r) => r.umdName === dong);
  const dongJeonseRatio = dongTrade && dongJeonse ? dongJeonse / dongTrade : null;
  const at = (n: number): AreaComparison => {
    const set = monthSet(months.slice(-n));
    return {
      months: n,
      complex: perM2Median(all, set, (t) => t.aptSeq === aptSeq).perM2,
      dong: { name: dong, ...perM2Median(all, set, (t) => t.umdName === dong) },
      sigungu: { name: sigungu, ...perM2Median(all, set) },
      dongJeonseRatio,
    };
  };
  const recent = at(3);
  return recent.complex !== null ? recent : at(months.length);
}

// ---- 비슷한 단지 ---------------------------------------------------------------

export interface SimilarCandidate {
  aptSeq: string;
  aptName: string;
  umdName: string;
  jibun: string;
  lat: number | null;
  lng: number | null;
  buildYear: number | null;
  /** [만원/㎡] */
  medianPricePerM2: number;
}

export interface SimilarBase {
  aptSeq: string;
  lat: number;
  lng: number;
  perM2: number;
  /** 전용면적 중앙값 [㎡] */
  area: number | null;
  buildYear: number | null;
}

export interface SimilarComplex extends SimilarCandidate {
  distanceM: number;
  area: number | null;
  /** 0에 가까울수록 비슷함 */
  score: number;
}

/** 단지별 전용면적 중앙값 [㎡] (해제 제외) */
export function areaMedians(trades: readonly AptTrade[]): Map<string, number> {
  const by = new Map<string, number[]>();
  for (const t of trades) {
    if (t.cancelled) continue;
    const list = by.get(t.aptSeq) ?? [];
    list.push(t.area);
    by.set(t.aptSeq, list);
  }
  const out = new Map<string, number>();
  for (const [k, v] of by) out.set(k, median(v)!);
  return out;
}

/**
 * 반경 안에서 평당가·평수·준공 연도가 비슷한 단지 (비슷한 순).
 * 차이 점수 = 가격 차이 비율 + 면적 차이 비율 + 준공 연도 차이/20 + 거리/반경×0.3
 * (가격·면적이 크게 다르면(각 35% 넘게) 후보에서 뺀다)
 */
export function similarComplexes(
  base: SimilarBase,
  candidates: readonly SimilarCandidate[],
  areas: ReadonlyMap<string, number>,
  radiusM = 1_000,
  n = 3,
): SimilarComplex[] {
  const out: SimilarComplex[] = [];
  for (const c of candidates) {
    if (c.aptSeq === base.aptSeq || c.lat === null || c.lng === null || c.medianPricePerM2 <= 0) continue;
    const d = distanceM(base, { lat: c.lat, lng: c.lng });
    if (d > radiusM) continue;
    const priceDiff = Math.abs(c.medianPricePerM2 / base.perM2 - 1);
    const area = areas.get(c.aptSeq) ?? null;
    const areaDiff = base.area && area ? Math.abs(area / base.area - 1) : 0.15;
    if (priceDiff > 0.35 || areaDiff > 0.35) continue;
    const yearDiff = base.buildYear && c.buildYear ? Math.abs(base.buildYear - c.buildYear) / 20 : 0.25;
    out.push({ ...c, distanceM: d, area, score: priceDiff + areaDiff + yearDiff + (d / radiusM) * 0.3 });
  }
  return out.sort((a, b) => a.score - b.score).slice(0, n);
}

// ---- 지도 표시 묶기 ------------------------------------------------------------

export interface ScreenPoint {
  /** 화면 좌표 [px] */
  x: number;
  y: number;
}

/**
 * 화면에서 겹치는 표시를 묶는다 (욕심쟁이 방식: 앞에 있는 것부터 기준이 되어 가까운 것을 모은다).
 * 가격 표시는 가로로 길어 가로 w, 세로 h 안에 들어오면 겹친다고 본다.
 * @returns 묶음마다 원래 인덱스 목록 (기준이 맨 앞)
 */
export function clusterByScreen(points: readonly ScreenPoint[], w = 96, h = 44): number[][] {
  const used = new Array<boolean>(points.length).fill(false);
  const groups: number[][] = [];
  for (let i = 0; i < points.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const g = [i];
    const p = points[i]!;
    for (let j = i + 1; j < points.length; j++) {
      if (used[j]) continue;
      const q = points[j]!;
      if (Math.abs(q.x - p.x) < w && Math.abs(q.y - p.y) < h) {
        used[j] = true;
        g.push(j);
      }
    }
    groups.push(g);
  }
  return groups;
}

/** 위경도 → 화면 좌표 (지도 보이는 범위·크기 기준 등장방형 근사 — 시군구 크기에서는 충분) */
export function toScreen(
  at: { lat: number; lng: number },
  bounds: { south: number; west: number; north: number; east: number },
  size: { width: number; height: number },
): ScreenPoint {
  return {
    x: ((at.lng - bounds.west) / (bounds.east - bounds.west)) * size.width,
    y: ((bounds.north - at.lat) / (bounds.north - bounds.south)) * size.height,
  };
}

// ---- 지도 건물별 전세가율 -------------------------------------------------------

/**
 * 같은 건물의 매매·전세 표시로 전세가율을 구한다 (㎡당 값끼리 — 두 거래의 평수가 달라도 비교되게).
 * @param trade 매매 표시 (value = ㎡당 매매 중앙값)
 * @param jeonse 전세 표시 (value = 전세 보증금 중앙값, areaMedian = 전용 중앙값)
 * @returns 건물 key → 전세가율 (0~)
 */
export function placeJeonseRatios(
  trade: readonly Pick<DealPlace, 'key' | 'value'>[],
  jeonse: readonly Pick<DealPlace, 'key' | 'value' | 'areaMedian'>[],
): Map<string, number> {
  const j = new Map(jeonse.filter((p) => p.areaMedian > 0).map((p) => [p.key, p.value / p.areaMedian]));
  const out = new Map<string, number>();
  for (const t of trade) {
    const jPerM2 = j.get(t.key);
    if (jPerM2 !== undefined && t.value > 0) out.set(t.key, jPerM2 / t.value);
  }
  return out;
}
