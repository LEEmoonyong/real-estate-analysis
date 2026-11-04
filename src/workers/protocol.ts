// 메인 ↔ Worker 메시지 프로토콜 (PLAN.md 10.1)
// TypedArray로 주고받아 구조화 복제 비용을 줄이고, 결과는 transfer로 넘긴다.

import type { SunlightCriteria } from '../domain/types';

/** 프리즘 목록을 평탄화한 형태 */
export interface PrismsDTO {
  /** 모든 링의 (x, z)를 이어 붙인 배열 */
  rings: Float64Array;
  /** 건물 i의 링은 rings[offsets[i] .. offsets[i+1]) — 길이 B + 1 */
  offsets: Uint32Array;
  heights: Float64Array;
}

export interface SceneDTO {
  prisms: PrismsDTO;
  /** (x, y, z) × U */
  unitPositions: Float32Array;
  /** (nx, nz) × U */
  unitNormals: Float32Array;
  unitCount: number;
}

export interface SunlightParams {
  stepMinutes: number;
  startMinute: number;
  /** 칸 수 K */
  stepCount: number;
  /** (dx, dy, dz) × K */
  directions: Float32Array;
  criteria: SunlightCriteria;
}

/** 일조 계산의 부분 결과 (unitRange 하나) */
export interface SunlightPartDTO {
  from: number;
  to: number;
  /** (to − from) × K */
  mask: Uint8Array;
  totalMinutes: Uint16Array;
  windowTotalMinutes: Uint16Array;
  windowMaxContinuous: Uint16Array;
  meets: Uint8Array;
  /** 실제로 쏜 광선 수 */
  rays: number;
  elapsedMs: number;
}

/** 지면 그림자 계산 (PLAN.md 9.11) — 셀 범위로 나눠 병렬 처리 */
export interface GroundParams {
  originX: number;
  originZ: number;
  cellSize: number;
  cols: number;
  rows: number;
  stepMinutes: number;
  stepCount: number;
  /** 구간 칸의 태양 방향 (dx, dy, dz) × K */
  directions: Float32Array;
}

export interface GroundPartDTO {
  from: number;
  to: number;
  /** 셀별 그림자 시간 [분], 건물 안은 NaN */
  shadowMinutes: Float32Array;
  rays: number;
  elapsedMs: number;
}

/** 천공률 계산 (PLAN.md 9.9) — 날짜와 무관 */
export interface SkyViewParams {
  sampleCount: number;
}

export interface SkyViewPartDTO {
  from: number;
  to: number;
  svf: Float32Array;
  rays: number;
  elapsedMs: number;
}

export type WorkerJobKind = 'sunlight' | 'ground' | 'skyView';

type RunJob =
  | { kind: 'sunlight'; params: SunlightParams }
  | { kind: 'ground'; params: GroundParams }
  | { kind: 'skyView'; params: SkyViewParams };
export type ResultPayload =
  | { kind: 'sunlight'; payload: SunlightPartDTO }
  | { kind: 'ground'; payload: GroundPartDTO }
  | { kind: 'skyView'; payload: SkyViewPartDTO };

// 메인 → Worker
export type ToWorker =
  | { type: 'INIT_SCENE'; sceneHash: string; scene: SceneDTO; gridCellSize: number }
  | ({
      type: 'RUN';
      jobId: number;
      sceneHash: string;
      /** 일조: 세대 범위, 지면 그림자: 셀 범위 */
      unitRange: [number, number];
    } & RunJob)
  | { type: 'CANCEL'; jobId: number }
  | { type: 'DISPOSE_SCENE'; sceneHash: string };

// Worker → 메인
export type FromWorker =
  | { type: 'READY'; sceneHash: string }
  | { type: 'PROGRESS'; jobId: number; done: number; total: number }
  | ({ type: 'RESULT'; jobId: number } & ResultPayload)
  | { type: 'CANCELLED'; jobId: number }
  | { type: 'ERROR'; jobId: number | null; message: string };

/** 청크 크기 — 청크 사이에서 메시지(취소)를 받는다 */
export const CHUNK_UNITS = 512;
/** 진행률 메시지 최소 간격 [ms] (최대 10Hz) */
export const PROGRESS_INTERVAL_MS = 100;
