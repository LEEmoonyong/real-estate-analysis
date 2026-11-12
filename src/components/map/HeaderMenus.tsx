// [요구사항: 컴포넌트] 지도 머리글의 검색 옆 버튼 — "비교"(단지 비교 화면으로), "즐겨찾기"(목록 펼침)
//   즐겨찾기 목록 = 관심 단지(☆ 관심 단지로 담은 곳, 새 거래 알림 포함) + 예전에 저장한 위치
// [요구사항: 상태관리] useState 대신 부모가 열림 상태를 쥔다(🔔 새 거래 버튼도 같은 목록을 연다) / Context — 관심 단지·즐겨찾기·비교
// [요구사항: 이벤트 처리] onClick(열기·닫기·항목 열기·삭제), 바깥 클릭·Esc로 닫기
// [요구사항: Hooks] useEffect(바깥 클릭·Esc 듣기), useRef(목록 영역)
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useCompare } from '../../contexts/CompareContext';
import { useFavorites, useFavoritesActions } from '../../contexts/FavoritesContext';
import { useWatchlist } from '../../contexts/WatchlistContext';
import type { Favorite } from '../../domain/types';
import type { NewDealsState } from '../../hooks/useNewDeals';
import { WatchlistCard } from '../watchlist/WatchlistCard';
import styles from './HeaderMenus.module.css';

interface HeaderMenusProps {
  favoritesOpen: boolean;
  onFavoritesOpen: (open: boolean) => void;
  /** 관심 단지 새 거래 */
  deals: NewDealsState;
  /** 예전에 저장한 위치를 고름 → 단지 분석으로 */
  onOpenFavorite: (fav: Favorite) => void;
}

export function HeaderMenus({ favoritesOpen, onFavoritesOpen, deals, onOpenFavorite }: HeaderMenusProps) {
  const { list: compareList } = useCompare();
  const { watched } = useWatchlist();
  const { favorites } = useFavorites();
  // 삭제하면 5초 동안 "실행 취소" 알림이 뜬다 (FavoritesContext)
  const { removeFavorite } = useFavoritesActions();
  const rootRef = useRef<HTMLDivElement>(null);
  const total = watched.length + favorites.length;
  const newCount = deals.status === 'ready' ? deals.total : 0;

  useEffect(() => {
    if (!favoritesOpen) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && e.target instanceof Node && !rootRef.current.contains(e.target)) onFavoritesOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFavoritesOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [favoritesOpen, onFavoritesOpen]);

  return (
    <div className={styles.root}>
      <Link
        to="/compare"
        className={styles.button}
        title={compareList.length > 0 ? compareList.map((e) => e.name).join(', ') : '비교에 담은 단지가 없습니다'}
      >
        비교{compareList.length > 0 && <span className={styles.count}>{compareList.length}</span>}
      </Link>
      <div className={styles.menuWrap} ref={rootRef}>
        <button
          type="button"
          className={styles.button}
          aria-expanded={favoritesOpen}
          aria-haspopup="dialog"
          title={`즐겨찾기 ${total}곳${newCount > 0 ? ` · 관심 단지 새 거래 ${newCount}건` : ''}`}
          onClick={() => onFavoritesOpen(!favoritesOpen)}
        >
          <span aria-hidden="true">★</span>
          <span className={styles.label}>즐겨찾기</span>
          {total > 0 && <span className={styles.count}>{total}</span>}
          {newCount > 0 && (
            <span className={styles.newBadge}>
              <span className={styles.label}>새 거래 </span>
              {newCount}
            </span>
          )}
        </button>
        {favoritesOpen && (
          <div className={styles.menu} role="dialog" aria-label="즐겨찾기 목록">
            {total === 0 && (
              <p className={styles.empty}>
                아직 즐겨찾기한 단지가 없습니다. 단지 상세 위쪽의 <strong>☆ 관심 단지</strong>를 누르면 여기에 모이고,
                새 거래가 올라오면 알려 드립니다.
              </p>
            )}
            <WatchlistCard deals={deals} />
            {favorites.length > 0 && (
              <section className={styles.section} aria-label="저장한 위치">
                <h2 className={styles.sectionTitle}>
                  저장한 위치 <span className={styles.muted}>{favorites.length}곳</span>
                </h2>
                <ul className={styles.list}>
                  {favorites.map((f) => (
                    <li key={f.id} className={styles.row}>
                      <button
                        type="button"
                        className={styles.item}
                        onClick={() => onOpenFavorite(f)}
                        title={`${f.name} 단지 분석 열기`}
                      >
                        <span aria-hidden="true">★</span> {f.name}
                      </button>
                      <button
                        type="button"
                        className={styles.remove}
                        onClick={() => removeFavorite(f.id)}
                        aria-label={`저장한 위치 '${f.name}' 삭제`}
                        title="삭제"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
