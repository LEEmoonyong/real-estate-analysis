// 실제 샘플 데이터에 좌표 변환 + 외곽선 정리를 적용해 본다 (3일차 통합 확인)
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createProjection, projectRing } from '../geo/localProjection';
import { cleanFootprint } from './polygon';

interface Sample {
  id: string;
  center: { lat: number; lng: number };
  buildings: { id: string; footprint: [number, number][] }[];
}

const index = JSON.parse(readFileSync('public/samples/index.json', 'utf8')) as { file: string }[];
const samples = index.map((e) => JSON.parse(readFileSync(`public/samples/${e.file}`, 'utf8')) as Sample);

describe.each(samples.map((s) => [s.id, s] as const))('%s', (_id, sample) => {
  const projection = createProjection(sample.center);
  const results = sample.buildings.map((b) => cleanFootprint(projectRing(projection, b.footprint)));
  const kept = results.filter((r) => r !== null);

  it('외곽선의 90% 이상이 정리 후 남는다 (버려지는 것은 10m² 미만 소형 구조물)', () => {
    expect(kept.length / results.length).toBeGreaterThan(0.9);
  });

  it('남은 외곽선은 모두 CCW이고 자기교차 복구는 드물다 (< 2%)', () => {
    expect(kept.every((r) => r.area > 0)).toBe(true);
    expect(kept.filter((r) => r.repaired).length / kept.length).toBeLessThan(0.02);
  });

  it('모든 정점이 중심에서 600m 안에 있다 (좌표 변환 단위·축 확인)', () => {
    for (const r of kept) {
      for (let i = 0; i < r.ring.length; i += 2) {
        expect(Math.hypot(r.ring[i]!, r.ring[i + 1]!)).toBeLessThan(600);
      }
    }
  });
});
