// 작업 큐 (PLAN.md 10.3) — 우선순위·최신 요청 유지·취소
//
// 규칙
// (1) 장면이 바뀌면 cancelAll()로 전부 취소
// (2) 같은 kind의 새 요청이 오면 대기·실행 중인 이전 요청을 취소 (최신만 유지)
// (4) 실행 전에 캐시를 확인하는 것은 호출하는 쪽(useSunlightWorker)에서 한다
// 한 번에 하나씩 실행한다 — 작업 하나가 이미 Worker 풀 전체로 나뉘어 병렬 실행되기 때문.
// (3) 더 높은 우선순위 작업이 오면 실행 중인 낮은 우선순위 작업을 취소(Worker는 현재 청크까지만 하고 멈춤)하고
//     큐에 다시 넣는다 — 협조적 양보. 다시 차례가 오면 처음부터 실행하며, 호출한 쪽의 promise는 그대로 기다린다.

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
  /** 양보하느라 취소됨 — 결과를 버리고 다시 큐에 넣는다 */
  yielded?: boolean;
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
      this.yieldIfOutranked(priority);
      this.pump();
    });
  }

  /** 해당 kind의 대기·실행 중 작업 취소 */
  cancel(kind: JobKind): void {
    const removed = this.pending.filter((e) => e.kind === kind);
    this.pending = this.pending.filter((e) => e.kind !== kind);
    for (const e of removed) e.reject(new JobCancelledError());
    if (this.running?.kind === kind) {
      this.running.yielded = false; // 명시적 취소는 다시 넣지 않는다
      this.running.handle?.cancel();
    }
  }

  cancelAll(): void {
    const removed = this.pending;
    this.pending = [];
    for (const e of removed) e.reject(new JobCancelledError());
    if (this.running) this.running.yielded = false;
    this.running?.handle?.cancel();
  }

  /** 실행 중인 작업보다 우선순위가 높은 작업이 들어오면 실행 중인 작업을 양보시킨다 */
  private yieldIfOutranked(priority: number): void {
    const running = this.running;
    if (!running || running.priority <= priority || !running.handle) return;
    running.yielded = true;
    running.handle.cancel();
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
    const settle = (ok: boolean, value: unknown) => {
      if (this.running === next) this.running = null;
      if (next.yielded) {
        // 양보: 결과(취소 오류)를 버리고 같은 순번으로 다시 대기열에
        next.yielded = false;
        delete next.handle;
        this.pending.push(next);
        this.pending.sort((a, b) => a.priority - b.priority || a.seq - b.seq);
      } else if (ok) next.resolve(value);
      else next.reject(value);
      this.pump();
    };
    handle.promise.then(
      (v) => settle(true, v),
      (e: unknown) => settle(false, e),
    );
  }
}
