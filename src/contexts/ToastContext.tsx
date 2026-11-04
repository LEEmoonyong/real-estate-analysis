// [요구사항: 상태관리] 공유 상태 — 화면 하단 알림(토스트) 목록 (useState)
// 저장 실패 경고, 즐겨찾기 삭제 "실행 취소" 등에 쓴다. 시간이 지나면 자동으로 닫힌다.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import styles from './Toast.module.css';

export interface ToastOptions {
  message: string;
  /** 버튼 (예: 실행 취소) */
  action?: { label: string; onClick: () => void };
  durationMs?: number;
  tone?: 'info' | 'warning';
}

interface Toast extends Required<Pick<ToastOptions, 'message' | 'durationMs' | 'tone'>> {
  id: number;
  action?: ToastOptions['action'];
}

interface ToastActions {
  showToast: (options: ToastOptions) => number;
  dismissToast: (id: number) => void;
}

const ToastContext = createContext<ToastActions | null>(null);

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  // [요구사항: Hooks] useEffect — 표시 시간이 지나면 닫기 (언마운트 시 타이머 정리)
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), toast.durationMs);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.durationMs, onDismiss]);

  return (
    <div className={styles.toast} data-tone={toast.tone} role={toast.tone === 'warning' ? 'alert' : 'status'}>
      <span className={styles.message}>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            toast.action!.onClick();
            onDismiss(toast.id);
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button type="button" className={styles.close} aria-label="알림 닫기" onClick={() => onDismiss(toast.id)}>
        ✕
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismissToast = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const showToast = useCallback((options: ToastOptions) => {
    const id = nextId.current++;
    const toast: Toast = {
      id,
      message: options.message,
      durationMs: options.durationMs ?? 5000,
      tone: options.tone ?? 'info',
      ...(options.action ? { action: options.action } : {}),
    };
    // 최대 3개 — 오래된 것부터 밀어낸다
    setToasts((list) => [...list.slice(-2), toast]);
    return id;
  }, []);

  const actions = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast]);

  return (
    <ToastContext.Provider value={actions}>
      {children}
      <div className={styles.viewport} aria-live="polite">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastActions {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast는 ToastProvider 안에서 사용해야 합니다.');
  return ctx;
}
