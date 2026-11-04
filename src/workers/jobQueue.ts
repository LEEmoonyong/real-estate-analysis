// 작업 큐 (PLAN.md 10.3) — 우선순위·최신 요청 유지·취소
//
// 규칙
// (1) 장면이 바뀌면 cancelAll()로 전부 취소
// (2) 같은 kind의 새 요청이 오면 대기·실행 중인 이전 요청을 취소 (최신만 유지)
// (4) 실행 전에 캐시를 확인하는 것은 호출하는 쪽(useSunlightWorker)에서 한다
// 한 번에 하나씩 실행한다 — 작업 하나가 이미 Worker 풀 전체로 나뉘어 병렬 실행되기 때문.
// (3) 낮은 우선순위 작업의 협조적 양보는 일조 외 작업(천공률 등)이 생기는 9일차 이후에 필요해진다.

import type { JobKind } from '../domain/types';
import { JobCancelledError } from './workerPool';

/** 숫자가 작을수록 먼저 (P0 = 일조) */
export const JOB_PRIORITY: Record<JobKind, number> = {
  sunlight: 0,
  skyView: 1,
  irradiance: 1,
  ground: 1,
  roof: 2,
  season: 4,
};

export interface RunningHandle<T> {
  promise: Promise<T>;
  cancel: () => void;
}

interface Entry {
  kind: JobKind;
  priority: number;
  seq: number;
  start: () => RunningHandle<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  handle?: RunningHandle<unknown>;
}

export class JobQueue {
  private pending: Entry[] = [];
  private running: Entry | null = null;
  private seq = 0;

  /**
   * 작업을 넣는다. 같은 kind의 이전 작업은 취소된다.
   * @param start 실행을 시작하고 취소 함수를 돌려주는 함수 (차례가 되면 호출)
   */
  submit<T>(kind: JobKind, start: () => RunningHandle<T>, priority = JOB_PRIORITY[kind]): Promise<T> {
    this.cancel(kind);
    return new Promise<T>((resolve, reject) => {
      this.pending.push({
        kind,
        priority,
        seq: this.seq++,
        start: start as () => RunningHandle<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.pending.sort((a, b) => a.priority - b.priority || a.seq - b.seq);
      this.pump();
    });
  }

  /** 해당 kind의 대기·실행 중 작업 취소 */
  cancel(kind: JobKind): void {
    const removed = this.pending.filter((e) => e.kind === kind);
    this.pending = this.pending.filter((e) => e.kind !== kind);
    for (const e of removed) e.reject(new JobCancelledError());
    if (this.running?.kind === kind) this.running.handle?.cancel();
  }

  cancelAll(): void {
    const removed = this.pending;
    this.pending = [];
    for (const e of removed) e.reject(new JobCancelledError());
    this.running?.handle?.cancel();
  }

  get size(): number {
    return this.pending.length + (this.running ? 1 : 0);
  }

  private pump(): void {
    if (this.running) return;
    const next = this.pending.shift();
    if (!next) return;
    this.running = next;
    let handle: RunningHandle<unknown>;
    try {
      handle = next.start();
    } catch (err) {
      this.running = null;
      next.reject(err);
      this.pump();
      return;
    }
    next.handle = handle;
    handle.promise.then(next.resolve, next.reject).finally(() => {
      if (this.running === next) this.running = null;
      this.pump();
    });
  }
}
