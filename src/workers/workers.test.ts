import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CRITERIA } from '../config/constants';
import { prismsFromBuildings } from '../domain/geometry/prism';
import { buildBuildings } from '../domain/scene/buildBuildings';
import { createRayCaster } from '../domain/spatial/rayCast';
import { buildUniformGrid } from '../domain/spatial/uniformGrid';
import { aggregateSunlight } from '../domain/sunlight/sunlight';
import { computeSunSteps } from '../domain/sunlight/sunSteps';
import { fillVisibilityMask } from '../domain/sunlight/visibility';
import type { LatLng, RawBuilding } from '../domain/types';
import { generateUnits } from '../domain/units/generateUnits';
import { JobQueue, type RunningHandle } from './jobQueue';
import type { FromWorker, SunlightParams, ToWorker } from './protocol';
import { LruCache } from './resultCache';
import { mergeSunlightParts, toSceneDTO } from './sceneTransfer';
import { createWorkerRuntime } from './workerRuntime';
import { JobCancelledError, poolSizeFor, splitRange, WorkerPool, type WorkerLike } from './workerPool';

/** 같은 프로세스에서 실제 Worker 런타임을 돌리는 가짜 Worker (메시지는 비동기로 전달) */
class FakeWorker implements WorkerLike {
  onmessage: ((event: MessageEvent<FromWorker>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly received: FromWorker[] = [];
  terminated = false;
  private readonly runtime = createWorkerRuntime(
    (message) => {
      this.received.push(message);
      setTimeout(() => !this.terminated && this.onmessage?.({ data: message } as MessageEvent<FromWorker>), 0);
    },
    () => new Promise((r) => setTimeout(r, 0)),
  );

  postMessage(message: ToWorker): void {
    setTimeout(() => !this.terminated && void this.runtime.handle(message), 0);
  }

  terminate(): void {
    this.terminated = true;
  }
}

function loadScene(id: string) {
  const s = JSON.parse(readFileSync(`public/samples/${id}.json`, 'utf8')) as {
    center: LatLng;
    buildings: RawBuilding[];
  };
  const { buildings } = buildBuildings(s.buildings, s.center, 2.9, { floors: {}, dongs: {} });
  const units = generateUnits(buildings);
  const steps = computeSunSteps(s.center.lat, s.center.lng, '2026-12-22', 10);
  const params: SunlightParams = {
    stepMinutes: 10,
    startMinute: steps.startMinute,
    stepCount: steps.count,
    directions: steps.directions,
    criteria: { ...DEFAULT_CRITERIA },
  };
  return { buildings, units, steps, params };
}

describe('Worker 풀 + 런타임 (가짜 Worker 3개)', () => {
  it('나눠서 계산해 이어 붙인 결과 == 한 번에 계산한 결과', async () => {
    const { buildings, units, steps, params } = loadScene('sejong-hansol');
    const pool = new WorkerPool(() => new FakeWorker(), 3);
    await pool.initScene('s1', toSceneDTO(buildings, units), 20);
    const progress: number[] = [];
    const parts = await pool.runSunlight({
      jobId: 1,
      sceneHash: 's1',
      params,
      unitCount: units.count,
      onProgress: (done) => progress.push(done),
    });
    expect(parts).toHaveLength(3);
    const merged = mergeSunlightParts(parts, units.count, steps.count);

    const caster = createRayCaster(buildUniformGrid(prismsFromBuildings(buildings)));
    const mask = new Uint8Array(units.count * steps.count);
    fillVisibilityMask(units, 0, units.count, steps, caster, mask);
    const direct = aggregateSunlight(mask, units.count, steps.count, steps.startMinute, 10, DEFAULT_CRITERIA);

    expect(merged.mask).toEqual(mask);
    expect(merged.totalMinutes).toEqual(direct.totalMinutes);
    expect(merged.meets).toEqual(direct.meets);
    expect(progress.at(-1)).toBe(units.count);
    pool.dispose();
  });

  it('취소하면 promise가 JobCancelledError로 끝나고 Worker는 CANCELLED로 멈춘다', async () => {
    const { buildings, units, params } = loadScene('seoul-jamsil');
    const workers: FakeWorker[] = [];
    const pool = new WorkerPool(() => {
      const w = new FakeWorker();
      workers.push(w);
      return w;
    }, 2);
    await pool.initScene('s2', toSceneDTO(buildings, units), 20);
    let cancelledOnce = false;
    const promise = pool.runSunlight({
      jobId: 7,
      sceneHash: 's2',
      params,
      unitCount: units.count,
      onProgress: () => {
        if (!cancelledOnce) {
          cancelledOnce = true;
          pool.cancel(7);
        }
      },
    });
    await expect(promise).rejects.toBeInstanceOf(JobCancelledError);
    // Worker가 다음 청크 경계에서 멈출 시간을 준다
    await new Promise((r) => setTimeout(r, 50));
    for (const w of workers) {
      expect(w.received.some((m) => m.type === 'CANCELLED' && m.jobId === 7)).toBe(true);
      expect(w.received.some((m) => m.type === 'RESULT' && m.jobId === 7)).toBe(false);
    }
    pool.dispose();
  });

  it('준비되지 않은 장면으로 실행하면 오류 메시지로 끝난다', async () => {
    const { params } = loadScene('sejong-hansol');
    const pool = new WorkerPool(() => new FakeWorker(), 1);
    await expect(pool.runSunlight({ jobId: 3, sceneHash: 'none', params, unitCount: 10 })).rejects.toThrow(
      '장면이 준비되지 않았습니다',
    );
    pool.dispose();
  });
});

describe('풀 크기·범위 나누기', () => {
  it('poolSizeFor', () => {
    expect(poolSizeFor(8, false)).toBe(4);
    expect(poolSizeFor(4, false)).toBe(3);
    expect(poolSizeFor(1, false)).toBe(1);
    expect(poolSizeFor(8, true)).toBe(2);
    expect(poolSizeFor(undefined, false)).toBe(3);
  });

  it('splitRange는 빈틈·겹침 없이 나누고 청크보다 잘게 나누지 않는다', () => {
    expect(splitRange(10_000, 4)).toEqual([
      [0, 2500],
      [2500, 5000],
      [5000, 7500],
      [7500, 10_000],
    ]);
    expect(splitRange(300, 4)).toEqual([[0, 300]]);
    expect(splitRange(0, 4)).toEqual([[0, 0]]);
  });
});

describe('JobQueue', () => {
  /** 수동으로 끝낼 수 있는 가짜 작업 */
  function manual<T>() {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    let cancelled = false;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const handle: RunningHandle<T> = {
      promise,
      cancel: () => {
        cancelled = true;
        reject(new JobCancelledError());
      },
    };
    return { handle, resolve, isCancelled: () => cancelled };
  }

  it('같은 kind의 새 요청은 실행 중인 이전 요청을 취소한다 (최신만 유지)', async () => {
    const q = new JobQueue();
    const a = manual<string>();
    const b = manual<string>();
    const pa = q.submit('sunlight', () => a.handle);
    const pb = q.submit('sunlight', () => b.handle);
    await expect(pa).rejects.toBeInstanceOf(JobCancelledError);
    expect(a.isCancelled()).toBe(true);
    await Promise.resolve();
    b.resolve('b');
    await expect(pb).resolves.toBe('b');
  });

  it('한 번에 하나씩, 우선순위가 높은(숫자가 작은) 작업부터', async () => {
    const q = new JobQueue();
    const order: string[] = [];
    const first = manual<void>();
    const p1 = q.submit('season', () => {
      order.push('season');
      return first.handle;
    });
    const p2 = q.submit('skyView', () => {
      order.push('skyView');
      return { promise: Promise.resolve(), cancel: () => {} };
    });
    const p3 = q.submit('sunlight', () => {
      order.push('sunlight');
      return { promise: Promise.resolve(), cancel: () => {} };
    });
    expect(order).toEqual(['season']); // 실행 중인 작업이 끝나기 전에는 다음을 시작하지 않는다
    first.resolve();
    await Promise.all([p1, p2, p3]);
    expect(order).toEqual(['season', 'sunlight', 'skyView']);
  });

  it('cancelAll은 대기·실행 중 작업을 모두 취소한다', async () => {
    const q = new JobQueue();
    const a = manual<void>();
    const pa = q.submit('sunlight', () => a.handle);
    const pb = q.submit('skyView', () => ({ promise: Promise.resolve(), cancel: () => {} }));
    q.cancelAll();
    await expect(pa).rejects.toBeInstanceOf(JobCancelledError);
    await expect(pb).rejects.toBeInstanceOf(JobCancelledError);
    expect(a.isCancelled()).toBe(true);
  });
});

describe('LruCache', () => {
  it('용량을 넘으면 가장 오래 쓰지 않은 항목부터 버린다', () => {
    const c = new LruCache<number>(2);
    c.set('a', 1);
    c.set('b', 2);
    expect(c.get('a')).toBe(1); // a를 최근으로
    c.set('c', 3);
    expect(c.get('b')).toBeUndefined();
    expect(c.get('a')).toBe(1);
    expect(c.get('c')).toBe(3);
  });
});
