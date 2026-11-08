import { describe, expect, it } from 'vitest';
import { coveringSample, matchSamples, nearestSample } from './sampleClient';
import type { SampleIndexEntry } from './sampleSchema';

const entry = (id: string, name: string, lat: number, lng: number, aliases: string[]): SampleIndexEntry => ({
  id,
  name,
  center: { lat, lng },
  file: `${id}.json`,
  aliases,
  buildingCount: 1,
});

const INDEX = [
  entry('seoul', '서울 송파 잠실', 37.51, 127.08, ['잠실', '잠실엘스', '서울']),
  entry('busan', '부산 해운대 마린시티', 35.16, 129.15, ['마린시티', '해운대', '부산']),
  entry('sejong', '세종 한솔동 첫마을', 36.48, 127.26, ['세종', '첫마을']),
];

describe('matchSamples', () => {
  it.each([
    ['잠실', ['seoul']],
    ['잠실 엘스', ['seoul']],
    ['해운대 마린시티', ['busan']],
    ['세종시 첫마을 아파트', ['sejong']], // 별칭("세종")이 검색어 안에 들어 있음
    ['첫마을', ['sejong']],
    ['강남', []],
    ['  ', []],
  ])('%o → %o', (q, ids) => {
    expect(matchSamples(INDEX, q).map((e) => e.id)).toEqual(ids);
  });

  it('별칭이 검색어 안에 들어 있으면 매칭', () => {
    expect(matchSamples(INDEX, '부산광역시').map((e) => e.id)).toEqual(['busan']);
  });
});

describe('nearestSample', () => {
  it('대전 → 세종이 가장 가깝다', () => {
    expect(nearestSample(INDEX, { lat: 36.35, lng: 127.38 })?.id).toBe('sejong');
  });
  it('울산 → 부산', () => {
    expect(nearestSample(INDEX, { lat: 35.54, lng: 129.31 })?.id).toBe('busan');
  });
});

describe('coveringSample', () => {
  it('샘플 중심 1.5km 안이면 그 샘플, 멀면 없음 (엉뚱한 단지로 대신하지 않는다)', () => {
    const s = INDEX[0]!;
    expect(coveringSample(INDEX, { lat: s.center.lat + 0.005, lng: s.center.lng })?.id).toBe(s.id); // 약 560m
    expect(coveringSample(INDEX, { lat: s.center.lat + 0.03, lng: s.center.lng })).toBeUndefined(); // 약 3.3km
  });
});
