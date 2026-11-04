// localStorage 스키마 (PLAN.md 6.5) — 키마다 버전을 두고 { v, data } 형태로 저장한다.
import { STORAGE_PREFIX } from '../../config/constants';

export interface StoredEnvelope<T> {
  v: number;
  data: T;
}

export const STORAGE_KEYS = {
  favorites: `${STORAGE_PREFIX}favorites`,
  recentSearches: `${STORAGE_PREFIX}recentSearches`,
  corrections: `${STORAGE_PREFIX}corrections`,
  dongAssignments: `${STORAGE_PREFIX}dongAssignments`,
  settings: `${STORAGE_PREFIX}settings`,
  onboarding: `${STORAGE_PREFIX}onboarding`,
} as const;

export type Migration = (oldData: unknown, fromVersion: number) => unknown;

export type ReadResult<T> = { ok: true; value: T } | { ok: false; reason: 'missing' | 'corrupt' | 'unknown-version' };

/**
 * 저장된 문자열을 해석한다. React와 무관한 순수 함수라 단위 테스트한다.
 * - 버전이 낮으면 migrate로 변환, 높으면(미래 버전) 사용하지 않는다.
 * - validate가 false면 손상으로 본다.
 */
export function parseStored<T>(
  raw: string | null,
  version: number,
  validate: (data: unknown) => data is T,
  migrate?: Migration,
): ReadResult<T> {
  if (raw === null) return { ok: false, reason: 'missing' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
  if (typeof parsed !== 'object' || parsed === null || !('v' in parsed) || !('data' in parsed)) {
    return { ok: false, reason: 'corrupt' };
  }
  const { v, data } = parsed as StoredEnvelope<unknown>;
  if (typeof v !== 'number' || v > version) return { ok: false, reason: 'unknown-version' };
  const upgraded = v < version && migrate ? migrate(data, v) : data;
  return validate(upgraded) ? { ok: true, value: upgraded } : { ok: false, reason: 'corrupt' };
}

export function serializeStored<T>(data: T, version: number): string {
  const envelope: StoredEnvelope<T> = { v: version, data };
  return JSON.stringify(envelope);
}

// ---- 공용 검증기 ----------------------------------------------------------

export const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

export const isArrayOf =
  <T>(guard: (x: unknown) => x is T) =>
  (x: unknown): x is T[] =>
    Array.isArray(x) && x.every(guard);

export const isRecordOf =
  <T>(guard: (x: unknown) => x is T) =>
  (x: unknown): x is Record<string, T> =>
    isRecord(x) && Object.values(x).every(guard);
