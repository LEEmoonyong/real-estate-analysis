import { describe, expect, it } from 'vitest';
import {
  activeTypes,
  dealAmountText,
  filterValue,
  kindsFor,
  markerText,
  normalizeQuery,
  roomApplies,
  toggleType,
} from './property';

describe('주택 유형·거래 종류', () => {
  it('상가는 매매만, 원룸·투룸은 오피스텔·빌라·단독만', () => {
    expect(kindsFor('nrg')).toEqual(['trade']);
    expect(kindsFor('offi')).toEqual(['trade', 'jeonse', 'wolse']);
    expect([roomApplies('apt'), roomApplies('offi'), roomApplies('rh'), roomApplies('sh'), roomApplies('nrg')]).toEqual(
      [false, true, true, true, false],
    );
  });

  it('여러 유형을 고를 때 맞지 않는 선택을 되돌린다', () => {
    // 상가만 고르고 월세 → 매매, 원룸은 의미 없음
    expect(normalizeQuery({ types: ['nrg'], kind: 'wolse', room: 'one' })).toEqual({
      types: ['nrg'],
      kind: 'trade',
      room: 'all',
    });
    // 빌라가 있으면 월세·원룸 유지, 순서는 정해진 순서로
    expect(normalizeQuery({ types: ['nrg', 'rh'], kind: 'wolse', room: 'one' })).toEqual({
      types: ['rh', 'nrg'],
      kind: 'wolse',
      room: 'one',
    });
    // 하나도 안 고르면 아파트
    expect(normalizeQuery({ types: [], kind: 'trade', room: 'all' }).types).toEqual(['apt']);
  });

  it('월세면 상가는 불러오지 않고, 마지막 유형은 끌 수 없다', () => {
    const q = { types: ['apt', 'nrg'] as const, kind: 'wolse', room: 'all' } as const;
    expect(activeTypes({ ...q, types: [...q.types] })).toEqual(['apt']);
    const one = { types: ['apt' as const], kind: 'trade' as const, room: 'all' as const };
    expect(toggleType(one, 'apt')).toBe(one);
    expect(toggleType(one, 'offi').types).toEqual(['apt', 'offi']);
    expect(toggleType({ ...one, types: ['apt', 'offi'] }, 'apt').types).toEqual(['offi']);
  });

  it('표시 글자와 필터 값', () => {
    expect(markerText({ value: 1000, depositMedian: 0 }, 'trade').main).toBe('평당 3306만');
    expect(markerText({ value: 25000, depositMedian: 0 }, 'jeonse').main).toBe('전세 2.5억');
    expect(markerText({ value: 65, depositMedian: 1000 }, 'wolse')).toEqual({ main: '월 65만', sub: '보증 1000만' });
    expect(filterValue({ value: 65 }, 'wolse')).toBe(65);
    expect(Math.round(filterValue({ value: 1000 }, 'trade'))).toBe(3306);
  });

  it('거래 한 건 금액', () => {
    expect(dealAmountText({ price: 0, deposit: 1000, monthlyRent: 65 }, 'wolse')).toBe('1,000만 / 월 65만');
    expect(dealAmountText({ price: 0, deposit: 25000, monthlyRent: 0 }, 'jeonse')).toBe('전세 2억 5,000만');
  });
});
