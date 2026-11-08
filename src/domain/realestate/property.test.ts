import { describe, expect, it } from 'vitest';
import { dealAmountText, filterValue, kindsFor, markerText, normalizeQuery, roomApplies } from './property';

describe('주택 유형·거래 종류', () => {
  it('상가는 매매만, 원룸·투룸은 오피스텔·빌라·단독만', () => {
    expect(kindsFor('nrg')).toEqual(['trade']);
    expect(kindsFor('offi')).toEqual(['trade', 'jeonse', 'wolse']);
    expect([roomApplies('apt'), roomApplies('offi'), roomApplies('rh'), roomApplies('sh'), roomApplies('nrg')]).toEqual(
      [false, true, true, true, false],
    );
  });

  it('유형을 바꾸면 맞지 않는 선택을 되돌린다', () => {
    expect(normalizeQuery({ type: 'nrg', kind: 'wolse', room: 'one' })).toEqual({
      type: 'nrg',
      kind: 'trade',
      room: 'all',
    });
    expect(normalizeQuery({ type: 'rh', kind: 'wolse', room: 'one' })).toEqual({
      type: 'rh',
      kind: 'wolse',
      room: 'one',
    });
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
