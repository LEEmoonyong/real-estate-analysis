import { describe, expect, it } from 'vitest';
import { areaBandOf, classOf, formatArea, formatManwon, formatManwonShort, perPyeong, quantileBreaks } from './format';

describe('금액·면적 표기', () => {
  it('만원 → 억·만', () => {
    expect(formatManwon(320000)).toBe('32억');
    expect(formatManwon(32000)).toBe('3억 2,000만');
    expect(formatManwon(9500)).toBe('9,500만');
    expect(formatManwon(41350)).toBe('4억 1,000만');
    expect(formatManwon(19990)).toBe('2억'); // 반올림해 1억 10,000만이 되지 않게
  });

  it('짧은 표기', () => {
    expect(formatManwonShort(320000)).toBe('32억');
    expect(formatManwonShort(32500)).toBe('3.3억');
    expect(formatManwonShort(9500)).toBe('9500만');
  });

  it('면적·평당가', () => {
    expect(formatArea(84.8)).toBe('85㎡ (26평)');
    expect(Math.round(perPyeong(3998.7))).toBe(13219);
  });
});

describe('등급·평형대', () => {
  it('분위수 경계와 등급', () => {
    const b = quantileBreaks([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5);
    expect(b).toEqual([3, 5, 7, 9]);
    expect(classOf(1, b)).toBe(0);
    expect(classOf(5, b)).toBe(2);
    expect(classOf(10, b)).toBe(4);
    expect(quantileBreaks([])).toEqual([]);
  });

  it('평형대: 경계값은 아래 구간', () => {
    expect(areaBandOf(59.9)).toBe('small');
    expect(areaBandOf(60)).toBe('small');
    expect(areaBandOf(84.99)).toBe('mid');
    expect(areaBandOf(85)).toBe('mid');
    expect(areaBandOf(114)).toBe('large');
    expect(areaBandOf(200)).toBe('xl');
  });
});
