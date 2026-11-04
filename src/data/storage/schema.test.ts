import { describe, expect, it } from 'vitest';
import { isArrayOf, parseStored, serializeStored } from './schema';

const isNumberArray = isArrayOf((x: unknown): x is number => typeof x === 'number');

describe('parseStored', () => {
  it('저장 → 읽기 왕복', () => {
    const raw = serializeStored([1, 2, 3], 1);
    expect(parseStored(raw, 1, isNumberArray)).toEqual({ ok: true, value: [1, 2, 3] });
  });

  it('값이 없으면 missing', () => {
    expect(parseStored(null, 1, isNumberArray)).toEqual({ ok: false, reason: 'missing' });
  });

  it('JSON이 깨졌거나 봉투 형식이 아니면 corrupt', () => {
    expect(parseStored('{oops', 1, isNumberArray)).toEqual({ ok: false, reason: 'corrupt' });
    expect(parseStored('[1,2]', 1, isNumberArray)).toEqual({ ok: false, reason: 'corrupt' });
    expect(parseStored(serializeStored(['a'], 1), 1, isNumberArray)).toEqual({ ok: false, reason: 'corrupt' });
  });

  it('미래 버전은 사용하지 않는다', () => {
    expect(parseStored(serializeStored([1], 3), 2, isNumberArray)).toEqual({ ok: false, reason: 'unknown-version' });
  });

  it('구버전은 migrate로 변환한다', () => {
    // v1: 쉼표 문자열 → v2: 숫자 배열
    const raw = serializeStored('1,2', 1);
    const migrate = (old: unknown) => String(old).split(',').map(Number);
    expect(parseStored(raw, 2, isNumberArray, migrate)).toEqual({ ok: true, value: [1, 2] });
  });
});
