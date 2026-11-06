import { describe, expect, it } from 'vitest';
import {
  groupSchools,
  groupStations,
  nearbySummary,
  schoolLevel,
  subwayLine,
  walkMinutes,
  type NearbyPlace,
} from './nearby';

const P = (name: string, category: string, distanceM: number): NearbyPlace => ({
  name,
  category,
  distanceM,
  lat: 37.5,
  lng: 127,
  address: '',
});

describe('주변 시설 정리', () => {
  it('도보 시간 (75m/분, 최소 1분)', () => {
    expect(walkMinutes(212)).toBe(3);
    expect(walkMinutes(10)).toBe(1);
    expect(walkMinutes(1500)).toBe(20);
  });

  it('학교급', () => {
    expect(schoolLevel(P('서울잠일초등학교', '교육,학습 > 학교 > 초등학교', 1))).toBe('elementary');
    expect(schoolLevel(P('신천중학교', '교육,학습 > 학교 > 중학교', 1))).toBe('middle');
    expect(schoolLevel(P('잠일고등학교', '교육,학습 > 학교 > 고등학교', 1))).toBe('high');
    expect(schoolLevel(P('한국체육대학교', '교육,학습 > 학교 > 대학교', 1))).toBe('other');
    const g = groupSchools([P('a초등학교', '초등학교', 1), P('b중학교', '중학교', 2)]);
    expect(g.elementary).toHaveLength(1);
    expect(g.high).toHaveLength(0);
  });

  it('지하철 노선·같은 역 묶기', () => {
    expect(subwayLine('교통,수송 > 지하철,전철 > 수도권9호선')).toBe('9호선');
    expect(subwayLine('교통,수송 > 지하철,전철 > 부산2호선')).toBe('부산 2호선');
    const st = groupStations([
      P('종합운동장역 9호선', '교통,수송 > 지하철,전철 > 수도권9호선', 402),
      P('종합운동장역 2호선', '교통,수송 > 지하철,전철 > 수도권2호선', 587),
      P('잠실새내역 2호선', '교통,수송 > 지하철,전철 > 수도권2호선', 677),
    ]);
    expect(st).toEqual([
      { station: '종합운동장역', lines: ['9호선', '2호선'], distanceM: 402 },
      { station: '잠실새내역', lines: ['2호선'], distanceM: 677 },
    ]);
  });

  it('점수표 요약', () => {
    expect(
      nearbySummary({
        school: [P('신천중학교', '중학교', 250), P('잠일초등학교', '초등학교', 212)],
        subway: [P('역', '수도권9호선', 402)],
        mart: [],
        hospital: [],
        kindergarten: [],
      }),
    ).toEqual({ elementaryM: 212, subwayM: 402 });
  });
});
