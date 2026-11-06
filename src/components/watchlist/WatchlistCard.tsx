// [요구사항: 컴포넌트] 지도 홈의 관심 단지 목록 + 새 거래 알림 (확장 X6)
// [요구사항: 이벤트 처리] onClick(단지 시세 열기, 관심 단지 빼기)
import { useNavigate } from 'react-router-dom';
import { useWatchlist } from '../../contexts/WatchlistContext';
import { formatArea, formatManwon } from '../../domain/realestate/format';
import type { NewDealsState } from '../../hooks/useNewDeals';
import { complexPath } from '../../routes/complexKey';
import styles from './WatchlistCard.module.css';

export function WatchlistCard({ deals }: { deals: NewDealsState }) {
  const { watched, toggle } = useWatchlist();
  const navigate = useNavigate();
  if (watched.length === 0) return null;

  return (
    <section
      className={styles.root}
      aria-label="관심 단지"
      data-new-deals={deals.status === 'ready' ? deals.total : ''}
    >
      <h2 className={styles.title}>
        관심 단지 <span className={styles.muted}>{watched.length}곳</span>
        {deals.status === 'loading' && <span className={styles.muted}> · 새 거래 확인 중…</span>}
        {deals.status === 'error' && <span className={styles.muted}> · 새 거래를 확인하지 못했습니다</span>}
      </h2>
      <ul className={styles.list}>
        {watched.map((w) => {
          const found = deals.status === 'ready' ? (deals.byComplex[w.aptSeq] ?? []) : [];
          const latest = found[0];
          return (
            <li key={w.aptSeq} className={styles.item}>
              <button
                type="button"
                className={styles.open}
                onClick={() =>
                  navigate(
                    complexPath(
                      {
                        kind: 'geo',
                        lat: w.lat,
                        lng: w.lng,
                        name: w.name,
                        address: w.area,
                        aptSeq: w.aptSeq,
                        lawd: w.lawd,
                      },
                      'price',
                    ),
                  )
                }
              >
                <span className={styles.name}>
                  {w.name}
                  {found.length > 0 && <span className={styles.badge}>새 거래 {found.length}건</span>}
                </span>
                <span className={styles.muted}>
                  {latest
                    ? `${latest.date} ${formatArea(latest.area)} ${formatManwon(latest.price)}${latest.floor ? ` · ${latest.floor}층` : ''}`
                    : w.area}
                </span>
              </button>
              <button
                type="button"
                className={styles.remove}
                aria-label={`${w.name} 관심 단지에서 빼기`}
                onClick={() => toggle(w)}
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
      <p className={styles.muted}>
        이번 달·지난달 매매 신고 중 마지막으로 본 뒤 올라온 거래를 표시합니다. 단지 시세 탭을 열면 확인한 것으로 봅니다.
      </p>
    </section>
  );
}
