import { describe, expect, it } from 'vitest';
import { isTypingTarget, shortcutKey } from './useKeyboardShortcuts';

describe('shortcutKey', () => {
  it('글자·기호는 소문자 그대로, 이름 있는 키만 shift 구분', () => {
    expect(shortcutKey({ key: ' ', shiftKey: false })).toBe('Space');
    expect(shortcutKey({ key: 'ArrowLeft', shiftKey: true })).toBe('shift+ArrowLeft');
    expect(shortcutKey({ key: 'ArrowRight', shiftKey: false })).toBe('ArrowRight');
    expect(shortcutKey({ key: 'F', shiftKey: true })).toBe('f');
    expect(shortcutKey({ key: '?', shiftKey: true })).toBe('?');
    expect(shortcutKey({ key: 'Escape', shiftKey: false })).toBe('Escape');
  });
});

describe('isTypingTarget', () => {
  it('글자 입력 요소에서는 단축키를 무시', () => {
    expect(isTypingTarget({ tagName: 'INPUT', type: 'text' })).toBe(true);
    expect(isTypingTarget({ tagName: 'INPUT', type: 'search' })).toBe(true);
    expect(isTypingTarget({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });
  it('체크박스·슬라이더·버튼에서는 허용', () => {
    expect(isTypingTarget({ tagName: 'INPUT', type: 'checkbox' })).toBe(false);
    expect(isTypingTarget({ tagName: 'INPUT', type: 'range' })).toBe(false);
    expect(isTypingTarget({ tagName: 'BUTTON' })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
