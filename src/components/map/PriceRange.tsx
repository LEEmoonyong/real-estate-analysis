// [요구사항: 컴포넌트] 지역 조건 › 가격 범위 — 지금 불러온 곳의 가격 분포 막대 + 양쪽 손잡이 슬라이더 + 직접 입력
// [요구사항: 상태관리] useState — 끄는 동안의 임시 값 (멈추면 0.25초 뒤 지도에 반영해 표시를 매번 다시 그리지 않는다)
// [요구사항: 이벤트 처리] onChange(range·number) → 임시 값, onBlur/Enter(입력칸) → 바로 반영
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { histogram, priceBounds, priceStep } from '../../domain/realestate/mapResults';
import type { DealKind } from '../../domain/realestate/property';
import styles from './PriceRange.module.css';

interface PriceRangeProps {
  kind: DealKind;
  /** 분포를 그릴 값들 [만원] — 가격 외 조건을 통과한 곳 */
  values: readonly number[];
  min: number | null;
  max: number | null;
  onChange: (min: number | null, max: number | null) => void;
  /** 값[만원] → 글자 (평당 4,000만 / 전세 3억 / 월 50만) */
  format: (v: number) => string;
}

const BINS = 24;
const COMMIT_MS = 250;

export function PriceRange({ kind, values, min, max, onChange, format }: PriceRangeProps) {
  const step = priceStep(kind);
  const { lo, hi } = useMemo(() => {
    const b = priceBounds(values, kind);
    // 이미 정해 둔 값이 분포 밖이어도 손잡이가 보이게 넓힌다
    return { lo: Math.min(b.lo, min ?? b.lo), hi: Math.max(b.hi, max ?? b.hi) };
  }, [values, kind, min, max]);
  const bars = useMemo(() => histogram(values, lo, hi, BINS), [values, lo, hi]);
  const peak = Math.max(1, ...bars);

  // 끄는 동안의 값 (null = 바깥 값 그대로)
  const [draft, setDraft] = useState<{ min: number; max: number } | null>(null);
  const curMin = draft?.min ?? min ?? lo;
  const curMax = draft?.max ?? max ?? hi;

  /** 양 끝이면 "제한 없음"(null)으로 */
  const commit = (a: number, b: number) => {
    const nextMin = a <= lo ? null : a;
    const nextMax = b >= hi ? null : b;
    setDraft(null);
    if (nextMin !== min || nextMax !== max) onChange(nextMin, nextMax);
  };

  useEffect(() => {
    if (!draft) return;
    const t = window.setTimeout(() => commit(draft.min, draft.max), COMMIT_MS);
    return () => window.clearTimeout(t);
    // commit은 매 렌더 새로 만들어지지만 draft가 바뀔 때만 다시 예약하면 된다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const setMin = (v: number) => setDraft({ min: Math.min(v, curMax), max: curMax });
  const setMax = (v: number) => setDraft({ min: curMin, max: Math.max(v, curMin) });

  const pct = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const inRange = (i: number) => {
    const a = lo + ((hi - lo) * i) / BINS;
    const b = lo + ((hi - lo) * (i + 1)) / BINS;
    return b > curMin && a < curMax;
  };
  const shown = values.filter((v) => v >= curMin && v <= curMax).length;

  // 직접 입력: 칸에서 벗어나거나 Enter를 누르면 반영
  const typed = (raw: string, which: 'min' | 'max') => {
    const v = raw.trim() === '' ? (which === 'min' ? lo : hi) : Math.max(0, Math.round(Number(raw)));
    if (!Number.isFinite(v)) return;
    if (which === 'min') commit(Math.min(v, curMax), curMax);
    else commit(curMin, Math.max(v, curMin));
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>, which: 'min' | 'max') => {
    if (e.key === 'Enter') typed(e.currentTarget.value, which);
  };
  const unit = kind === 'trade' ? '만원/평' : '만원';

  return (
    <div className={styles.root}>
      <div className={styles.text} aria-live="polite">
        <strong>
          {min === null && max === null && !draft ? '전체 가격' : `${format(curMin)} ~ ${format(curMax)}`}
        </strong>
        <span>
          {shown}/{values.length}곳
        </span>
      </div>
      <div className={styles.chart} aria-hidden="true">
        {bars.map((n, i) => (
          <i
            key={i}
            className={inRange(i) ? styles.barOn : styles.bar}
            style={{ height: `${n === 0 ? 0 : Math.max(8, (n / peak) * 100)}%` }}
          />
        ))}
      </div>
      <div className={styles.slider}>
        <div className={styles.track} />
        <div className={styles.fill} style={{ left: `${pct(curMin)}%`, right: `${100 - pct(curMax)}%` }} />
        <input
          type="range"
          min={lo}
          max={hi}
          step={step}
          value={curMin}
          onChange={(e) => setMin(Number(e.target.value))}
          aria-label="가격 하한"
          aria-valuetext={format(curMin)}
        />
        <input
          type="range"
          min={lo}
          max={hi}
          step={step}
          value={curMax}
          onChange={(e) => setMax(Number(e.target.value))}
          aria-label="가격 상한"
          aria-valuetext={format(curMax)}
        />
      </div>
      <div className={styles.inputs}>
        <label>
          <input
            key={`min-${curMin}`}
            type="number"
            inputMode="numeric"
            min={0}
            step={step}
            defaultValue={min ?? ''}
            placeholder={String(lo)}
            onBlur={(e) => typed(e.target.value, 'min')}
            onKeyDown={(e) => onKey(e, 'min')}
            aria-label={`가격 하한 직접 입력 (${unit})`}
          />
        </label>
        <span aria-hidden="true">~</span>
        <label>
          <input
            key={`max-${curMax}`}
            type="number"
            inputMode="numeric"
            min={0}
            step={step}
            defaultValue={max ?? ''}
            placeholder={String(hi)}
            onBlur={(e) => typed(e.target.value, 'max')}
            onKeyDown={(e) => onKey(e, 'max')}
            aria-label={`가격 상한 직접 입력 (${unit})`}
          />
        </label>
        <span className={styles.unit}>{unit}</span>
      </div>
    </div>
  );
}
