// 계산 결과 LRU 캐시 (PLAN.md 9.13) — 같은 장면·날짜·설정으로 다시 계산하지 않는다
// Map은 삽입 순서를 유지하므로, 읽을 때 지웠다 다시 넣으면 가장 최근 항목이 된다.

export class LruCache<V> {
  private readonly map = new Map<string, V>();

  constructor(private readonly capacity = 24) {}

  get(key: string): V | undefined {
    const value = this.map.get(key);
    if (value === undefined) return undefined;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: string, value: V): void {
    this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.capacity) {
      const oldest = this.map.keys().next().value as string;
      this.map.delete(oldest);
    }
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
}
