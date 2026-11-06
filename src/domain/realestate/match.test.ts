import { describe, expect, it } from 'vitest';
import {
  bigramSimilarity,
  canonicalName,
  jibunFromAddress,
  matchComplex,
  nameScore,
  normalizeJibun,
  type ComplexRef,
} from './match';

// 2026-11 송파구 실제 이름 쌍 (실거래 이름 ↔ 단지 목록 이름)
const C = (kaptCode: string, name: string, dong: string, jibun = ''): ComplexRef => ({
  kaptCode,
  name,
  dong,
  jibun,
  sigungu: '송파구',
});
const complexes = [
  C('A1', '잠실리센츠', '잠실동'),
  C('A2', '잠실동트리지움', '잠실동'),
  C('A3', '가락래미안파크팰리스', '가락동'),
  C('A4', '가락한신', '가락동'),
  C('A5', '가락현대5차', '가락동'),
  C('A6', '장미3차', '신천동'),
  C('A7', '잠실엘스아파트', '잠실동', '19'),
  C('A8', '잠실주공5단지', '잠실동'),
];
const T = (aptName: string, umdName: string, jibun = '') => ({ aptName, umdName, jibun });

describe('이름 정규화', () => {
  it('지역 접두어·아파트·괄호·차/단지 표기', () => {
    expect(canonicalName('잠실리센츠', ['잠실동', '송파구'])).toBe('리센츠');
    expect(canonicalName('주공아파트 5단지', ['잠실동'])).toBe('주공5');
    expect(canonicalName('현대(6차)', [])).toBe('현대6');
    expect(canonicalName('그랑밸리(119-27)', [])).toBe('그랑밸리');
    expect(canonicalName('송파레이크파크호반써밋Ⅱ', ['거여동', '송파구'])).toBe('레이크파크호반써밋2');
  });

  it('지번 표기', () => {
    expect(normalizeJibun('0127-0001')).toBe('127-1');
    expect(normalizeJibun('19')).toBe('19');
    expect(normalizeJibun('19-0')).toBe('19');
    expect(jibunFromAddress('서울특별시 송파구 잠실동 187-10 잠실 센트럴파크', '잠실동')).toBe('187-10');
    expect(jibunFromAddress('주소', '잠실동')).toBe('');
  });

  it('2-gram 유사도', () => {
    expect(bigramSimilarity('리센츠', '리센츠')).toBe(1);
    expect(bigramSimilarity('abc', 'xyz')).toBe(0);
  });
});

describe('단지 매칭', () => {
  it('지번이 같으면 확정', () => {
    expect(matchComplex(T('엘스', '잠실동', '0019'), complexes)).toEqual({ kaptCode: 'A7', method: 'jibun', score: 1 });
  });

  it('지역 접두어가 붙은 이름', () => {
    expect(matchComplex(T('리센츠', '잠실동'), complexes)?.kaptCode).toBe('A1');
    expect(matchComplex(T('트리지움', '잠실동'), complexes)?.kaptCode).toBe('A2');
    expect(matchComplex(T('래미안파크팰리스', '가락동'), complexes)?.kaptCode).toBe('A3');
    expect(matchComplex(T('주공아파트 5단지', '잠실동'), complexes)?.kaptCode).toBe('A8');
    expect(matchComplex(T('장미3', '신천동'), complexes)?.kaptCode).toBe('A6');
  });

  it('숫자가 다르거나 길이 차이가 큰 포함 관계는 매칭하지 않는다', () => {
    expect(nameScore(T('현대(6차)', '가락동'), complexes[4]!)).toBe(0); // 6차 ≠ 5차
    expect(matchComplex(T('한신잠실코아', '가락동'), complexes)).toBeNull(); // 한신 ⊂ 한신잠실코아 — 다른 단지
    expect(matchComplex(T('장미1', '신천동'), complexes)).toBeNull(); // 장미1 ≠ 장미3차
  });

  it('없는 단지는 null', () => {
    expect(matchComplex(T('전혀다른빌라', '풍납동'), complexes)).toBeNull();
  });
});
