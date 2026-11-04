// [요구사항: 컴포넌트] 최근 검색 10개 (PLAN.md 단계 B5) — 검색에 성공하면 자동으로 쌓인다
// [요구사항: 이벤트 처리] onClick(이동, 개별 삭제, 전체 삭제)
import { useFavorites, useFavoritesActions } from '../../contexts/FavoritesContext';
import type { NavigateTarget } from './FavoritesPanel';
import styles from './Favorites.module.css';

export function RecentSearches({ onNavigate }: { onNavigate: (target: NavigateTarget) => void }) {
  const { recents } = useFavorites();
  const { removeRecent, clearRecents } = useFavoritesActions();

  if (recents.length === 0) return <p className={styles.muted}>최근 검색이 없습니다.</p>;

  return (
    <div className={styles.root}>
      <div className={styles.headerRow}>
        <span className={styles.subTitle}>최근 검색</span>
        <button type="button" className={styles.linkButton} onClick={clearRecents}>
          전체 삭제
        </button>
      </div>
      <ul className={styles.list} aria-label="최근 검색">
        {recents.map((r) => (
          <li key={r.at} className={styles.item}>
            <button
              type="button"
              className={styles.itemButton}
              onClick={() =>
                onNavigate({ name: r.label, lat: r.lat, lng: r.lng, ...(r.sampleId ? { sampleId: r.sampleId } : {}) })
              }
              title={`검색어: ${r.query}`}
            >
              <span className={styles.itemName}>{r.label}</span>
              {r.sampleId && <span className={styles.badge}>샘플</span>}
            </button>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={`최근 검색 '${r.label}' 삭제`}
              onClick={() => removeRecent(r.at)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
