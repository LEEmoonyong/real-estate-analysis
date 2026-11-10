// [요구사항: 컴포넌트] 관심 단지 버튼 (확장 X6) — ☆/★ 토글, 이 화면을 보면 그때까지의 거래를 "확인함"으로 표시
// [요구사항: 이벤트 처리] onClick(관심 단지 넣기·빼기)
// [요구사항: Hooks] useEffect(이번 달 거래까지 불러와 확인 처리, AbortController)
import { useEffect } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { useWatchlist } from '../../contexts/WatchlistContext';
import { getTrades } from '../../data/realestate/realestateClient';
import { alertMonths, isWatched, latestDealDate } from '../../data/storage/watchlist';
import type { AptTrade, Region, TradeComplex } from '../../domain/realestate/types';
import styles from './Complex.module.css';

interface WatchButtonProps {
  complex: TradeComplex;
  region: Region;
  /** 이 화면에 이미 불러온 거래 (최근 12달) */
  trades: readonly AptTrade[];
}

export function WatchButton({ complex, region, trades }: WatchButtonProps) {
  const { watched, toggle, seen } = useWatchlist();
  const { showToast } = useToast();
  const on = isWatched(watched, complex.aptSeq);

  // 관심 단지를 열어 보면 이번 달 신고분까지 확인한 것으로 본다
  useEffect(() => {
    if (!on) return;
    const controller = new AbortController();
    getTrades(region.lawdCode, alertMonths()[0]!, controller.signal)
      .catch(() => [] as AptTrade[])
      .then((current) => {
        if (controller.signal.aborted) return;
        const latest = [latestDealDate(trades, complex.aptSeq), latestDealDate(current, complex.aptSeq)].sort().pop();
        if (latest) seen(complex.aptSeq, latest);
      });
    return () => controller.abort();
  }, [on, region.lawdCode, complex.aptSeq, trades, seen]);

  const handleClick = () => {
    if (complex.lat === null || complex.lng === null) return;
    toggle({
      aptSeq: complex.aptSeq,
      lawd: region.lawdCode,
      name: complex.aptName,
      lat: complex.lat,
      lng: complex.lng,
      area: `${region.sido} ${region.sigungu}`,
      addedAt: Date.now(),
      seenDealDate: latestDealDate(trades, complex.aptSeq),
    });
    showToast({
      message: on
        ? `${complex.aptName}을(를) 관심 단지에서 뺐습니다.`
        : `${complex.aptName}을(를) 관심 단지에 넣었습니다. 지도 화면의 ★ 즐겨찾기에 모이고, 새 거래가 올라오면 알려 드립니다.`,
    });
  };

  return (
    <button
      type="button"
      className={styles.watchButton}
      aria-pressed={on}
      onClick={handleClick}
      disabled={complex.lat === null || complex.lng === null}
    >
      {on ? '★ 관심 단지' : '☆ 관심 단지'}
    </button>
  );
}
