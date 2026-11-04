// Worker 안에서 실행되는 메시지 처리기 (환경과 분리해 Node 테스트에서도 그대로 실행)
//
// - INIT_SCENE: 프리즘으로 균일 그리드·광선 캐스터를 만들어 장면 해시별로 보관
// - RUN: 세대를 512개 청크로 나눠 계산하고, 청크 사이에 이벤트 루프에 양보해 CANCEL 메시지를 받는다
// - 진행률은 최대 10Hz, 결과 배열은 transfer로 넘긴다

import { createPrism, type Prism } from '../domain/geometry/prism';
import { createRayCaster, type RayCaster } from '../domain/spatial/rayCast';
import { buildUniformGrid } from '../domain/spatial/uniformGrid';
import { aggregateSunlight } from '../domain/sunlight/sunlight';
import { fillVisibilityMask, type UnitGeometry } from '../domain/sunlight/visibility';
import {
  CHUNK_UNITS,
  PROGRESS_INTERVAL_MS,
  type FromWorker,
  type PrismsDTO,
  type SunlightParams,
  type ToWorker,
} from './protocol';

export type PostFn = (message: FromWorker, transfer?: Transferable[]) => void;

interface WorkerScene {
  caster: RayCaster;
  units: UnitGeometry;
  unitCount: number;
}

export function prismsFromDTO(dto: PrismsDTO): Prism[] {
  const prisms: Prism[] = [];
  for (let i = 0; i < dto.heights.length; i++) {
    prisms.push(createPrism(dto.rings.slice(dto.offsets[i]!, dto.offsets[i + 1]!), dto.heights[i]!));
  }
  return prisms;
}

/** 이벤트 루프에 한 번 양보 (MessageChannel 매크로태스크 — setTimeout의 4ms 최소 지연이 없다) */
export function createYield(): () => Promise<void> {
  const channel = new MessageChannel();
  const queue: (() => void)[] = [];
  channel.port1.onmessage = () => queue.shift()?.();
  return () =>
    new Promise<void>((resolve) => {
      queue.push(resolve);
      channel.port2.postMessage(0);
    });
}

export function createWorkerRuntime(post: PostFn, yieldToEventLoop: () => Promise<void> = createYield()) {
  const scenes = new Map<string, WorkerScene>();
  const cancelled = new Set<number>();

  async function runSunlight(jobId: number, scene: WorkerScene, params: SunlightParams, from: number, to: number) {
    const started = performance.now();
    const K = params.stepCount;
    const count = to - from;
    const mask = new Uint8Array(count * K);
    const steps = { count: K, directions: params.directions };
    let rays = 0;
    let lastProgress = 0;

    for (let c = from; c < to; c += CHUNK_UNITS) {
      if (cancelled.has(jobId)) {
        cancelled.delete(jobId);
        post({ type: 'CANCELLED', jobId });
        return;
      }
      const end = Math.min(to, c + CHUNK_UNITS);
      rays += fillVisibilityMask(scene.units, c, end, steps, scene.caster, mask, (c - from) * K);
      const now = performance.now();
      if (now - lastProgress >= PROGRESS_INTERVAL_MS || end === to) {
        lastProgress = now;
        post({ type: 'PROGRESS', jobId, done: end - from, total: count });
      }
      await yieldToEventLoop();
    }
    if (cancelled.has(jobId)) {
      cancelled.delete(jobId);
      post({ type: 'CANCELLED', jobId });
      return;
    }

    const stats = aggregateSunlight(mask, count, K, params.startMinute, params.stepMinutes, params.criteria);
    const payload = { from, to, mask, ...stats, rays, elapsedMs: performance.now() - started };
    post({ type: 'RESULT', jobId, kind: 'sunlight', payload }, [
      mask.buffer,
      stats.totalMinutes.buffer,
      stats.windowTotalMinutes.buffer,
      stats.windowMaxContinuous.buffer,
      stats.meets.buffer,
    ]);
  }

  async function handle(message: ToWorker): Promise<void> {
    switch (message.type) {
      case 'INIT_SCENE': {
        const { scene } = message;
        const grid = buildUniformGrid(prismsFromDTO(scene.prisms), message.gridCellSize);
        scenes.set(message.sceneHash, {
          caster: createRayCaster(grid),
          units: { positions: scene.unitPositions, normals: scene.unitNormals },
          unitCount: scene.unitCount,
        });
        post({ type: 'READY', sceneHash: message.sceneHash });
        return;
      }
      case 'DISPOSE_SCENE':
        scenes.delete(message.sceneHash);
        return;
      case 'CANCEL':
        cancelled.add(message.jobId);
        return;
      case 'RUN': {
        const scene = scenes.get(message.sceneHash);
        if (!scene) {
          post({ type: 'ERROR', jobId: message.jobId, message: `장면이 준비되지 않았습니다 (${message.sceneHash})` });
          return;
        }
        const [from, to] = message.unitRange;
        if (from < 0 || to > scene.unitCount || from > to) {
          post({ type: 'ERROR', jobId: message.jobId, message: `세대 범위가 잘못되었습니다 (${from}–${to})` });
          return;
        }
        try {
          await runSunlight(message.jobId, scene, message.params, from, to);
        } catch (err) {
          post({ type: 'ERROR', jobId: message.jobId, message: err instanceof Error ? err.message : String(err) });
        }
        return;
      }
    }
  }

  return { handle };
}
