import { describe, expect, it } from 'vitest';
import { sceneHash } from './sceneHash';

const ring = new Float64Array([0, 0, 10, 0, 10, 10, 0, 10]);
const a = { id: 'a', heightM: 30, ring };
const b = { id: 'b', heightM: 15, ring: ring.map((v) => v + 20) };

describe('sceneHash', () => {
  it('건물 순서와 무관', () => {
    expect(sceneHash([a, b])).toBe(sceneHash([b, a]));
  });

  it('높이·외곽선·건물 구성이 바뀌면 달라진다', () => {
    const base = sceneHash([a, b]);
    expect(sceneHash([{ ...a, heightM: 33 }, b])).not.toBe(base);
    expect(sceneHash([{ ...a, ring: ring.map((v) => v + 1) }, b])).not.toBe(base);
    expect(sceneHash([a])).not.toBe(base);
    expect(sceneHash([a, b], 'unitWidth=5')).not.toBe(base);
  });

  it('1cm 미만 차이는 무시', () => {
    expect(sceneHash([{ ...a, ring: ring.map((v) => v + 0.001) }])).toBe(sceneHash([a]));
  });
});
