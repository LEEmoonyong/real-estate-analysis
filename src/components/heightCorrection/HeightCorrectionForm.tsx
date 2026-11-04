// [요구사항: 컴포넌트] 건물 지상층수 수동 보정 (PLAN.md 단계 B4)
// [요구사항: 상태관리] useState — 입력값 floorsInput, 오류 formError
// [요구사항: 이벤트 처리] onSubmit(보정), onClick(원래 값으로), onChange(입력)
// [요구사항: 데이터 처리] 보정값은 localStorage에 저장 → 새로 고침 후에도 유지 (SceneDataContext의 corrections)
// 보정하면 건물 높이·세대가 다시 만들어지고 장면 해시가 바뀌어 일조를 다시 계산한다.
// 되돌리면 해시가 원래 값으로 돌아가 이전 계산 결과(캐시)를 바로 다시 쓴다.
import { useId, useState, type FormEvent } from 'react';
import { useSceneDataActions } from '../../contexts/SceneDataContext';
import type { Building } from '../../domain/types';
import { MAX_FLOORS, MIN_FLOORS, parseFloorsInput } from './floorsInput';
import styles from './HeightCorrection.module.css';

const SOURCE_TEXT = {
  measured: '실측 높이',
  floors: '데이터의 층수',
  default: '추정값(층수 정보 없음)',
} as const;

export function HeightCorrectionForm({ building }: { building: Building }) {
  const { correctFloors, resetFloors } = useSceneDataActions();
  const [floorsInput, setFloorsInput] = useState(String(building.floors));
  const [formError, setFormError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = useId();

  // 다른 건물을 고르거나 보정값이 바뀌면 입력을 현재 값으로 맞춘다 (렌더 중 이전 값과 비교)
  const syncKey = `${building.id}:${building.floors}`;
  const [seenKey, setSeenKey] = useState(syncKey);
  if (seenKey !== syncKey) {
    setSeenKey(syncKey);
    setFloorsInput(String(building.floors));
    setFormError(null);
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const floors = parseFloorsInput(floorsInput);
    if (floors === null) {
      setFormError(`지상층수는 ${MIN_FLOORS}~${MAX_FLOORS} 사이의 정수로 입력하세요.`);
      return;
    }
    // 원래 값과 같으면 보정을 지운다 (같은 캐시 키로 돌아가도록)
    if (floors === building.originalFloors) resetFloors(building.id);
    else correctFloors(building.id, floors);
  };

  const handleReset = () => resetFloors(building.id);

  const dirty = floorsInput.trim() !== String(building.floors);

  return (
    <form className={styles.root} onSubmit={handleSubmit} noValidate aria-label="지상층수 보정">
      <p className={styles.title}>지상층수 보정</p>
      <p className={styles.muted}>
        원본 {building.originalFloors}층 ({SOURCE_TEXT[building.originalHeightSource]})
        {building.isUserCorrected && ` → 현재 ${building.floors}층 (보정됨)`}
      </p>
      <div className={styles.row}>
        <label htmlFor={inputId} className={styles.srOnly}>
          지상층수
        </label>
        <input
          id={inputId}
          className={styles.input}
          type="number"
          inputMode="numeric"
          min={MIN_FLOORS}
          max={MAX_FLOORS}
          step={1}
          value={floorsInput}
          aria-invalid={formError !== null}
          aria-describedby={formError ? errorId : undefined}
          onChange={(e) => {
            setFloorsInput(e.target.value);
            setFormError(null);
          }}
        />
        <span>층</span>
        <button type="submit" className={styles.primary} disabled={!dirty}>
          적용
        </button>
        {building.isUserCorrected && (
          <button type="button" className={styles.secondary} onClick={handleReset}>
            원래 값으로
          </button>
        )}
      </div>
      {formError && (
        <p id={errorId} className={styles.error} role="alert">
          {formError}
        </p>
      )}
      {building.originalHeightSource === 'measured' && !building.isUserCorrected && (
        <p className={styles.muted}>보정하면 실측 높이 대신 층수 × 층고로 높이를 계산합니다.</p>
      )}
    </form>
  );
}
