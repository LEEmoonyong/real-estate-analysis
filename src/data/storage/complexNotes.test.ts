import { describe, expect, it } from 'vitest';
import {
  MAX_RECENT_COMPLEXES,
  MEMO_MAX_LENGTH,
  addRecentComplex,
  isBudgetSetting,
  isMemoMap,
  isRecentComplexList,
  setMemo,
  type RecentComplex,
} from './complexNotes';

const r = (id: string, at = 1): RecentComplex => ({
  id,
  name: id,
  path: `/complex/geo-37.5,127.1/price?name=${id}`,
  at,
});

describe('최근 본 단지', () => {
  it('다시 보면 맨 앞으로, 같은 단지는 하나만', () => {
    const list = addRecentComplex([r('a'), r('b')], r('b', 2));
    expect(list.map((e) => e.id)).toEqual(['b', 'a']);
    expect(list[0]!.at).toBe(2);
  });

  it('최대 10곳', () => {
    let list: RecentComplex[] = [];
    for (let i = 0; i < 15; i++) list = addRecentComplex(list, r(`c${i}`));
    expect(list).toHaveLength(MAX_RECENT_COMPLEXES);
    expect(list[0]!.id).toBe('c14');
  });

  it('저장 형식 검증', () => {
    expect(isRecentComplexList([r('a')])).toBe(true);
    expect(isRecentComplexList([{ ...r('a'), path: 'javascript:alert(1)' }])).toBe(false);
  });
});

describe('단지 메모', () => {
  it('넣기 · 고치기 · 빈 글이면 지우기', () => {
    const a = setMemo({}, 'x', '  주차 좁음 ', 10);
    expect(a).toEqual({ x: { text: '주차 좁음', at: 10 } });
    expect(setMemo(a, 'x', '   ', 20)).toEqual({});
    expect(a.x).toBeDefined(); // 원본은 그대로
    expect(isMemoMap(a)).toBe(true);
  });

  it('길이 제한', () => {
    expect(setMemo({}, 'x', '가'.repeat(500), 1).x!.text).toHaveLength(MEMO_MAX_LENGTH);
  });
});

describe('예산 입력 검증', () => {
  it('음수·빠진 값은 거부', () => {
    expect(isBudgetSetting({ ownFunds: 1, annualIncome: 2, on: true })).toBe(true);
    expect(isBudgetSetting({ ownFunds: -1, annualIncome: 2, on: true })).toBe(false);
    expect(isBudgetSetting({ ownFunds: 1, annualIncome: 2 })).toBe(false);
  });
});
