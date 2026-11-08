// [요구사항: 컴포넌트] 지도 시세 선택 (확장 X8) — 주택 유형 · 거래 종류(매매·전세·월세) · 방 구조(원룸·투룸 추정)
// [요구사항: 이벤트 처리] onClick(칩 고르기) → 지도 표시를 그 조건으로 다시 불러온다
import {
  DEAL_KIND_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  ROOM_OPTIONS,
  kindsFor,
  normalizeQuery,
  roomApplies,
  type MarketQuery,
} from '../../domain/realestate/property';
import styles from './MarketControls.module.css';

export function MarketControls({ query, onChange }: { query: MarketQuery; onChange: (q: MarketQuery) => void }) {
  const set = (patch: Partial<MarketQuery>) => onChange(normalizeQuery({ ...query, ...patch }));
  const kinds = kindsFor(query.type);
  return (
    <div className={styles.root} aria-label="시세 표시 조건">
      <div className={styles.row} role="group" aria-label="주택 유형">
        {PROPERTY_TYPE_OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            className={styles.chip}
            aria-pressed={query.type === o.id}
            title={o.hint}
            onClick={() => set({ type: o.id })}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className={styles.row}>
        <span role="group" aria-label="거래 종류" className={styles.group}>
          {DEAL_KIND_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              className={styles.chip}
              aria-pressed={query.kind === o.id}
              disabled={!kinds.includes(o.id)}
              title={kinds.includes(o.id) ? undefined : '상가는 국토교통부 공개 자료에 매매만 있습니다'}
              onClick={() => set({ kind: o.id })}
            >
              {o.label}
            </button>
          ))}
        </span>
        {roomApplies(query.type) && (
          <span role="group" aria-label="방 구조 (면적으로 추정)" className={styles.group}>
            {ROOM_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                className={styles.chip}
                aria-pressed={query.room === o.id}
                title={o.hint}
                onClick={() => set({ room: o.id })}
              >
                {o.label}
              </button>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
