import { describe, expect, it } from 'vitest';
import { inCompare, isCompareList, toggleCompare, type CompareEntry } from './compare';

const e = (id: string): CompareEntry => ({ id, name: id, path: `/complex/geo-37.5,127.1/price?name=${id}` });

describe('단지 비교 목록', () => {
  it('담기·빼기', () => {
    const a = toggleCompare([], e('a'));
    expect(a.list.map((x) => x.id)).toEqual(['a']);
    expect(inCompare(a.list, 'a')).toBe(true);
    expect(toggleCompare(a.list, e('a')).list).toEqual([]);
  });

  it('3곳을 넘으면 가장 먼저 담은 곳이 빠짐', () => {
    let list: CompareEntry[] = [];
    for (const id of ['a', 'b', 'c']) list = toggleCompare(list, e(id)).list;
    const r = toggleCompare(list, e('d'));
    expect(r.list.map((x) => x.id)).toEqual(['b', 'c', 'd']);
    expect(r.dropped?.id).toBe('a');
  });

  it('저장 형식 검증 — 단지 주소가 아니면 거부', () => {
    expect(isCompareList([e('a')])).toBe(true);
    expect(isCompareList([{ ...e('a'), path: 'https://evil.example' }])).toBe(false);
  });
});
