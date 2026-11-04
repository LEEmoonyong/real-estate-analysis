// [요구사항: 컴포넌트] 동·호수로 세대 찾기 (PLAN.md 단계 B1)
// [요구사항: 상태관리] useState — 입력값, 결과 메시지, 같은 동 번호 후보
// [요구사항: 이벤트 처리] onChange(입력), onSubmit(찾기), onClick(후보 선택)
import { useId, useState, type FormEvent } from 'react';
import { useSceneData, useSceneDataActions } from '../../contexts/SceneDataContext';
import { lookupMessage } from '../../domain/units/unitLookup';
import { useUnitLookup, type CandidateInfo, type UnitLookupResult } from './useUnitLookup';
import styles from './DongHo.module.css';

type Feedback = { kind: 'success' | 'error'; text: string } | null;

export function DongHoSearch() {
  const { buildings } = useSceneData();
  const { focusOn } = useSceneDataActions();
  const { lookup, dongCount } = useUnitLookup();
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [candidates, setCandidates] = useState<CandidateInfo[]>([]);
  const hintId = useId();

  const apply = (result: UnitLookupResult) => {
    if (result.ok) {
      focusOn(result.buildingId, result.unitId);
      setCandidates([]);
      setFeedback({ kind: 'success', text: `${result.label}${result.unitId ? '' : ' 건물'}로 이동했습니다.` });
      return;
    }
    setCandidates(result.reason === 'AMBIGUOUS' ? (result.candidateInfo ?? []) : []);
    setFeedback({ kind: 'error', text: lookupMessage(result) });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    apply(lookup(input));
  };

  const handlePickCandidate = (candidate: CandidateInfo) => apply(lookup(input, candidate.buildingId));

  if (buildings.length === 0) return <p className={styles.muted}>지역을 불러오면 동·호수로 세대를 찾을 수 있습니다.</p>;

  return (
    <div className={styles.root}>
      <form className={styles.form} onSubmit={handleSubmit} role="search" aria-label="동·호수로 세대 찾기">
        <input
          className={styles.input}
          type="text"
          inputMode="text"
          autoComplete="off"
          enterKeyHint="search"
          placeholder="예: 101동 1203호"
          aria-label="동·호수"
          aria-describedby={hintId}
          aria-invalid={feedback?.kind === 'error'}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (feedback?.kind === 'error') setFeedback(null);
          }}
        />
        <button type="submit" className={styles.button}>
          찾기
        </button>
      </form>

      {feedback ? (
        <p
          className={feedback.kind === 'error' ? styles.error : styles.success}
          role={feedback.kind === 'error' ? 'alert' : 'status'}
        >
          {feedback.text}
        </p>
      ) : (
        <p id={hintId} className={styles.muted}>
          {dongCount > 0
            ? `동 번호가 있는 건물 ${dongCount}곳. 호수는 추정값(층 + 왼쪽부터 라인 번호)입니다.`
            : '이 지역 데이터에는 동 번호가 없습니다. 건물을 클릭해 동 번호를 지정하세요.'}
        </p>
      )}

      {candidates.length > 0 && (
        <ul className={styles.candidates} aria-label="같은 동 번호 건물">
          {candidates.map((c) => (
            <li key={c.buildingId}>
              <button type="button" className={styles.candidate} onClick={() => handlePickCandidate(c)}>
                {c.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
