import { describe, expect, it } from 'vitest';
import { createPrism, hitsPrism, rayHitsBox2D } from './prism';

const RAD = Math.PI / 180;

/** 축 정렬 직사각형 링 (x, z) */
function rect(x0: number, z0: number, x1: number, z1: number) {
  return new Float64Array([x0, z1, x1, z1, x1, z0, x0, z0]);
}

/** 태양 방향 (고도 h, 방위 A: 북=0, 남=180) — solarPosition.sunDirection과 같은 식 */
function sunDir(altDeg: number, azDeg: number): [number, number, number] {
  const h = altDeg * RAD;
  const a = azDeg * RAD;
  return [Math.cos(h) * Math.sin(a), Math.sin(h), -Math.cos(h) * Math.cos(a)];
}

describe('hitsPrism — 해석해 비교', () => {
  // 20×20×30m 건물, 북쪽 벽(z=−10)에서 북쪽으로 20m 떨어진 지면 점, 태양은 정남
  const cube = createPrism(rect(-10, -10, 10, 10), 30);
  const p = [0, 0, -30] as const;
  const critical = Math.atan(30 / 20) / RAD; // ≈ 56.31°

  it('tan h < 30/20 이면 막힌다 (경계 −0.01°)', () => {
    expect(hitsPrism(...p, ...sunDir(critical - 0.01, 180), cube)).toBe(true);
  });

  it('tan h > 30/20 이면 막히지 않는다 (경계 +0.01°)', () => {
    expect(hitsPrism(...p, ...sunDir(critical + 0.01, 180), cube)).toBe(false);
  });

  it.each([5, 20, 45, 56])('낮은 고도 %d°에서는 막힌다', (alt) => {
    expect(hitsPrism(...p, ...sunDir(alt, 180), cube)).toBe(true);
  });

  it('태양이 반대편(북쪽)이면 막히지 않는다', () => {
    expect(hitsPrism(...p, ...sunDir(20, 0), cube)).toBe(false);
  });

  it('비스듬한 방위: 건물 옆으로 비껴가면 막히지 않는다', () => {
    // 정남에서 동쪽으로 40° → 수평 방향 (sin40, cos40)… 건물 폭 ±10m, 거리 20~40m라 옆으로 빠진다
    expect(hitsPrism(...p, ...sunDir(10, 140), cube)).toBe(false);
    // 같은 방위라도 건물 바로 앞 점이면 막힌다
    expect(hitsPrism(0, 0, -11, ...sunDir(10, 140), cube)).toBe(true);
  });

  it('지붕 높이 이상에서 출발하면 막히지 않는다', () => {
    expect(hitsPrism(0, 30, -30, ...sunDir(5, 180), cube)).toBe(false);
    expect(hitsPrism(0, 31, -30, ...sunDir(5, 180), cube)).toBe(false);
  });
});

describe('hitsPrism — 자기 건물 차폐', () => {
  const cube = createPrism(rect(-10, -10, 10, 10), 30);

  it('남쪽 벽에서 0.05m 띄운 창은 남쪽 태양에 막히지 않는다', () => {
    expect(hitsPrism(0, 5, 10.05, ...sunDir(20, 180), cube)).toBe(false);
  });

  it('같은 창이라도 태양이 북쪽이면 자기 건물을 통과해야 하므로 막힌다', () => {
    expect(hitsPrism(0, 5, 10.05, ...sunDir(20, 0), cube)).toBe(true);
  });

  it('ㄱ자 동의 안쪽 모서리 창은 날개에 가려진다', () => {
    // ㄱ자: 동서로 긴 몸통(z ∈ [0, 12]) + 동쪽 끝에서 남쪽으로 뻗은 날개(x ∈ [40, 52], z ∈ [12, 40])
    const L = createPrism(new Float64Array([0, 12, 40, 12, 40, 40, 52, 40, 52, 0, 0, 0]), 45);
    // 몸통 남쪽 벽(z=12) 날개 바로 옆 창, 태양은 남동쪽 낮게 → 날개 서쪽 벽에 막힘
    expect(hitsPrism(35, 10, 12.05, ...sunDir(15, 135), L)).toBe(true);
    // 같은 창, 남서쪽 태양 → 트여 있음
    expect(hitsPrism(35, 10, 12.05, ...sunDir(15, 225), L)).toBe(false);
  });
});

describe('hitsPrism — 퇴화 케이스', () => {
  const box = createPrism(rect(0, 0, 10, 10), 10);

  it('꼭짓점을 정확히 지나는 광선은 막힘으로 본다 (보수적)', () => {
    const len = Math.SQRT2;
    // (−5, 5)에서 (0, 0) 꼭짓점을 스치고 (5, −5)로 빠져나가는 광선
    expect(hitsPrism(-5, 0, 5, 1 / len, 0.01, -1 / len, box)).toBe(true);
  });

  it('변의 연장선을 따라 미끄러지는 광선도 막힘으로 본다', () => {
    expect(hitsPrism(-5, 0, 0, 1, 0.01, 0, box)).toBe(true);
  });

  it('변과 평행하게 바깥으로 0.01m 비껴가면 막히지 않는다', () => {
    expect(hitsPrism(-5, 0, -0.01, 1, 0.01, 0, box)).toBe(false);
  });

  it('천정 방향(수평 성분 0)은 벽과 만나지 않는다', () => {
    expect(hitsPrism(5, 0, -1, 0, 1, 0, box)).toBe(false);
  });

  it('건물 안에서 출발한 광선은 벽에 막힌다', () => {
    expect(hitsPrism(5, 1, 5, ...sunDir(30, 180), box)).toBe(true);
  });
});

describe('rayHitsBox2D', () => {
  it('통과·빗나감·구간 제한', () => {
    expect(rayHitsBox2D(-5, 5, 1, 0, 0, Infinity, 0, 10, 0, 10)).toBe(true);
    expect(rayHitsBox2D(-5, 15, 1, 0, 0, Infinity, 0, 10, 0, 10)).toBe(false);
    expect(rayHitsBox2D(-5, 5, 1, 0, 0, 4, 0, 10, 0, 10)).toBe(false); // 상자에 닿기 전에 끝남
    expect(rayHitsBox2D(-5, 5, -1, 0, 0, Infinity, 0, 10, 0, 10)).toBe(false); // 반대 방향
    expect(rayHitsBox2D(5, -5, 0, 1, 0, Infinity, 0, 10, 0, 10)).toBe(true); // ux = 0
  });
});
