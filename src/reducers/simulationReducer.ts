// [요구사항: 상태관리] useReducer — 시뮬레이션 상태 머신 (PLAN.md 5.3)
// idle → loading → building → calculating → done / error
import type { JobKind } from '../domain/types';

export type SimulationPhase = 'idle' | 'loading' | 'building' | 'calculating' | 'done' | 'error';

export interface JobProgress {
  jobId: number;
  done: number;
  total: number;
}

export interface SimulationError {
  kind: 'data' | 'no-buildings' | 'calculation';
  message: string;
}

export interface SimulationState<R = Partial<Record<JobKind, unknown>>> {
  phase: SimulationPhase;
  /** 지금 데이터를 받고 있는 소스 (V-World → OSM → 샘플 순서로 대체) */
  loadingSource: 'vworld' | 'osm' | 'sample' | null;
  progress: Partial<Record<JobKind, JobProgress>>;
  results: R;
  error: SimulationError | null;
  /** 부가 계산 실패는 phase를 바꾸지 않고 여기에 기록한다 */
  jobErrors: Partial<Record<JobKind, string>>;
}

export type SimulationAction =
  | { type: 'SEARCH_START'; source: 'vworld' | 'osm' | 'sample' }
  | { type: 'SOURCE_FALLBACK'; source: 'osm' | 'sample' }
  | { type: 'DATA_LOADED' }
  | { type: 'DATA_FAILED'; message: string }
  | { type: 'NO_BUILDINGS' }
  | { type: 'SCENE_READY' }
  | { type: 'JOB_STARTED'; kind: JobKind; jobId: number; total: number }
  | { type: 'PROGRESS'; kind: JobKind; jobId: number; done: number; total: number }
  | { type: 'RESULT'; kind: JobKind; jobId: number; payload: unknown }
  | { type: 'JOB_CANCELLED'; kind: JobKind; jobId: number }
  | { type: 'JOB_FAILED'; kind: JobKind; jobId: number; message: string }
  | { type: 'PARAMS_CHANGED'; invalidate: JobKind[] }
  | { type: 'RETRY' }
  | { type: 'RESET' };

/** phase를 결정하는 필수 계산 */
export const REQUIRED_JOB: JobKind = 'sunlight';

export const initialSimulationState: SimulationState = {
  phase: 'idle',
  loadingSource: null,
  progress: {},
  results: {},
  error: null,
  jobErrors: {},
};

function without<T extends object>(obj: T, keys: readonly PropertyKey[]): T {
  const copy = { ...obj } as Record<PropertyKey, unknown>;
  for (const k of keys) delete copy[k];
  return copy as T;
}

/** 진행 중인 작업의 jobId와 다르면 오래된 메시지이므로 무시한다 */
function isCurrentJob(state: SimulationState, kind: JobKind, jobId: number): boolean {
  return state.progress[kind]?.jobId === jobId;
}

export function simulationReducer(state: SimulationState, action: SimulationAction): SimulationState {
  switch (action.type) {
    case 'SEARCH_START':
      return { ...initialSimulationState, phase: 'loading', loadingSource: action.source };

    case 'SOURCE_FALLBACK':
      if (state.phase !== 'loading') return state;
      return { ...state, loadingSource: action.source };

    case 'DATA_LOADED':
      if (state.phase !== 'loading') return state;
      return { ...state, phase: 'building', loadingSource: null };

    case 'DATA_FAILED':
      if (state.phase !== 'loading') return state;
      return { ...state, phase: 'error', loadingSource: null, error: { kind: 'data', message: action.message } };

    case 'NO_BUILDINGS':
      if (state.phase !== 'building' && state.phase !== 'loading') return state;
      return {
        ...state,
        phase: 'error',
        loadingSource: null,
        error: { kind: 'no-buildings', message: '이 위치 주변에서 건물 데이터를 찾지 못했습니다.' },
      };

    case 'SCENE_READY':
      if (state.phase !== 'building') return state;
      return { ...state, phase: 'calculating' };

    case 'JOB_STARTED': {
      if (state.phase !== 'calculating' && state.phase !== 'done') return state;
      const isRequired = action.kind === REQUIRED_JOB;
      return {
        ...state,
        phase: isRequired ? 'calculating' : state.phase,
        progress: { ...state.progress, [action.kind]: { jobId: action.jobId, done: 0, total: action.total } },
        results: isRequired ? without(state.results, [action.kind]) : state.results,
        jobErrors: without(state.jobErrors, [action.kind]),
      };
    }

    case 'PROGRESS':
      if (!isCurrentJob(state, action.kind, action.jobId)) return state;
      return {
        ...state,
        progress: { ...state.progress, [action.kind]: { jobId: action.jobId, done: action.done, total: action.total } },
      };

    case 'RESULT': {
      if (!isCurrentJob(state, action.kind, action.jobId)) return state;
      const next: SimulationState = {
        ...state,
        progress: without(state.progress, [action.kind]),
        results: { ...state.results, [action.kind]: action.payload },
      };
      return action.kind === REQUIRED_JOB ? { ...next, phase: 'done' } : next;
    }

    case 'JOB_CANCELLED':
      if (!isCurrentJob(state, action.kind, action.jobId)) return state;
      return { ...state, progress: without(state.progress, [action.kind]) };

    case 'JOB_FAILED': {
      if (!isCurrentJob(state, action.kind, action.jobId)) return state;
      const base = { ...state, progress: without(state.progress, [action.kind]) };
      if (action.kind === REQUIRED_JOB) {
        return { ...base, phase: 'error', error: { kind: 'calculation', message: action.message } };
      }
      // 부가 계산 실패는 전체 상태를 바꾸지 않는다 (부분 실패 허용)
      return { ...base, jobErrors: { ...state.jobErrors, [action.kind]: action.message } };
    }

    case 'PARAMS_CHANGED': {
      if (state.phase !== 'done' && state.phase !== 'calculating') return state;
      const invalidatesRequired = action.invalidate.includes(REQUIRED_JOB);
      return {
        ...state,
        phase: invalidatesRequired ? 'calculating' : state.phase,
        progress: without(state.progress, action.invalidate),
        results: without(state.results, action.invalidate),
      };
    }

    case 'RETRY':
      if (state.phase !== 'error') return state;
      // 데이터 단계 실패는 다시 불러오기, 계산 실패는 장면은 유지한 채 재계산
      return state.error?.kind === 'calculation'
        ? { ...state, phase: 'calculating', error: null }
        : { ...initialSimulationState, phase: 'loading' };

    case 'RESET':
      return initialSimulationState;
  }
}
