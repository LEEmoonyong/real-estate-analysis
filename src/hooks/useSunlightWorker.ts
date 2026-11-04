// [요구사항: Hooks] 커스텀 훅 — Worker 풀로 세대별 일조를 계산하고 결과를 SimulationContext에 넣는다 (PLAN.md 10장)
// - useEffect: 풀 생성 / 언마운트 시 종료(terminate), 장면 전송, 날짜·장면·설정이 바뀌면 이전 작업 취소 후 재계산
// - useRef: 풀·큐·캐시·장면 준비 promise·jobId (리렌더와 무관한 값)
// - 같은 장면·날짜·설정이면 캐시 결과를 바로 쓴다
import { useEffect, useRef } from 'react';
import { useSceneData } from '../contexts/SceneDataContext';
import { useSettings } from '../contexts/SettingsContext';
import { useSimulation, useSimulationDispatch } from '../contexts/SimulationContext';
import { useTime } from '../contexts/TimeContext';
import { criteriaKey } from '../domain/sunlight/criteria';
import { computeSunSteps } from '../domain/sunlight/sunSteps';
import { DEFAULT_CELL_SIZE_M } from '../domain/spatial/uniformGrid';
import { JobQueue } from '../workers/jobQueue';
import { LruCache } from '../workers/resultCache';
import { mergeSunlightParts, toSceneDTO, type SunlightOutcome } from '../workers/sceneTransfer';
import { JobCancelledError, poolSizeFor, WorkerPool } from '../workers/workerPool';

function createSimulationWorker(): Worker {
  return new Worker(new URL('../workers/simulation.worker.ts', import.meta.url), { type: 'module' });
}

export interface SunlightWorkerInfo {
  workers: number;
}

export function useSunlightWorker(): SunlightWorkerInfo {
  const { scene, buildings, units, sceneHash } = useSceneData();
  const { date } = useTime();
  const { settings } = useSettings();
  const { phase } = useSimulation();
  const dispatch = useSimulationDispatch();

  const poolRef = useRef<WorkerPool | null>(null);
  const queueRef = useRef<JobQueue | null>(null);
  const cacheRef = useRef(new LruCache<SunlightOutcome>(24));
  const sceneReadyRef = useRef<{ hash: string; ready: Promise<void> } | null>(null);
  const jobIdRef = useRef(0);
  const sizeRef = useRef(0);

  // 풀은 앱 수명 동안 하나 — 언마운트 시 모든 Worker 종료
  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    const size = poolSizeFor(navigator.hardwareConcurrency, isMobile);
    const pool = new WorkerPool(createSimulationWorker, size);
    const queue = new JobQueue();
    poolRef.current = pool;
    queueRef.current = queue;
    sizeRef.current = size;
    return () => {
      queue.cancelAll();
      pool.dispose();
      poolRef.current = null;
      queueRef.current = null;
      sceneReadyRef.current = null;
    };
  }, []);

  const sceneReady = phase === 'calculating' || phase === 'done';
  const place = scene?.place;
  const stepMinutes = settings.stepMinutes;
  const critKey = criteriaKey(settings.criteria);
  // 기준 객체는 렌더마다 새로 읽히므로 effect 안에서는 ref로 최신 값을 쓴다
  const criteriaRef = useRef(settings.criteria);
  criteriaRef.current = settings.criteria;

  useEffect(() => {
    const pool = poolRef.current;
    const queue = queueRef.current;
    if (!pool || !queue || !sceneReady || !place || units.count === 0) return;

    const cacheKey = [sceneHash, place.lat.toFixed(5), place.lng.toFixed(5), date, stepMinutes, critKey].join('|');
    const jobId = ++jobIdRef.current;
    dispatch({ type: 'JOB_STARTED', kind: 'sunlight', jobId, total: units.count });

    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      dispatch({ type: 'RESULT', kind: 'sunlight', jobId, payload: { ...cached, elapsedMs: 0, fromCache: true } });
      return;
    }

    // 장면이 바뀌었으면 모든 Worker에 새 장면을 보낸다 (작업보다 먼저)
    if (sceneReadyRef.current?.hash !== sceneHash) {
      queue.cancelAll();
      sceneReadyRef.current = {
        hash: sceneHash,
        ready: pool.initScene(sceneHash, toSceneDTO(buildings, units), DEFAULT_CELL_SIZE_M),
      };
    }
    const ready = sceneReadyRef.current.ready;
    const criteria = criteriaRef.current;
    const started = performance.now();

    const result = queue.submit('sunlight', () => {
      let cancelled = false;
      const promise = (async () => {
        await ready;
        if (cancelled) throw new JobCancelledError();
        const steps = computeSunSteps(place.lat, place.lng, date, stepMinutes);
        const params = {
          stepMinutes,
          startMinute: steps.startMinute,
          stepCount: steps.count,
          directions: steps.directions,
          criteria,
        };
        const parts = await pool.runSunlight({
          jobId,
          sceneHash,
          params,
          unitCount: units.count,
          onProgress: (done, total) => dispatch({ type: 'PROGRESS', kind: 'sunlight', jobId, done, total }),
        });
        const merged = mergeSunlightParts(parts, units.count, steps.count);
        const outcome: SunlightOutcome = {
          ...merged,
          date,
          stepMinutes,
          startMinute: steps.startMinute,
          steps: steps.count,
          sceneHash,
          unitCount: units.count,
          elapsedMs: performance.now() - started,
          workers: pool.size,
          fromCache: false,
          sunUp: Uint8Array.from({ length: steps.count }, (_, k) => (steps.directions[k * 3 + 1]! > 0 ? 1 : 0)),
        };
        return outcome;
      })();
      return {
        promise,
        cancel: () => {
          cancelled = true;
          pool.cancel(jobId);
        },
      };
    });

    result.then(
      (outcome) => {
        cacheRef.current.set(cacheKey, outcome);
        dispatch({ type: 'RESULT', kind: 'sunlight', jobId, payload: outcome });
      },
      (error: unknown) => {
        if (error instanceof JobCancelledError) {
          dispatch({ type: 'JOB_CANCELLED', kind: 'sunlight', jobId });
          return;
        }
        dispatch({
          type: 'JOB_FAILED',
          kind: 'sunlight',
          jobId,
          message: error instanceof Error ? error.message : String(error),
        });
      },
    );

    // 입력이 바뀌거나 언마운트되면 이 작업 취소 (다음 effect가 새 작업을 넣는다)
    return () => queue.cancel('sunlight');
  }, [sceneReady, sceneHash, buildings, units, place, date, stepMinutes, critKey, dispatch]);

  return { workers: sizeRef.current };
}
