// 장면 해시 (PLAN.md 9.13) — 건물 id·높이·외곽선이 같으면 같은 값.
// 계산 결과 캐시 키와 Worker 장면 식별에 쓴다. 층수 보정이 바뀌면 높이가 바뀌어 해시도 바뀐다(자동 무효화).

/** FNV-1a 32비트 */
class Fnv1a {
  private h = 0x811c9dc5;

  string(s: string): this {
    for (let i = 0; i < s.length; i++) {
      this.h ^= s.charCodeAt(i);
      this.h = Math.imul(this.h, 0x01000193);
    }
    return this;
  }

  /** 좌표는 cm 단위로 반올림해 넣는다 (부동소수점 미세 차이로 해시가 흔들리지 않게) */
  number(v: number): this {
    return this.string(String(Math.round(v * 100)));
  }

  digest(): string {
    return (this.h >>> 0).toString(16).padStart(8, '0');
  }
}

export function sceneHash(
  buildings: readonly { id: string; heightM: number; ring: Float64Array; usage?: string }[],
  extra = '',
): string {
  const sorted = [...buildings].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const h = new Fnv1a().string(extra);
  for (const b of sorted) {
    h.string(b.id)
      .string('|')
      .number(b.heightM)
      .string(b.usage ?? '');
    for (let i = 0; i < b.ring.length; i++) h.number(b.ring[i]!);
    h.string(';');
  }
  return `${sorted.length}-${h.digest()}`;
}
