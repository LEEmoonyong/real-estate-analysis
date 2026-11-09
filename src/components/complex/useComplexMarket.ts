// [요구사항: Hooks] 커스텀 훅 — 단지 주소(대상) → 시군구·실거래 단지 확정 → 최근 12달 매매·전월세
// useEffect(AbortController로 이전 요청 취소), useState(진행 상태·결과), useMemo(단지 거래만 거르기)
// 실거래 단지 식별자(seq)가 주소에 있으면 그대로, 없으면(검색·샘플로 연 경우) 좌표에서 가장 가까운 거래 단지를 고른다.
import { useEffect, useMemo, useState } from 'react';
import {
  getRegion,
  getRents,
  getTradeComplexes,
  getTrades,
  latestDealMonth,
} from '../../data/realestate/realestateClient';
import { loadSampleIndex } from '../../data/samples/sampleClient';
import { nearbyTradeComplexes, recentMonths } from '../../domain/realestate/aggregate';
import {
  areaMedians,
  compareWithArea,
  similarComplexes,
  type AreaComparison,
  type SimilarComplex,
} from '../../domain/realestate/insight';
import { bestNamedNearby } from '../../domain/realestate/match';
import type { AptRent, AptTrade, Region, TradeComplex } from '../../domain/realestate/types';
import type { ComplexTarget } from '../../routes/complexKey';

export const MARKET_MONTHS = 12;
/** 단지를 찾을 때 보는 최근 매매 기간 [달] (서버 상한 6) */
const MATCH_MONTHS = 6;
const NEARBY_RADIUS_M = 600;

export type ComplexMarket =
  | { status: 'loading'; step: string }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      region: Region;
      months: string[];
      /** 이 단지 (최근 3달 거래가 없으면 null) */
      complex: TradeComplex | null;
      /** 주변 거래 단지 (가까운 순, 이 단지 제외) */
      nearby: (TradeComplex & { distanceM: number })[];
      trades: AptTrade[];
      rents: AptRent[];
      /** 같은 동·시군구 평균과 비교 (이 단지를 못 찾으면 null) */
      comparison: AreaComparison | null;
      /** 1km 안 평당가·평수·연식이 비슷한 단지 (최대 3곳) */
      similar: SimilarComplex[];
    };

/** 시군구 전체 거래와 단지 목록 (이 단지 거래·평균 비교·비슷한 단지 계산에 쓴다) */
interface AllDeals {
  trades: AptTrade[];
  rents: AptRent[];
  list: TradeComplex[];
  /** 대상 위치 */
  at: { lat: number; lng: number };
}

async function targetPoint(target: ComplexTarget): Promise<{ lat: number; lng: number }> {
  if (target.kind === 'geo') return { lat: target.lat, lng: target.lng };
  const index = await loadSampleIndex();
  const s = index.find((e) => e.id === target.sampleId);
  if (!s) throw new Error('샘플 지역을 찾을 수 없습니다.');
  return s.center;
}

export function useComplexMarket(target: ComplexTarget, targetKey: string): ComplexMarket {
  const [state, setState] = useState<{
    key: string;
    value: ComplexMarket;
    all?: AllDeals;
  }>({ key: '', value: { status: 'loading', step: '위치 확인 중' } });

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const set = (value: ComplexMarket, all?: AllDeals) =>
      !signal.aborted && setState({ key: targetKey, value, ...(all ? { all } : {}) });
    set({ status: 'loading', step: '위치 확인 중' });

    void (async () => {
      try {
        const at = await targetPoint(target);
        const region = await getRegion(at.lat, at.lng, signal);
        const lawd = target.kind === 'geo' && target.lawd ? target.lawd : region.lawdCode;
        const latest = latestDealMonth();
        set({ status: 'loading', step: `${region.sigungu} 거래 단지 찾는 중` });
        // 단지 찾기는 최근 6달 거래로 (거래가 뜸한 단지도 찾도록 — 2026-11 위례 신안인스빌아스트로는 최근 3달 0건)
        const list = await getTradeComplexes({ ...region, lawdCode: lawd }, latest, MATCH_MONTHS, signal);
        const wanted = target.kind === 'geo' ? target.aptSeq : undefined;
        const near = nearbyTradeComplexes(list, at, NEARBY_RADIUS_M);
        // 좌표를 못 붙인 단지(주소 검색 실패)도 같은 법정동이면 이름으로는 찾는다
        const noCoord = list
          .filter((c) => (c.lat === null || c.lng === null) && c.umdName === region.dong)
          .map((c) => ({ ...c, distanceM: Number.POSITIVE_INFINITY }));
        const complex =
          (wanted ? list.find((c) => c.aptSeq === wanted) : undefined) ??
          // 검색으로 연 단지: 이름이 맞는 단지만 (큰 단지는 검색 좌표와 대표 지번이 멀 수 있다).
          // 이름이 맞는 단지가 없으면 가까운 다른 단지를 "이 단지"로 보지 않는다 — 엉뚱한 단지 정보가 나오므로
          (target.kind === 'geo'
            ? (bestNamedNearby(target.name, near, region.sigungu) ??
              bestNamedNearby(target.name, noCoord, region.sigungu))
            : // 샘플 지역은 중심이 단지 사이일 수 있어 주변 반경 안 가장 가까운 단지를 대표로 본다
              near.find((c) => c.distanceM <= NEARBY_RADIUS_M)) ??
          null;
        const months = recentMonths(latest, MARKET_MONTHS);
        set({ status: 'loading', step: `최근 ${MARKET_MONTHS}달 실거래 불러오는 중` });
        // 달마다 매매·전월세 — 서버·브라우저 모두 캐시하므로 같은 시군구는 두 번째부터 즉시
        const [tradesByMonth, rentsByMonth] = await Promise.all([
          Promise.all(months.map((m) => getTrades(lawd, m, signal))),
          Promise.all(months.map((m) => getRents(lawd, m, signal))),
        ]);
        const all = { trades: tradesByMonth.flat(), rents: rentsByMonth.flat(), list, at };
        set(
          {
            status: 'ready',
            region: { ...region, lawdCode: lawd },
            months,
            complex,
            nearby: near.filter((c) => c.aptSeq !== complex?.aptSeq),
            trades: [],
            rents: [],
            comparison: null,
            similar: [],
          },
          all,
        );
      } catch (e) {
        if (signal.aborted) return;
        set({ status: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => controller.abort();
    // target은 targetKey가 같으면 같은 대상
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  // 이 단지 거래만 (최신순)
  return useMemo(() => {
    const v = state.key === targetKey ? state.value : ({ status: 'loading', step: '위치 확인 중' } as const);
    if (v.status !== 'ready' || !state.all) return v;
    const { complex } = v;
    const all = state.all;
    const seq = complex?.aptSeq;
    const byDate = <T extends { date: string }>(a: T, b: T) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
    // 동·시군구 평균 비교와 비슷한 단지 — 이미 받은 시군구 전체 거래로 계산 (서버를 더 부르지 않는다)
    const areas = areaMedians(all.trades);
    const comparison = complex
      ? compareWithArea(all.trades, v.months, complex.aptSeq, complex.umdName, v.region.sigungu, all.rents)
      : null;
    const similar = complex
      ? similarComplexes(
          {
            aptSeq: complex.aptSeq,
            lat: complex.lat ?? all.at.lat,
            lng: complex.lng ?? all.at.lng,
            perM2: complex.medianPricePerM2,
            area: areas.get(complex.aptSeq) ?? null,
            buildYear: complex.buildYear,
          },
          all.list,
          areas,
        )
      : [];
    return {
      ...v,
      trades: seq ? all.trades.filter((t) => t.aptSeq === seq).sort(byDate) : [],
      rents: seq ? all.rents.filter((r) => r.aptSeq === seq).sort(byDate) : [],
      comparison,
      similar,
    };
  }, [state, targetKey]);
}
