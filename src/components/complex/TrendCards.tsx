// [요구사항: 컴포넌트] 시세 탭의 해석 카드 2 — 가격 변화 요약(1년 전·최고가·거래량), 층별 가격, 내 메모
// [요구사항: 상태관리] useState(메모 입력 중인 글) + useLocalStorage(저장된 메모 — 새로 고침 후에도 유지)
// [요구사항: 이벤트 처리] onChange(메모 입력), onBlur(저장), onClick(지우기)
import { useState } from 'react';
import { MEMO_MAX_LENGTH, setMemo } from '../../data/storage/complexNotes';
import { perPyeong } from '../../domain/realestate/format';
import { changeText, type FloorAnalysis, type PriceChange } from '../../domain/realestate/trend';
import { useMemos } from '../../hooks/useComplexMemo';
import styles from './Complex.module.css';

const sign = (v: number) => (Math.round(v * 100) === 0 ? 'same' : v > 0 ? 'up' : 'down');

/** 가격 변화 요약 — 그래프를 읽지 않아도 되게 세 줄로 */
export function ChangeSummary({ change }: { change: PriceChange }) {
  if (change.now === null && change.volumeNow === 0 && change.volumePrev === 0) return null;
  return (
    <ul className={styles.changeList} aria-label="가격 변화 요약">
      <li>
        <span>1년 전 대비</span>
        {change.yoy === null ? (
          <strong className={styles.changeNone}>비교할 거래 없음</strong>
        ) : (
          <strong data-sign={sign(change.yoy)}>{changeText(change.yoy)}</strong>
        )}
      </li>
      <li>
        <span>최근 12달 최고가 대비{change.peak && ` (${change.peak.month.slice(2).replace('-', '.')})`}</span>
        {change.fromPeak === null ? (
          <strong className={styles.changeNone}>—</strong>
        ) : change.fromPeak >= -0.005 ? (
          <strong data-sign="up">최고 수준</strong>
        ) : (
          <strong data-sign="down">{changeText(change.fromPeak)}</strong>
        )}
      </li>
      <li>
        <span>
          거래량 (최근 3달 {change.volumeNow}건 ← 앞 3달 {change.volumePrev}건)
        </span>
        {change.volumeChange === null ? (
          <strong className={styles.changeNone}>{change.volumeNow > 0 ? '새로 거래됨' : '—'}</strong>
        ) : (
          <strong data-sign={sign(change.volumeChange)}>{changeText(change.volumeChange)}</strong>
        )}
      </li>
    </ul>
  );
}

/** 층별 가격 — 저층·중층·고층 평당가 막대 */
export function FloorCard({ floors }: { floors: FloorAnalysis }) {
  const max = Math.max(...floors.bands.map((b) => b.perM2 ?? 0));
  return (
    <section className={styles.card} aria-label="층별 가격">
      <h2 className={styles.cardTitle}>
        층별 가격{' '}
        {floors.highVsLow !== null && (
          <small className={styles.muted}>
            고층이 저층보다{' '}
            {Math.abs(floors.highVsLow) < 0.01
              ? '거의 같음'
              : `${Math.round(Math.abs(floors.highVsLow) * 100)}% ${floors.highVsLow > 0 ? '비쌈' : '저렴'}`}
          </small>
        )}
      </h2>
      <ul className={styles.compareBars}>
        {[...floors.bands].reverse().map((b) => (
          <li key={b.id}>
            <span className={styles.compareLabel}>
              {b.label}{' '}
              <small>
                ({b.from}~{b.to}층 · {b.count}건)
              </small>
            </span>
            <span className={styles.compareTrack}>
              <i
                className={b.id === 'high' ? styles.compareBarSelf : undefined}
                style={{ width: `${b.perM2 && max ? Math.max(4, (b.perM2 / max) * 100) : 0}%` }}
              />
            </span>
            <strong>
              {b.perM2 ? `평당 ${Math.round(perPyeong(b.perM2)).toLocaleString('ko-KR')}만` : '거래 없음'}
            </strong>
          </li>
        ))}
      </ul>
      <p className={styles.muted}>
        최근 12달 매매를 거래에 나온 최고층({floors.top}층) 기준으로 3등분해 전용 ㎡당 중앙값을 비교했습니다. 층마다
        해가 드는 시간은 일조·조망 탭의 층별 비교에서 볼 수 있습니다.
      </p>
    </section>
  );
}

/** 내 메모 (시세 탭) — 입력 칸을 벗어나면 저장 */
export function MemoBox({ id, name }: { id: string; name: string }) {
  const [memos, setMemos] = useMemos();
  return (
    <MemoEditor
      id={id}
      name={name}
      saved={memos[id]?.text ?? ''}
      onSave={(text) => setMemos((prev) => setMemo(prev, id, text, Date.now()))}
    />
  );
}

interface MemoEditorProps {
  id: string;
  name: string;
  /** 저장된 글 */
  saved: string;
  /** 고친 글 저장 ('' = 지우기) */
  onSave: (text: string) => void;
  /** 단지 비교 표 칸처럼 좁은 곳: 제목 줄 없이 입력 칸만 */
  compact?: boolean;
}

/**
 * 메모 입력 칸. 저장소는 부르는 쪽이 쥔다 — 단지 비교 화면은 열 여러 개가 한 저장소를 같이 써야
 * 한 열에서 저장할 때 다른 열의 메모를 덮어쓰지 않는다.
 */
export function MemoEditor({ id, name, saved, onSave, compact = false }: MemoEditorProps) {
  // 입력 중인 글 (null = 저장된 글 그대로)
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? saved;
  const save = () => {
    if (draft === null) return;
    if (draft.trim() !== saved) onSave(draft);
    setDraft(null);
  };
  return (
    <div className={`${styles.memo} ${compact ? styles.memoCompact : ''}`}>
      {!compact && (
        <label className={styles.memoLabel} htmlFor={`memo-${id}`}>
          내 메모 {saved && draft === null && <small className={styles.muted}>저장됨</small>}
        </label>
      )}
      <textarea
        id={`memo-${id}`}
        className={styles.memoInput}
        rows={compact ? 3 : 2}
        maxLength={MEMO_MAX_LENGTH}
        aria-label={compact ? `${name} 메모` : undefined}
        placeholder={
          compact
            ? '메모를 적어 두세요 (이 기기에만 저장)'
            : `${name}에 대해 적어 두세요 (예: 임장 다녀옴, 주차 좁음). 이 기기에만 저장됩니다.`
        }
        value={value}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
      />
      {saved && (
        <button
          type="button"
          className={styles.memoClear}
          onClick={() => {
            onSave('');
            setDraft(null);
          }}
        >
          {compact ? '지우기' : '메모 지우기'}
          {compact && draft === null && <span className={styles.muted}> · 저장됨</span>}
        </button>
      )}
    </div>
  );
}
