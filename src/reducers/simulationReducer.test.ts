import { describe, expect, it } from 'vitest';
import {
  initialSimulationState,
  simulationReducer,
  type SimulationAction,
  type SimulationState,
} from './simulationReducer';

const run = (actions: SimulationAction[], from: SimulationState = initialSimulationState) =>
  actions.reduce(simulationReducer, from);

const toCalculating: SimulationAction[] = [
  { type: 'SEARCH_START', source: 'vworld' },
  { type: 'DATA_LOADED' },
  { type: 'SCENE_READY' },
];

describe('simulationReducer — 정상 흐름', () => {
  it('idle → loading → building → calculating → done', () => {
    let s = simulationReducer(initialSimulationState, { type: 'SEARCH_START', source: 'vworld' });
    expect(s.phase).toBe('loading');
    expect(s.loadingSource).toBe('vworld');
    s = simulationReducer(s, { type: 'DATA_LOADED' });
    expect(s.phase).toBe('building');
    s = simulationReducer(s, { type: 'SCENE_READY' });
    expect(s.phase).toBe('calculating');
    s = run(
      [
        { type: 'JOB_STARTED', kind: 'sunlight', jobId: 1, total: 100 },
        { type: 'PROGRESS', kind: 'sunlight', jobId: 1, done: 50, total: 100 },
      ],
      s,
    );
    expect(s.progress.sunlight).toEqual({ jobId: 1, done: 50, total: 100 });
    s = simulationReducer(s, { type: 'RESULT', kind: 'sunlight', jobId: 1, payload: 'R' });
    expect(s.phase).toBe('done');
    expect(s.results.sunlight).toBe('R');
    expect(s.progress.sunlight).toBeUndefined();
  });

  it('소스 대체 중에도 loading을 유지하고 소스만 바뀐다', () => {
    const s = run([
      { type: 'SEARCH_START', source: 'vworld' },
      { type: 'SOURCE_FALLBACK', source: 'osm' },
    ]);
    expect(s).toMatchObject({ phase: 'loading', loadingSource: 'osm' });
  });

  it('새 검색은 이전 결과를 모두 지운다', () => {
    const done = run([
      ...toCalculating,
      { type: 'JOB_STARTED', kind: 'sunlight', jobId: 1, total: 1 },
      { type: 'RESULT', kind: 'sunlight', jobId: 1, payload: 'R' },
    ]);
    const s = simulationReducer(done, { type: 'SEARCH_START', source: 'sample' });
    expect(s.results).toEqual({});
    expect(s.phase).toBe('loading');
  });
});

describe('simulationReducer — 오류', () => {
  it('데이터 실패 → error, RETRY → loading', () => {
    const s = run([
      { type: 'SEARCH_START', source: 'vworld' },
      { type: 'DATA_FAILED', message: 'x' },
    ]);
    expect(s).toMatchObject({ phase: 'error', error: { kind: 'data' } });
    expect(simulationReducer(s, { type: 'RETRY' }).phase).toBe('loading');
  });

  it('건물 0개 → no-buildings 오류', () => {
    const s = run([{ type: 'SEARCH_START', source: 'vworld' }, { type: 'DATA_LOADED' }, { type: 'NO_BUILDINGS' }]);
    expect(s.error?.kind).toBe('no-buildings');
  });

  it('필수 계산 실패는 error, 재시도하면 장면을 유지한 채 calculating', () => {
    const s = run([
      ...toCalculating,
      { type: 'JOB_STARTED', kind: 'sunlight', jobId: 1, total: 1 },
      { type: 'JOB_FAILED', kind: 'sunlight', jobId: 1, message: 'boom' },
    ]);
    expect(s).toMatchObject({ phase: 'error', error: { kind: 'calculation', message: 'boom' } });
    expect(simulationReducer(s, { type: 'RETRY' }).phase).toBe('calculating');
  });

  it('부가 계산 실패는 phase를 바꾸지 않는다 (부분 실패 허용)', () => {
    const s = run([
      ...toCalculating,
      { type: 'JOB_STARTED', kind: 'sunlight', jobId: 1, total: 1 },
      { type: 'RESULT', kind: 'sunlight', jobId: 1, payload: 'R' },
      { type: 'JOB_STARTED', kind: 'skyView', jobId: 2, total: 1 },
      { type: 'JOB_FAILED', kind: 'skyView', jobId: 2, message: 'svf 실패' },
    ]);
    expect(s.phase).toBe('done');
    expect(s.jobErrors.skyView).toBe('svf 실패');
    expect(s.results.sunlight).toBe('R');
  });
});

describe('simulationReducer — 취소·무효화', () => {
  it('오래된 jobId의 진행률·결과는 무시한다 (재계산 경쟁 방지)', () => {
    const s = run([
      ...toCalculating,
      { type: 'JOB_STARTED', kind: 'sunlight', jobId: 1, total: 10 },
      { type: 'JOB_STARTED', kind: 'sunlight', jobId: 2, total: 10 },
      { type: 'PROGRESS', kind: 'sunlight', jobId: 1, done: 9, total: 10 },
      { type: 'RESULT', kind: 'sunlight', jobId: 1, payload: 'old' },
    ]);
    expect(s.progress.sunlight).toEqual({ jobId: 2, done: 0, total: 10 });
    expect(s.results.sunlight).toBeUndefined();
    expect(s.phase).toBe('calculating');
  });

  it('날짜 변경은 일조 결과만 무효화하고 천공률은 유지한다', () => {
    const done = run([
      ...toCalculating,
      { type: 'JOB_STARTED', kind: 'sunlight', jobId: 1, total: 1 },
      { type: 'RESULT', kind: 'sunlight', jobId: 1, payload: 'S' },
      { type: 'JOB_STARTED', kind: 'skyView', jobId: 2, total: 1 },
      { type: 'RESULT', kind: 'skyView', jobId: 2, payload: 'V' },
    ]);
    const s = simulationReducer(done, { type: 'PARAMS_CHANGED', invalidate: ['sunlight', 'irradiance'] });
    expect(s.phase).toBe('calculating');
    expect(s.results).toEqual({ skyView: 'V' });
  });

  it('취소되면 진행률에서 제거된다', () => {
    const s = run([
      ...toCalculating,
      { type: 'JOB_STARTED', kind: 'ground', jobId: 3, total: 5 },
      { type: 'JOB_CANCELLED', kind: 'ground', jobId: 3 },
    ]);
    expect(s.progress.ground).toBeUndefined();
  });
});

describe('simulationReducer — 잘못된 전이 무시', () => {
  it.each<SimulationAction>([
    { type: 'DATA_LOADED' },
    { type: 'SCENE_READY' },
    { type: 'SOURCE_FALLBACK', source: 'osm' },
    { type: 'RETRY' },
    { type: 'PARAMS_CHANGED', invalidate: ['sunlight'] },
    { type: 'JOB_STARTED', kind: 'sunlight', jobId: 1, total: 1 },
  ])('idle에서 %o 는 상태를 바꾸지 않는다', (action) => {
    expect(simulationReducer(initialSimulationState, action)).toBe(initialSimulationState);
  });
});
