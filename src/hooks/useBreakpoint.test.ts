import { describe, expect, it } from 'vitest';
import { resolveBreakpoint } from './useBreakpoint';

describe('resolveBreakpoint', () => {
  it.each([
    // [설명, tablet 이상, desktop 이상, 낮은 가로 화면, 기대값]
    ['375×812 휴대폰 세로', false, false, false, 'mobile'],
    ['768×1024 태블릿 세로', true, false, false, 'tablet'],
    ['1024×768 태블릿 가로', true, false, false, 'tablet'],
    ['1440×900 데스크톱', true, true, false, 'desktop'],
    ['812×375 휴대폰 가로', true, false, true, 'mobile'],
  ] as const)('%s → %s', (_label, tablet, desktop, short, expected) => {
    expect(resolveBreakpoint(tablet, desktop, short)).toBe(expected);
  });
});
