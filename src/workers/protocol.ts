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

export type WorkerJobKind = 'sunlight';

// 메인 → Worker
export type ToWorker =
  | { type: 'INIT_SCENE'; sceneHash: string; scene: SceneDTO; gridCellSize: number }
  | {
      type: 'RUN';
      jobId: number;
      sceneHash: string;
      kind: WorkerJobKind;
      params: SunlightParams;
      unitRange: [number, number];
    }
  | { type: 'CANCEL'; jobId: number }
  | { type: 'DISPOSE_SCENE'; sceneHash: string };

// Worker → 메인
export type FromWorker =
  | { type: 'READY'; sceneHash: string }
  | { type: 'PROGRESS'; jobId: number; done: number; total: number }
  | { type: 'RESULT'; jobId: number; kind: WorkerJobKind; payload: SunlightPartDTO }
  | { type: 'CANCELLED'; jobId: number }
  | { type: 'ERROR'; jobId: number | null; message: string };

/** 청크 크기 — 청크 사이에서 메시지(취소)를 받는다 */
export const CHUNK_UNITS = 512;
/** 진행률 메시지 최소 간격 [ms] (최대 10Hz) */
export const PROGRESS_INTERVAL_MS = 100;
