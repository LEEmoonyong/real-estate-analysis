// [요구사항: Hooks] 커스텀 훅 — 전역 키보드 단축키 (PLAN.md 7장 useKeyboardShortcuts)
// [요구사항: 이벤트 처리] window keydown 등록·해제(useEffect), 최신 핸들러는 useRef로 유지(매 렌더 재등록 방지)
// 입력창·텍스트 영역에 포커스가 있거나 대화상자가 열려 있으면 무시한다.
import { useEffect, useRef } from 'react';

export type ShortcutMap = Record<string, (event: KeyboardEvent) => void>;

/**
 * 키 이름 규칙: 'Space', 'ArrowLeft', 'shift+ArrowLeft', 'Escape', 'f', '1', '/', '?'
 * - 글자·기호는 event.key 그대로(영문은 소문자) — '?'처럼 Shift가 필요한 기호도 'shift+' 없이 쓴다.
 * - 화살표·Space 등 이름 있는 키만 'shift+' 접두사로 구분한다.
 */
export function shortcutKey(event: Pick<KeyboardEvent, 'key' | 'shiftKey'>): string {
  const { key } = event;
  if (key === ' ') return event.shiftKey ? 'shift+Space' : 'Space';
  if (key.length === 1) return key.toLowerCase();
  return event.shiftKey ? `shift+${key}` : key;
}

/** 단축키를 무시해야 하는 대상 (글자 입력 중) — DOM 없이 테스트할 수 있게 필요한 속성만 받는다 */
export function isTypingTarget(
  target: { tagName?: string; type?: string; isContentEditable?: boolean } | null | undefined,
): boolean {
  if (!target || typeof target.tagName !== 'string') return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName.toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    // 체크박스·라디오·슬라이더·버튼형 입력에서는 단축키를 허용
    return !['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'color'].includes(target.type ?? 'text');
  }
  return false;
}

export function useKeyboardShortcuts(map: ShortcutMap, enabled = true): void {
  const mapRef = useRef(map);
  mapRef.current = map;

  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target as HTMLElement | null)) return;
      // 모달(dialog, 포털 오버레이)이 열려 있으면 전역 단축키를 쉬게 한다
      if (document.querySelector('dialog[open], [aria-modal="true"]')) return;
      const target = event.target as HTMLElement | null;
      // 슬라이더에서 화살표는 슬라이더가 처리, 버튼에서 Space는 버튼 클릭이 처리
      if (target instanceof HTMLInputElement && target.type === 'range' && event.key.startsWith('Arrow')) return;
      if (event.key === ' ' && target instanceof HTMLButtonElement) return;
      const handler = mapRef.current[shortcutKey(event)];
      if (!handler) return;
      event.preventDefault();
      handler(event);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
}
