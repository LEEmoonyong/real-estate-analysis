// [요구사항: 컴포넌트] 건물 동 번호 지정 대화상자 (PLAN.md 단계 B1)
// [요구사항: 상태관리] useState — 입력값, 오류, 중복 경고 확인 여부
// [요구사항: 이벤트 처리] onClick(열기·해제), onSubmit(지정), onChange(입력), 대화상자 close(Esc)
// [요구사항: 데이터 처리] 지정한 동 번호는 localStorage에 저장된다 (SceneDataContext의 dongAssignments)
// 네이티브 <dialog>를 써서 포커스 가두기·Esc 닫기·배경 비활성화를 브라우저에 맡긴다.
import { useRef, useState, type FormEvent } from 'react';
import { useSceneData, useSceneDataActions } from '../../contexts/SceneDataContext';
import type { Building } from '../../domain/types';
import { parseDongInput } from '../../domain/units/parseDongHo';
import styles from './DongHo.module.css';

export function DongAssignDialog({ building }: { building: Building }) {
  const { buildings } = useSceneData();
  const { assignDong, unassignDong } = useSceneDataActions();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** 중복 경고를 보여 준 동 번호 — 같은 값으로 한 번 더 제출하면 지정한다 */
  const [confirmedDuplicate, setConfirmedDuplicate] = useState<string | null>(null);

  const handleOpen = () => {
    setInput(building.dongNumber ?? '');
    setError(null);
    setConfirmedDuplicate(null);
    dialogRef.current?.showModal();
  };

  const close = () => dialogRef.current?.close();

  const handleAssign = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const dong = parseDongInput(input);
    if (!dong) {
      setError('동 번호는 1~4자리 숫자 또는 영문 한 글자입니다. 예: 101, 101동, A');
      return;
    }
    const duplicates = buildings.filter((b) => b.id !== building.id && b.dongNumber === dong).length;
    if (duplicates > 0 && confirmedDuplicate !== dong) {
      setConfirmedDuplicate(dong);
      setError(
        `이미 ${dong}동인 건물이 ${duplicates}곳 있습니다. 다른 단지라면 그대로 지정해도 됩니다 — 검색할 때 후보를 고르게 됩니다. 계속하려면 한 번 더 '지정'을 누르세요.`,
      );
      return;
    }
    assignDong(building.id, dong);
    close();
  };

  return (
    <div className={styles.row}>
      <button type="button" className={styles.secondaryButton} onClick={handleOpen}>
        {building.dongNumber ? '동 번호 변경' : '동 번호 지정'}
      </button>
      {building.dongSource === 'user' && (
        <button type="button" className={styles.secondaryButton} onClick={() => unassignDong(building.id)}>
          지정 해제
        </button>
      )}

      <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={`dong-dialog-${building.id}`}>
        <form className={styles.dialogForm} onSubmit={handleAssign} noValidate>
          <h2 id={`dong-dialog-${building.id}`} className={styles.dialogTitle}>
            동 번호 지정
          </h2>
          <p className={styles.muted}>
            {building.dongSource === 'data'
              ? `데이터의 동 번호는 ${building.dongNumber}동입니다. 직접 지정하면 그 값이 우선합니다.`
              : '아파트 출입구나 지도에 적힌 동 번호를 입력하세요. 이 기기에 저장됩니다.'}
          </p>
          <label className={styles.row}>
            <input
              className={styles.numberInput}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={input}
              aria-invalid={error !== null && confirmedDuplicate === null}
              onChange={(e) => {
                setInput(e.target.value);
                setError(null);
                setConfirmedDuplicate(null);
              }}
              autoFocus
            />
            동
          </label>
          {error && (
            <p className={confirmedDuplicate ? styles.warning : styles.error} role="alert">
              {error}
            </p>
          )}
          <div className={styles.actions}>
            <button type="button" className={styles.secondaryButton} onClick={close}>
              취소
            </button>
            <button type="submit" className={styles.button}>
              지정
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
