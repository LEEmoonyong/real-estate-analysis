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
import type { AptRent, AptTrade, Region, TradeComplex } from '../../domain/realestate/types';
import type { ComplexTarget } from '../../routes/complexKey';

export const MARKET_MONTHS = 12;
/** 주소에 실거래 단지가 없을 때 이 거리 안의 가장 가까운 거래 단지를 이 단지로 본다 */
const MATCH_RADIUS_M = 250;
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
    };

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
    all?: { trades: AptTrade[]; rents: AptRent[] };
  }>({ key: '', value: { status: 'loading', step: '위치 확인 중' } });

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const set = (value: ComplexMarket, all?: { trades: AptTrade[]; rents: AptRent[] }) =>
      !signal.aborted && setState({ key: targetKey, value, ...(all ? { all } : {}) });
    set({ status: 'loading', step: '위치 확인 중' });

    void (async () => {
      try {
        const at = await targetPoint(target);
        const region = await getRegion(at.lat, at.lng, signal);
        const lawd = target.kind === 'geo' && target.lawd ? target.lawd : region.lawdCode;
        const latest = latestDealMonth();
        set({ status: 'loading', step: `${region.sigungu} 거래 단지 찾는 중` });
        const list = await getTradeComplexes({ ...region, lawdCode: lawd }, latest, 3, signal);
        const wanted = target.kind === 'geo' ? target.aptSeq : undefined;
        const near = nearbyTradeComplexes(list, at, NEARBY_RADIUS_M);
        const complex =
          (wanted ? list.find((c) => c.aptSeq === wanted) : undefined) ??
          near.find((c) => c.distanceM <= MATCH_RADIUS_M) ??
          null;
        const months = recentMonths(latest, MARKET_MONTHS);
        set({ status: 'loading', step: `최근 ${MARKET_MONTHS}달 실거래 불러오는 중` });
        // 달마다 매매·전월세 — 서버·브라우저 모두 캐시하므로 같은 시군구는 두 번째부터 즉시
        const [tradesByMonth, rentsByMonth] = await Promise.all([
          Promise.all(months.map((m) => getTrades(lawd, m, signal))),
          Promise.all(months.map((m) => getRents(lawd, m, signal))),
        ]);
        const all = { trades: tradesByMonth.flat(), rents: rentsByMonth.flat() };
        set(
          {
            status: 'ready',
            region: { ...region, lawdCode: lawd },
            months,
            complex,
            nearby: near.filter((c) => c.aptSeq !== complex?.aptSeq),
            trades: [],
            rents: [],
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
    const seq = v.complex?.aptSeq;
    const byDate = <T extends { date: string }>(a: T, b: T) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
    return {
      ...v,
      trades: seq ? state.all.trades.filter((t) => t.aptSeq === seq).sort(byDate) : [],
      rents: seq ? state.all.rents.filter((r) => r.aptSeq === seq).sort(byDate) : [],
    };
  }, [state, targetKey]);
}
