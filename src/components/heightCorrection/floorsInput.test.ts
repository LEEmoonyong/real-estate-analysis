import { describe, expect, it } from 'vitest';
import { parseFloorsInput } from './floorsInput';

describe('parseFloorsInput (층수 보정 입력 검증)', () => {
  it('1~120 정수만 허용', () => {
    expect(parseFloorsInput('1')).toBe(1);
    expect(parseFloorsInput(' 35 ')).toBe(35);
    expect(parseFloorsInput('120')).toBe(120);
  });
  it.each(['', '0', '121', '12.5', '-3', '1e2', 'abc', '1000'])('%s → null', (s) => {
    expect(parseFloorsInput(s)).toBeNull();
  });
});
