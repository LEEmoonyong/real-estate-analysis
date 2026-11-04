// 광선 비용 측정 (PLAN.md 10.4) — npm run bench
//
// 실제 계산과 같은 조건으로 광선을 쏜다: 건물 벽에서 0.05m 띄운 점 × 동지 하루(일출~일몰 10분 간격) 태양 방향.
// 하루 일조 목표: 세대 10,000 × 유효 단계 약 50 = 광선 50만 개 ≤ 2초 (워커 여러 개로 나눠 계산)
// 이 스크립트는 메인 스레드 1개 기준 값이다.
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { DEFAULT_FLOOR_HEIGHT_M } from '../src/config/constants';
import type { SampleFile } from '../src/data/samples/sampleSchema';
import { prismsFromBuildings } from '../src/domain/geometry/prism';
import { buildBuildings } from '../src/domain/scene/buildBuildings';
import { solarPosition } from '../src/domain/solar/solarPosition';
import { sunEvents } from '../src/domain/solar/sunEvents';
import { createRayCaster, isBlockedBruteForce } from '../src/domain/spatial/rayCast';
import { buildUniformGrid } from '../src/domain/spatial/uniformGrid';

const POINTS = 2000;
const TARGET_RAYS = 500_000;

type V3 = [number, number, number];
/** 점 위치 + 벽 바깥 법선 (x, z) */
type Pt = { p: V3; nx: number; nz: number };

function load(id: string) {
  const sample = JSON.parse(readFileSync(`public/samples/${id}.json`, 'utf8')) as SampleFile;
  const { buildings } = buildBuildings(sample.buildings, sample.center, DEFAULT_FLOOR_HEIGHT_M, {
    floors: {},
    dongs: {},
  });
  const prisms = prismsFromBuildings(buildings);

  const date = '2026-12-22';
  const ev = sunEvents(sample.center.lat, sample.center.lng, date);
  const dirs: V3[] = [];
  for (let m = (ev.sunriseMin ?? 420) + 5; m < (ev.sunsetMin ?? 1020); m += 10) {
    const s = solarPosition(sample.center.lat, sample.center.lng, date, m);
    if (s.isUp) dirs.push(s.direction);
  }

  // 결정적 점 집합: 건물 변을 돌아가며 변 중점에서 0.05m 바깥, 높이는 0~지붕 사이
  const points: Pt[] = [];
  for (let i = 0; points.length < POINTS; i++) {
    const p = prisms[i % prisms.length]!;
    const n = p.ring.length / 2;
    const k = Math.floor(i / prisms.length) % n;
    const ax = p.ring[k * 2]!;
    const az = p.ring[k * 2 + 1]!;
    const bx = p.ring[((k + 1) % n) * 2]!;
    const bz = p.ring[((k + 1) % n) * 2 + 1]!;
    const len = Math.hypot(bx - ax, bz - az) || 1;
    const nx = -(bz - az) / len;
    const nz = (bx - ax) / len;
    points.push({
      p: [(ax + bx) / 2 + nx * 0.05, (((i * 7) % 10) / 10) * p.height, (az + bz) / 2 + nz * 0.05],
      nx,
      nz,
    });
  }
  return { prisms, dirs, points };
}

/**
 * 모든 점 × 모든 태양 방향을 쏘고 광선 1개당 평균 시간 [µs] (최소 0.3초 이상 반복).
 * 실제 계산처럼 창이 태양 반대쪽을 보는 경우(n·d ≤ 0)는 광선을 쏘지 않는다.
 */
function measure(isBlocked: (p: V3, d: V3) => boolean, points: Pt[], dirs: V3[]) {
  let rays = 0;
  let blocked = 0;
  const start = performance.now();
  do {
    for (const { p, nx, nz } of points) {
      for (const d of dirs) {
        if (nx * d[0] + nz * d[2] <= 0) continue;
        if (isBlocked(p, d)) blocked++;
        rays++;
      }
    }
  } while (performance.now() - start < 300);
  const ms = performance.now() - start;
  return { usPerRay: (ms * 1000) / rays, blockedRatio: blocked / rays };
}

console.log(`광선 비용 (Node ${process.version}, 단일 스레드, 점 ${POINTS}개 × 동지 하루 태양 방향)\n`);
for (const id of ['seoul-jamsil', 'busan-marine-city', 'sejong-hansol']) {
  const { prisms, dirs, points } = load(id);
  const t0 = performance.now();
  const grid = buildUniformGrid(prisms);
  const buildMs = performance.now() - t0;
  const caster = createRayCaster(grid);

  const g = measure((p, d) => caster.isBlocked(p[0], p[1], p[2], d[0], d[1], d[2]), points, dirs);
  const b = measure((p, d) => isBlockedBruteForce(prisms, p[0], p[1], p[2], d[0], d[1], d[2]), points, dirs);

  console.log(
    `■ ${id}: 건물 ${prisms.length}개, 그리드 ${grid.nx}×${grid.nz} (구성 ${buildMs.toFixed(1)}ms), 태양 방향 ${dirs.length}개`,
  );
  console.log(`  그리드+DDA : ${g.usPerRay.toFixed(2)} µs/광선  (막힘 ${(g.blockedRatio * 100).toFixed(0)}%)`);
  console.log(
    `  전수 검사  : ${b.usPerRay.toFixed(2)} µs/광선  → 그리드가 ${(b.usPerRay / g.usPerRay).toFixed(1)}배 빠름`,
  );
  console.log(
    `  광선 ${TARGET_RAYS.toLocaleString()}개(세대 1만 × 50단계) 예상: ${((g.usPerRay * TARGET_RAYS) / 1000).toFixed(0)}ms (단일 스레드)\n`,
  );
}
