// [요구사항: 컴포넌트] 공용 대화상자 — 네이티브 <dialog>(포커스 가두기·Esc·배경 비활성화를 브라우저가 처리)
// open prop으로 제어하고, Esc·닫기 버튼·배경 클릭으로 닫히면 onClose를 부른다.
import { useEffect, useId, useRef, type ReactNode } from 'react';
import styles from './Modal.module.css';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ open, title, onClose, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // [요구사항: Hooks] useEffect — open 상태를 DOM 대화상자에 반영
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      // 배경(::backdrop) 클릭 — 이벤트 대상이 dialog 자신이면 바깥을 누른 것
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.content}>
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button type="button" className={styles.close} aria-label="닫기" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
