// [요구사항: 데이터 처리] 로컬 샘플 데이터 — API 키 없이 바로 체험할 수 있는 지역 버튼
// [요구사항: Hooks] useEffect로 샘플 목록(public/samples/index.json) 로드
import { useEffect, useState } from 'react';
import { loadSampleIndex } from '../../data/samples/sampleClient';
import type { SampleIndexEntry } from '../../data/samples/sampleSchema';
import styles from './SampleChips.module.css';

interface SampleChipsProps {
  activeId: string | null;
  onPick: (sample: SampleIndexEntry) => void;
}

export function SampleChips({ activeId, onPick }: SampleChipsProps) {
  const [samples, setSamples] = useState<SampleIndexEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadSampleIndex()
      .then((index) => !cancelled && setSamples(index))
      .catch(() => !cancelled && setSamples([]));
    return () => {
      cancelled = true;
    };
  }, []);

  if (samples.length === 0) return null;

  return (
    <div className={styles.root} role="group" aria-label="샘플 지역">
      <span className={styles.label}>샘플 지역</span>
      {samples.map((s) => (
        <button
          key={s.id}
          type="button"
          className={styles.chip}
          aria-pressed={activeId === s.id}
          onClick={() => onPick(s)}
          title={s.name}
        >
          {s.name.split(' (')[0]}
        </button>
      ))}
    </div>
  );
}
