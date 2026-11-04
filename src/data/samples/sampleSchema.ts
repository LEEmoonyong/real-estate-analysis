// 샘플 데이터 스키마 (public/samples/*.json, PLAN.md 6.4)
import type { LatLng, RawBuilding } from '../../domain/types';
import { isRecord } from '../storage/schema';

export const SAMPLE_SCHEMA_VERSION = 1;

export interface SampleSource {
  provider: 'osm';
  license: string;
  attribution: string;
  fetchedAt: string;
}

export interface SampleFile {
  schemaVersion: number;
  id: string;
  name: string;
  center: LatLng;
  radiusM: number;
  source: SampleSource;
  searchAliases: string[];
  /** 시연용으로 보정한 항목 설명 (README·앱 안내에 표시) */
  notes: string[];
  buildings: (Omit<RawBuilding, 'source'> & { source: 'sample' })[];
}

export interface SampleIndexEntry {
  id: string;
  name: string;
  center: LatLng;
  file: string;
  aliases: string[];
  buildingCount: number;
}

const isLatLng = (x: unknown): x is LatLng =>
  isRecord(x) && typeof x.lat === 'number' && typeof x.lng === 'number';

const isLngLatRing = (x: unknown): x is [number, number][] =>
  Array.isArray(x) &&
  x.length >= 3 &&
  x.every((p) => Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === 'number' && Number.isFinite(v)));

const HEIGHT_SOURCES = ['measured', 'floors', 'default'];

export function isSampleBuilding(x: unknown): x is SampleFile['buildings'][number] {
  return (
    isRecord(x) &&
    typeof x.id === 'string' &&
    x.source === 'sample' &&
    isLngLatRing(x.footprint) &&
    Number.isInteger(x.floors) &&
    (x.floors as number) >= 1 &&
    (x.heightM === null || (typeof x.heightM === 'number' && x.heightM > 0)) &&
    HEIGHT_SOURCES.includes(x.heightSource as string) &&
    (x.dongNumber === undefined || typeof x.dongNumber === 'string')
  );
}

/** 샘플 파일 검증 — 실패하면 앱은 해당 샘플을 목록에서 숨긴다 */
export function isSampleFile(x: unknown): x is SampleFile {
  return (
    isRecord(x) &&
    x.schemaVersion === SAMPLE_SCHEMA_VERSION &&
    typeof x.id === 'string' &&
    typeof x.name === 'string' &&
    isLatLng(x.center) &&
    typeof x.radiusM === 'number' &&
    isRecord(x.source) &&
    Array.isArray(x.searchAliases) &&
    Array.isArray(x.notes) &&
    Array.isArray(x.buildings) &&
    x.buildings.length > 0 &&
    x.buildings.every(isSampleBuilding)
  );
}

export function isSampleIndex(x: unknown): x is SampleIndexEntry[] {
  return (
    Array.isArray(x) &&
    x.every(
      (e) =>
        isRecord(e) &&
        typeof e.id === 'string' &&
        typeof e.name === 'string' &&
        isLatLng(e.center) &&
        typeof e.file === 'string' &&
        Array.isArray(e.aliases),
    )
  );
}
