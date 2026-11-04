// Worker 안에서 실행되는 메시지 처리기 (환경과 분리해 Node 테스트에서도 그대로 실행)
//
// - INIT_SCENE: 프리즘으로 균일 그리드·광선 캐스터를 만들어 장면 해시별로 보관
// - RUN: 세대를 512개 청크로 나눠 계산하고, 청크 사이에 이벤트 루프에 양보해 CANCEL 메시지를 받는다
// - 진행률은 최대 10Hz, 결과 배열은 transfer로 넘긴다

import { buildingCellMask, fillGroundShadow, type GroundGridSpec } from '../domain/ground/groundShadow';
import { createPrism, type Prism } from '../domain/geometry/prism';
import { createRayCaster, type RayCaster } from '../domain/spatial/rayCast';
import { buildUniformGrid } from '../domain/spatial/uniformGrid';
import { cosineHemisphereSamples, fillSkyView } from '../domain/sunlight/skyView';
import { aggregateSunlight } from '../domain/sunlight/sunlight';
import { fillVisibilityMask, type UnitGeometry } from '../domain/sunlight/visibility';
import {
  CHUNK_UNITS,
  PROGRESS_INTERVAL_MS,
  type FromWorker,
  type GroundParams,
  type SkyViewParams,
  type PrismsDTO,
  type SunlightParams,
  type ToWorker,
} from './protocol';

export type PostFn = (message: FromWorker, transfer?: Transferable[]) => void;

interface WorkerScene {
  caster: RayCaster;
  prisms: Prism[];
  /** 지면 그림자 격자별 건물 마스크 (같은 격자로 여러 번 계산할 때 재사용) */
  groundMask?: { key: string; mask: Uint8Array };
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

  /** 지면 셀 청크 크기 — 셀 하나가 K개 광선이라 세대 청크와 비슷한 시간 */
  const GROUND_CHUNK = 2048;

  async function runGround(jobId: number, scene: WorkerScene, params: GroundParams, from: number, to: number) {
    const started = performance.now();
    const spec: GroundGridSpec = params;
    const key = [spec.originX, spec.originZ, spec.cellSize, spec.cols, spec.rows].join(',');
    if (scene.groundMask?.key !== key) scene.groundMask = { key, mask: buildingCellMask(spec, scene.prisms) };
    const { mask } = scene.groundMask;
    const out = new Float32Array(to - from);
    let rays = 0;
    let lastProgress = 0;
    for (let c = from; c < to; c += GROUND_CHUNK) {
      if (cancelled.has(jobId)) {
        cancelled.delete(jobId);
        post({ type: 'CANCELLED', jobId });
        return;
      }
      const end = Math.min(to, c + GROUND_CHUNK);
      rays += fillGroundShadow(
        spec,
        mask,
        scene.caster,
        params.directions,
        params.stepCount,
        params.stepMinutes,
        c,
        end,
        out.subarray(c - from),
      );
      const now = performance.now();
      if (now - lastProgress >= PROGRESS_INTERVAL_MS || end === to) {
        lastProgress = now;
        post({ type: 'PROGRESS', jobId, done: end - from, total: to - from });
      }
      await yieldToEventLoop();
    }
    if (cancelled.has(jobId)) {
      cancelled.delete(jobId);
      post({ type: 'CANCELLED', jobId });
      return;
    }
    post(
      {
        type: 'RESULT',
        jobId,
        kind: 'ground',
        payload: { from, to, shadowMinutes: out, rays, elapsedMs: performance.now() - started },
      },
      [out.buffer],
    );
  }

  /** 천공률 청크 — 세대 하나가 N(256)개 광선이라 일조보다 작게 */
  const SKY_CHUNK = 128;

  async function runSkyView(jobId: number, scene: WorkerScene, params: SkyViewParams, from: number, to: number) {
    const started = performance.now();
    const samples = cosineHemisphereSamples(params.sampleCount);
    const out = new Float32Array(to - from);
    let rays = 0;
    let lastProgress = 0;
    for (let c = from; c < to; c += SKY_CHUNK) {
      if (cancelled.has(jobId)) {
        cancelled.delete(jobId);
        post({ type: 'CANCELLED', jobId });
        return;
      }
      const end = Math.min(to, c + SKY_CHUNK);
      rays += fillSkyView(
        scene.units.positions,
        scene.units.normals,
        c,
        end,
        samples,
        scene.caster,
        out.subarray(c - from),
      );
      const now = performance.now();
      if (now - lastProgress >= PROGRESS_INTERVAL_MS || end === to) {
        lastProgress = now;
        post({ type: 'PROGRESS', jobId, done: end - from, total: to - from });
      }
      await yieldToEventLoop();
    }
    if (cancelled.has(jobId)) {
      cancelled.delete(jobId);
      post({ type: 'CANCELLED', jobId });
      return;
    }
    post(
      {
        type: 'RESULT',
        jobId,
        kind: 'skyView',
        payload: { from, to, svf: out, rays, elapsedMs: performance.now() - started },
      },
      [out.buffer],
    );
  }

  async function handle(message: ToWorker): Promise<void> {
    switch (message.type) {
      case 'INIT_SCENE': {
        const { scene } = message;
        const prisms = prismsFromDTO(scene.prisms);
        const grid = buildUniformGrid(prisms, message.gridCellSize);
        scenes.set(message.sceneHash, {
          caster: createRayCaster(grid),
          prisms,
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
        const limit = message.kind === 'ground' ? message.params.cols * message.params.rows : scene.unitCount;
        if (from < 0 || to > limit || from > to) {
          post({ type: 'ERROR', jobId: message.jobId, message: `세대 범위가 잘못되었습니다 (${from}–${to})` });
          return;
        }
        try {
          if (message.kind === 'ground') await runGround(message.jobId, scene, message.params, from, to);
          else if (message.kind === 'skyView') await runSkyView(message.jobId, scene, message.params, from, to);
          else await runSunlight(message.jobId, scene, message.params, from, to);
        } catch (err) {
          post({ type: 'ERROR', jobId: message.jobId, message: err instanceof Error ? err.message : String(err) });
        }
        return;
      }
    }
  }

  return { handle };
}
