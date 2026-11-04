// 1일차 실측 응답(잠실·마린시티) 형식을 본뜬 픽스처로 V-World 정규화를 검증한다
import { describe, expect, it } from 'vitest';
import { normalizeVworld } from './vworld';

const square = (lng: number, lat: number, size = 0.0003) => [
  [lng, lat],
  [lng + size, lat],
  [lng + size, lat + size],
  [lng, lat + size],
  [lng, lat],
];

const feature = (id: string, props: Record<string, string>, coords = square(127.08, 37.51)) => ({
  type: 'Feature',
  id: `LT_C_BLDGINFO.${id}`,
  geometry: { type: 'MultiPolygon', coordinates: [[coords]] },
  properties: {
    bld_nm: '',
    dong_nm: '',
    usability: '',
    grnd_flr: '',
    ugrnd_flr: '',
    archarea: '',
    height: '',
    ...props,
  },
});

describe('normalizeVworld', () => {
  it('실측 형식의 공동주택 피처를 정규화한다', () => {
    const { buildings, report } = normalizeVworld([
      feature('11406229', { dong_nm: '101동', usability: '02000', grnd_flr: '30', height: '92.5' }),
    ]);
    expect(report).toMatchObject({ total: 1, kept: 1 });
    expect(buildings[0]).toMatchObject({
      id: 'vworld:11406229',
      source: 'vworld',
      floors: 30,
      heightM: 92.5,
      heightSource: 'measured',
      dongNumber: '101',
      usage: 'apartments',
      name: '101동',
    });
    expect(buildings[0]!.footprint).toHaveLength(4); // 닫힘 정점 제거
  });

  it('층수만 있으면 floors, 둘 다 없으면 면적으로 추정', () => {
    const { buildings } = normalizeVworld([
      feature('1', { grnd_flr: '5', height: '' }),
      feature('2', {}, square(127.08, 37.51, 0.00003)), // 약 9m² 소형 구조물
      feature('3', {}),
    ]);
    expect(buildings[0]).toMatchObject({ floors: 5, heightM: null, heightSource: 'floors' });
    expect(buildings[1]).toMatchObject({ floors: 1, heightSource: 'default' });
    expect(buildings[2]).toMatchObject({ floors: 5, heightSource: 'default' });
  });

  it('숫자가 아닌 동 이름은 동 번호로 쓰지 않고 이름으로만 남긴다', () => {
    const { buildings } = normalizeVworld([feature('1', { bld_nm: '마린시티자이', dong_nm: '주동3', grnd_flr: '40' })]);
    expect(buildings[0]!.dongNumber).toBeUndefined();
    expect(buildings[0]!.name).toBe('마린시티자이 주동3');
  });

  it('여러 조각이면 가장 큰 외곽선을 쓴다', () => {
    const f = feature('1', { grnd_flr: '3' });
    f.geometry.coordinates = [[square(127.08, 37.51, 0.0001)], [square(127.09, 37.51, 0.0005)]];
    const { buildings } = normalizeVworld([f]);
    expect(buildings[0]!.footprint[0]).toEqual([127.09, 37.51]);
  });

  it('지오메트리가 없거나 잘못된 피처는 제외한다', () => {
    const { buildings, report } = normalizeVworld([
      { type: 'Feature', id: 'x', geometry: null, properties: {} },
      { type: 'Feature', id: 'y', geometry: { type: 'Point', coordinates: [127, 37] }, properties: {} },
      'garbage',
    ]);
    expect(buildings).toHaveLength(0);
    expect(report.skippedInvalidGeometry).toBe(3);
  });
});
