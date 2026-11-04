import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_FLOOR_HEIGHT_M } from '../../config/constants';
import { createPrism, prismsFromBuildings, type Prism } from '../geometry/prism';
import { buildBuildings } from '../scene/buildBuildings';
import type { LatLng, RawBuilding } from '../types';
import { buildUniformGrid } from './uniformGrid';

/** 샘플 파일 중 테스트에 필요한 부분 (domain은 data 계층을 import하지 않는다) */
interface SampleFile {
  id: string;
  center: LatLng;
  buildings: RawBuilding[];
}
import { createRayCaster, isBlockedBruteForce } from './rayCast';

/** 재현 가능한 의사난수 (mulberry32) */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 임의 장면: 회전한 직사각형·볼록 다각형 건물 */
function randomScene(seed: number, count: number): Prism[] {
  const r = rng(seed);
  const prisms: Prism[] = [];
  for (let i = 0; i < count; i++) {
    const cx = (r() - 0.5) * 400;
    const cz = (r() - 0.5) * 400;
    const sides = 3 + Math.floor(r() * 6);
    const radius = 5 + r() * 30;
    const rot = r() * Math.PI * 2;
    const ring = new Float64Array(sides * 2);
    for (let k = 0; k < sides; k++) {
      const a = rot + (k / sides) * Math.PI * 2;
      ring[k * 2] = cx + Math.cos(a) * radius;
      ring[k * 2 + 1] = cz - Math.sin(a) * radius; // (x, 북=−z) 평면에서 CCW
    }
    prisms.push(createPrism(ring, 3 + r() * 120));
  }
  return prisms;
}

function randomRay(r: () => number, spread: number) {
  const alt = (1 + r() * 80) * (Math.PI / 180);
  const az = r() * Math.PI * 2;
  return {
    p: [(r() - 0.5) * spread, r() * 60, (r() - 0.5) * spread] as const,
    d: [Math.cos(alt) * Math.sin(az), Math.sin(alt), -Math.cos(alt) * Math.cos(az)] as const,
  };
}

describe('균일 그리드 + DDA == 전수 검사 (속성 테스트)', () => {
  it.each([
    [1, 7],
    [2, 20],
    [3, 55],
    [4, 400], // 셀 하나에 전부 들어가는 극단
  ])('장면 seed=%d, 셀 크기 %dm: 광선 2,000개 결과 일치', (seed, cellSize) => {
    const prisms = randomScene(seed, 120);
    const caster = createRayCaster(buildUniformGrid(prisms, cellSize));
    const r = rng(seed * 101);
    let blocked = 0;
    for (let i = 0; i < 2000; i++) {
      // 일부는 그리드 밖(±400m)에서 출발
      const { p, d } = randomRay(r, i % 4 === 0 ? 800 : 450);
      const expected = isBlockedBruteForce(prisms, ...p, ...d);
      expect(caster.isBlocked(...p, ...d), `ray #${i}`).toBe(expected);
      if (expected) blocked++;
    }
    // 테스트가 한쪽으로만 치우치지 않았는지 (막힘·트임이 모두 충분히 나와야 의미가 있다)
    expect(blocked).toBeGreaterThan(200);
    expect(blocked).toBeLessThan(1800);
  });

  it('건물이 없으면 항상 트임', () => {
    const caster = createRayCaster(buildUniformGrid([]));
    expect(caster.isBlocked(0, 0, 0, 0, 0.5, 0.866)).toBe(false);
  });

  it('같은 캐스터로 광선을 연속해서 쏴도(mailbox 재사용) 결과가 같다', () => {
    const prisms = randomScene(9, 60);
    const caster = createRayCaster(buildUniformGrid(prisms));
    const { p, d } = randomRay(rng(5), 300);
    const first = caster.isBlocked(...p, ...d);
    for (let i = 0; i < 50; i++) expect(caster.isBlocked(...p, ...d)).toBe(first);
  });
});

describe('실제 샘플 단지에서도 전수 검사와 일치', () => {
  const index = JSON.parse(readFileSync('public/samples/index.json', 'utf8')) as { file: string }[];
  const samples = index.map((e) => JSON.parse(readFileSync(`public/samples/${e.file}`, 'utf8')) as SampleFile);

  it.each(samples.map((s) => [s.id, s] as const))('%s: 광선 2,000개', (_id, sample) => {
    const { buildings } = buildBuildings(sample.buildings, sample.center, DEFAULT_FLOOR_HEIGHT_M, {
      floors: {},
      dongs: {},
    });
    const prisms = prismsFromBuildings(buildings);
    const caster = createRayCaster(buildUniformGrid(prisms));
    const r = rng(42);
    for (let i = 0; i < 2000; i++) {
      // 실제 계산처럼 건물 벽 근처 점: 임의 건물의 임의 변 중점에서 0.05m 바깥
      const b = prisms[Math.floor(r() * prisms.length)]!;
      const n = b.ring.length / 2;
      const k = Math.floor(r() * n);
      const ax = b.ring[k * 2]!;
      const az = b.ring[k * 2 + 1]!;
      const bx = b.ring[((k + 1) % n) * 2]!;
      const bz = b.ring[((k + 1) % n) * 2 + 1]!;
      const len = Math.hypot(bx - ax, bz - az) || 1;
      // 변에 수직으로 0.05m 띄운다 (안팎 어느 쪽이든 두 구현 비교에는 상관없다)
      const nx = -(bz - az) / len;
      const nz = (bx - ax) / len;
      const s = r();
      const px = ax + (bx - ax) * s + nx * 0.05;
      const pz = az + (bz - az) * s + nz * 0.05;
      const py = r() * b.height;
      const { d } = randomRay(r, 0);
      expect(caster.isBlocked(px, py, pz, ...d)).toBe(isBlockedBruteForce(prisms, px, py, pz, ...d));
    }
  });
});
