import { describe, expect, it } from 'vitest';
import {
  cleanFootprint,
  convexHull,
  edgeOutwardNormal,
  ensureCcw,
  isSelfIntersecting,
  pointInPolygon,
  reverseRing,
  signedArea,
  vertexCount,
} from './polygon';

/** (x, 북) 좌표로 적은 점 목록 → 로컬 링 (z = −북). 테스트를 지도 보듯 읽기 위함 */
const fromMap = (pts: [number, number][]) => new Float64Array(pts.flatMap(([x, north]) => [x, -north]));

// 20m × 10m 직사각형, 지도에서 반시계 (남서 → 남동 → 북동 → 북서)
const RECT_CCW = fromMap([
  [0, 0],
  [20, 0],
  [20, 10],
  [0, 10],
]);

describe('signedArea / 방향', () => {
  it('지도에서 반시계면 양수, 시계면 음수', () => {
    expect(signedArea(RECT_CCW)).toBeCloseTo(200);
    expect(signedArea(reverseRing(RECT_CCW))).toBeCloseTo(-200);
  });

  it('ensureCcw는 시계 방향 입력을 뒤집는다', () => {
    expect(signedArea(ensureCcw(reverseRing(RECT_CCW)))).toBeGreaterThan(0);
  });
});

describe('edgeOutwardNormal', () => {
  it('직사각형 네 변의 법선이 남·동·북·서(바깥)를 향한다', () => {
    const close = (v: number[], e: number[]) => v.forEach((x, i) => expect(x).toBeCloseTo(e[i]!, 12));
    close(edgeOutwardNormal(RECT_CCW, 0), [0, 1]); // 남쪽 변 → +z(남)
    close(edgeOutwardNormal(RECT_CCW, 1), [1, 0]); // 동쪽 변 → +x
    close(edgeOutwardNormal(RECT_CCW, 2), [0, -1]); // 북쪽 변 → −z
    close(edgeOutwardNormal(RECT_CCW, 3), [-1, 0]); // 서쪽 변 → −x
  });

  it('법선 방향으로 1m 나간 점은 다각형 밖이다', () => {
    for (let i = 0; i < 4; i++) {
      const [nx, nz] = edgeOutwardNormal(RECT_CCW, i);
      const j = (i + 1) % 4;
      const mx = (RECT_CCW[i * 2]! + RECT_CCW[j * 2]!) / 2;
      const mz = (RECT_CCW[i * 2 + 1]! + RECT_CCW[j * 2 + 1]!) / 2;
      expect(pointInPolygon(mx + nx, mz + nz, RECT_CCW)).toBe(false);
      expect(pointInPolygon(mx - nx, mz - nz, RECT_CCW)).toBe(true);
    }
  });
});

describe('isSelfIntersecting', () => {
  it('나비넥타이 모양은 자기교차', () => {
    expect(
      isSelfIntersecting(
        fromMap([
          [0, 0],
          [10, 10],
          [10, 0],
          [0, 10],
        ]),
      ),
    ).toBe(true);
  });
  it('ㄱ자(오목) 다각형은 자기교차가 아니다', () => {
    expect(
      isSelfIntersecting(
        fromMap([
          [0, 0],
          [30, 0],
          [30, 10],
          [10, 10],
          [10, 30],
          [0, 30],
        ]),
      ),
    ).toBe(false);
  });
});

describe('convexHull', () => {
  it('내부 점을 제거하고 CCW로 낸다', () => {
    const hull = convexHull(
      fromMap([
        [0, 0],
        [5, 5],
        [10, 0],
        [10, 10],
        [0, 10],
      ]),
    );
    expect(vertexCount(hull)).toBe(4);
    expect(signedArea(hull)).toBeCloseTo(100);
  });
});

describe('cleanFootprint', () => {
  it('시계 방향 입력을 CCW로 바꾸고 면적을 보존한다', () => {
    const r = cleanFootprint(reverseRing(RECT_CCW))!;
    expect(r.area).toBeCloseTo(200);
    expect(signedArea(r.ring)).toBeGreaterThan(0);
    expect(r.repaired).toBe(false);
  });

  it('닫힘 정점·중복 정점·공선 정점을 제거한다', () => {
    const r = cleanFootprint(
      fromMap([
        [0, 0],
        [0.01, 0], // 중복 (5cm 미만)
        [10, 0], // 공선
        [20, 0],
        [20, 10],
        [0, 10],
        [0, 0], // 닫힘 정점
      ]),
    )!;
    expect(vertexCount(r.ring)).toBe(4);
    expect(r.area).toBeCloseTo(200, 0);
  });

  it('바늘처럼 튀어나온 스파이크를 제거한다', () => {
    const r = cleanFootprint(
      fromMap([
        [0, 0],
        [20, 0],
        [20, 5],
        [40, 5],
        [20, 5],
        [20, 10],
        [0, 10],
      ]),
    )!;
    expect(vertexCount(r.ring)).toBe(4);
  });

  it('자기교차 외곽선은 볼록 껍질로 복구하고 표시한다', () => {
    const r = cleanFootprint(
      fromMap([
        [0, 0],
        [10, 10],
        [10, 0],
        [0, 10],
      ]),
    )!;
    expect(r.repaired).toBe(true);
    expect(r.area).toBeCloseTo(100);
    expect(isSelfIntersecting(r.ring)).toBe(false);
  });

  it('너무 작거나 정점이 부족하면 null', () => {
    expect(
      cleanFootprint(
        fromMap([
          [0, 0],
          [3, 0],
          [3, 3],
          [0, 3],
        ]),
      ),
    ).toBeNull(); // 9m² < 10m²
    expect(
      cleanFootprint(
        fromMap([
          [0, 0],
          [10, 0],
          [20, 0],
        ]),
      ),
    ).toBeNull(); // 일직선
    expect(
      cleanFootprint(
        fromMap([
          [0, 0],
          [NaN, 0],
          [10, 10],
        ]),
      ),
    ).toBeNull();
  });

  it('오목 다각형(ㄱ자 동)은 그대로 유지한다', () => {
    const L = fromMap([
      [0, 0],
      [30, 0],
      [30, 10],
      [10, 10],
      [10, 30],
      [0, 30],
    ]);
    const r = cleanFootprint(L)!;
    expect(vertexCount(r.ring)).toBe(6);
    expect(r.area).toBeCloseTo(500);
  });
});
