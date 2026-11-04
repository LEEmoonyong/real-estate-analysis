// Worker 풀 (PLAN.md 10.2)
// - 모든 Worker가 같은 장면(INIT_SCENE)을 받고, 큰 작업은 세대 범위로 나눠 병렬 처리한 뒤 메인에서 이어 붙인다.
// - 나눈 하위 작업은 같은 jobId를 공유해 한 번에 취소된다.

import type {
  FromWorker,
  GroundParams,
  GroundPartDTO,
  SceneDTO,
  SunlightParams,
  SunlightPartDTO,
  ToWorker,
} from './protocol';
import { CHUNK_UNITS } from './protocol';

/** 실제 Worker와 테스트용 가짜 Worker가 함께 따르는 최소 인터페이스 */
export interface WorkerLike {
  postMessage(message: ToWorker, transfer?: Transferable[]): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<FromWorker>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}

export class JobCancelledError extends Error {
  constructor() {
    super('작업이 취소되었습니다.');
    this.name = 'JobCancelledError';
  }
}

export interface RunOptions {
  jobId: number;
  sceneHash: string;
  params: SunlightParams;
  unitCount: number;
  onProgress?: (done: number, total: number) => void;
}

type AnyPart = SunlightPartDTO | GroundPartDTO;

interface PendingJob {
  total: number;
  /** 하위 작업별 완료 수 (Worker 인덱스 → done) */
  done: Map<number, number>;
  parts: AnyPart[];
  remaining: number;
  onProgress?: (done: number, total: number) => void;
  resolve: (parts: AnyPart[]) => void;
  reject: (error: Error) => void;
}

export interface GroundRunOptions {
  jobId: number;
  sceneHash: string;
  params: GroundParams;
  onProgress?: (done: number, total: number) => void;
}

/** 기기에 맞는 Worker 수: 코어 − 1 (메인 스레드 몫), 1~4개, 모바일은 최대 2개 */
export function poolSizeFor(hardwareConcurrency: number | undefined, isMobile: boolean): number {
  const n = Math.min(4, Math.max(1, (hardwareConcurrency ?? 4) - 1));
  return isMobile ? Math.min(2, n) : n;
}

/** [0, count)를 최대 parts개로 나눈다. 너무 잘게 나누지 않도록 하위 작업은 청크 이상 */
export function splitRange(count: number, parts: number): [number, number][] {
  const n = Math.max(1, Math.min(parts, Math.ceil(count / CHUNK_UNITS)));
  const ranges: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const from = Math.floor((count * i) / n);
    const to = Math.floor((count * (i + 1)) / n);
    if (to > from || count === 0) ranges.push([from, to]);
  }
  return ranges;
}

export class WorkerPool {
  private readonly workers: WorkerLike[];
  private readonly jobs = new Map<number, PendingJob>();
  private readonly sceneWaiters = new Map<string, { remaining: number; resolve: () => void }>();
  private currentScene: string | null = null;
  private disposed = false;

  constructor(createWorker: () => WorkerLike, size: number) {
    this.workers = Array.from({ length: Math.max(1, size) }, (_, index) => {
      const worker = createWorker();
      worker.onmessage = (event) => this.handleMessage(index, event.data);
      worker.onerror = (event) => this.failAll(event.message || 'Worker 오류');
      return worker;
    });
  }

  get size(): number {
    return this.workers.length;
  }

  /** 모든 Worker에 장면을 보내고 전부 준비되면 resolve. 이전 장면은 해제 */
  initScene(sceneHash: string, scene: SceneDTO, gridCellSize: number): Promise<void> {
    if (this.currentScene && this.currentScene !== sceneHash) {
      for (const w of this.workers) w.postMessage({ type: 'DISPOSE_SCENE', sceneHash: this.currentScene });
    }
    this.currentScene = sceneHash;
    return new Promise((resolve) => {
      this.sceneWaiters.set(sceneHash, { remaining: this.workers.length, resolve });
      for (const w of this.workers) w.postMessage({ type: 'INIT_SCENE', sceneHash, scene, gridCellSize });
    });
  }

  /** 일조 계산 — 세대 범위를 Worker 수만큼 나눠 병렬 실행하고 부분 결과를 from 순서로 돌려준다 */
  runSunlight({ jobId, sceneHash, params, unitCount, onProgress }: RunOptions): Promise<SunlightPartDTO[]> {
    return this.runSplit(jobId, unitCount, onProgress, (unitRange) => ({
      type: 'RUN',
      jobId,
      sceneHash,
      kind: 'sunlight',
      params,
      unitRange,
    })) as Promise<SunlightPartDTO[]>;
  }

  /** 지면 그림자 — 셀 범위를 Worker 수만큼 나눠 병렬 실행 */
  runGround({ jobId, sceneHash, params, onProgress }: GroundRunOptions): Promise<GroundPartDTO[]> {
    return this.runSplit(jobId, params.cols * params.rows, onProgress, (unitRange) => ({
      type: 'RUN',
      jobId,
      sceneHash,
      kind: 'ground',
      params,
      unitRange,
    })) as Promise<GroundPartDTO[]>;
  }

  private runSplit(
    jobId: number,
    count: number,
    onProgress: ((done: number, total: number) => void) | undefined,
    message: (range: [number, number]) => ToWorker,
  ): Promise<AnyPart[]> {
    if (this.disposed) return Promise.reject(new JobCancelledError());
    const ranges = splitRange(count, this.workers.length);
    return new Promise((resolve, reject) => {
      this.jobs.set(jobId, {
        total: count,
        done: new Map(),
        parts: [],
        remaining: ranges.length,
        onProgress,
        resolve,
        reject,
      });
      ranges.forEach((range, i) => this.workers[i]!.postMessage(message(range)));
    });
  }

  /** 실행 중인 작업 취소 — Worker는 다음 청크 경계에서 멈춘다. promise는 즉시 JobCancelledError로 끝낸다 */
  cancel(jobId: number): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    for (const w of this.workers) w.postMessage({ type: 'CANCEL', jobId });
    this.jobs.delete(jobId);
    job.reject(new JobCancelledError());
  }

  dispose(): void {
    this.disposed = true;
    for (const job of this.jobs.values()) job.reject(new JobCancelledError());
    this.jobs.clear();
    for (const w of this.workers) w.terminate();
  }

  private handleMessage(workerIndex: number, message: FromWorker): void {
    switch (message.type) {
      case 'READY': {
        const waiter = this.sceneWaiters.get(message.sceneHash);
        if (waiter && --waiter.remaining === 0) {
          this.sceneWaiters.delete(message.sceneHash);
          waiter.resolve();
        }
        return;
      }
      case 'PROGRESS': {
        const job = this.jobs.get(message.jobId);
        if (!job) return;
        job.done.set(workerIndex, message.done);
        let done = 0;
        for (const v of job.done.values()) done += v;
        job.onProgress?.(done, job.total);
        return;
      }
      case 'RESULT': {
        const job = this.jobs.get(message.jobId);
        if (!job) return;
        job.parts.push(message.payload);
        if (--job.remaining === 0) {
          this.jobs.delete(message.jobId);
          job.resolve(job.parts.sort((a, b) => a.from - b.from));
        }
        return;
      }
      case 'CANCELLED':
        // cancel()에서 이미 promise를 끝냈다
        return;
      case 'ERROR': {
        if (message.jobId === null) {
          this.failAll(message.message);
          return;
        }
        const job = this.jobs.get(message.jobId);
        if (!job) return;
        // 다른 하위 작업도 멈추고 원래 오류 메시지로 끝낸다 (cancel()을 쓰면 취소 오류로 덮인다)
        this.jobs.delete(message.jobId);
        for (const w of this.workers) w.postMessage({ type: 'CANCEL', jobId: message.jobId });
        job.reject(new Error(message.message));
        return;
      }
    }
  }

  private failAll(reason: string): void {
    for (const [jobId, job] of this.jobs) {
      for (const w of this.workers) w.postMessage({ type: 'CANCEL', jobId });
      job.reject(new Error(reason));
    }
    this.jobs.clear();
  }
}
