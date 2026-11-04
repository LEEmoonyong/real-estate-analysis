// 커밋된 샘플 파일이 스키마를 만족하는지 검증 — API 키 없이도 채점자가 모든 기능을 쓸 수 있어야 하므로 필수
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isSampleFile, isSampleIndex, type SampleFile } from './sampleSchema';

const read = (file: string): unknown => JSON.parse(readFileSync(`public/samples/${file}`, 'utf8'));

const index = read('index.json');

describe('public/samples', () => {
  it('index.json 형식이 올바르고 샘플이 3개 있다', () => {
    expect(isSampleIndex(index)).toBe(true);
    expect((index as unknown[]).length).toBe(3);
  });

  const entries = isSampleIndex(index) ? index : [];

  it.each(entries.map((e) => [e.id, e.file]))('%s 샘플이 스키마를 만족한다', (_id, file) => {
    const sample = read(file);
    expect(isSampleFile(sample)).toBe(true);
  });

  it.each(entries.map((e) => [e.id, e.file]))('%s: 건물 ID 중복 없음, 동 번호가 지정된 아파트가 있음', (_id, file) => {
    const sample = read(file) as SampleFile;
    const ids = sample.buildings.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(sample.buildings.some((b) => b.usage === 'apartments' && b.dongNumber)).toBe(true);
  });

  it.each(entries.map((e) => [e.id, e.file]))('%s: 모든 건물이 중심에서 반경 600m 안에 있다', (_id, file) => {
    const sample = read(file) as SampleFile;
    const { lat, lng } = sample.center;
    for (const b of sample.buildings) {
      const [x, y] = b.footprint[0]!;
      const dx = (x - lng) * 111_320 * Math.cos((lat * Math.PI) / 180);
      const dy = (y - lat) * 111_320;
      expect(Math.hypot(dx, dy)).toBeLessThan(600);
    }
  });

  it('잘못된 샘플은 거부한다', () => {
    expect(isSampleFile({})).toBe(false);
    const good = read(entries[0]!.file) as SampleFile;
    expect(isSampleFile({ ...good, buildings: [] })).toBe(false);
    expect(isSampleFile({ ...good, buildings: [{ ...good.buildings[0], floors: 0 }] })).toBe(false);
  });
});
