// [요구사항: Hooks] 커스텀 훅 — 관심 단지들의 새 매매 신고를 찾는다 (확장 X6)
// 관심 단지가 속한 시군구마다 이번 달·지난달 실거래를 한 번씩 불러(브라우저·서버 캐시) 단지별로 거른다.
// useEffect + AbortController로 화면을 떠나면 요청을 취소한다.
import { useEffect, useState } from 'react';
import { getTrades } from '../data/realestate/realestateClient';
import { alertMonths, newDeals, type WatchedComplex } from '../data/storage/watchlist';
import type { AptTrade } from '../domain/realestate/types';

export type NewDealsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; byComplex: Record<string, AptTrade[]>; total: number }
  | { status: 'error'; message: string };

export function useNewDeals(watched: readonly WatchedComplex[]): NewDealsState {
  const [state, setState] = useState<NewDealsState>({ status: 'idle' });
  // 목록 내용(단지·확인 날짜)이 바뀔 때만 다시 확인한다
  const key = watched.map((w) => `${w.aptSeq}@${w.seenDealDate}`).join(',');

  useEffect(() => {
    if (watched.length === 0) {
      setState({ status: 'idle' });
      return;
    }
    const controller = new AbortController();
    setState({ status: 'loading' });
    const lawds = [...new Set(watched.map((w) => w.lawd))];
    const months = alertMonths();
    Promise.all(lawds.flatMap((lawd) => months.map((ym) => getTrades(lawd, ym, controller.signal))))
      .then((lists) => {
        const all = lists.flat();
        const byComplex: Record<string, AptTrade[]> = {};
        let total = 0;
        for (const w of watched) {
          const found = newDeals(all, w);
          if (found.length) {
            byComplex[w.aptSeq] = found;
            total += found.length;
          }
        }
        setState({ status: 'ready', byComplex, total });
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted)
          setState({ status: 'error', message: e instanceof Error ? e.message : String(e) });
      });
    return () => controller.abort();
    // key가 watched 내용을 대신한다 (배열 참조가 바뀌어도 내용이 같으면 다시 부르지 않음)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}
