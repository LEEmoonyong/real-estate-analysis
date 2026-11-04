// 샘플 데이터 로더 — public/samples 정적 파일 (API 키·네트워크 API 없이 동작)
// [요구사항: 데이터 처리] 로컬 데이터(샘플 JSON)
import type { LatLng, RawBuilding } from '../../domain/types';
import { isSampleFile, isSampleIndex, type SampleFile, type SampleIndexEntry } from './sampleSchema';

const BASE = `${import.meta.env?.BASE_URL ?? '/'}samples/`;

let indexPromise: Promise<SampleIndexEntry[]> | null = null;

export function loadSampleIndex(): Promise<SampleIndexEntry[]> {
  indexPromise ??= fetch(`${BASE}index.json`)
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`샘플 목록 ${res.status}`))))
    .then((body: unknown) => {
      if (!isSampleIndex(body)) throw new Error('샘플 목록 형식이 올바르지 않습니다.');
      return body;
    })
    .catch((err: unknown) => {
      indexPromise = null; // 다음 호출에서 다시 시도
      throw err;
    });
  return indexPromise;
}

export async function loadSample(
  entry: SampleIndexEntry,
  signal?: AbortSignal,
): Promise<{ sample: SampleFile; buildings: RawBuilding[] }> {
  const res = await fetch(`${BASE}${entry.file}`, signal ? { signal } : {});
  if (!res.ok) throw new Error(`샘플 파일을 불러오지 못했습니다 (${res.status}).`);
  const body: unknown = await res.json();
  if (!isSampleFile(body)) throw new Error('샘플 파일 형식이 올바르지 않습니다.');
  return { sample: body, buildings: body.buildings };
}

/** 검색어가 샘플 별칭과 맞는 샘플 목록 (샘플 모드 검색) */
export function matchSamples(index: readonly SampleIndexEntry[], query: string): SampleIndexEntry[] {
  const q = query.replace(/\s+/g, '').toLowerCase();
  if (!q) return [];
  return index.filter(
    (e) =>
      e.name.replace(/\s+/g, '').toLowerCase().includes(q) ||
      e.aliases.some((a) => {
        const alias = a.replace(/\s+/g, '').toLowerCase();
        return alias.includes(q) || q.includes(alias);
      }),
  );
}

/** 가장 가까운 샘플 (실데이터 실패 시 대체 제안용) */
export function nearestSample(index: readonly SampleIndexEntry[], point: LatLng): SampleIndexEntry | undefined {
  const dist = (e: SampleIndexEntry) =>
    Math.hypot(e.center.lat - point.lat, (e.center.lng - point.lng) * Math.cos((point.lat * Math.PI) / 180));
  return [...index].sort((a, b) => dist(a) - dist(b))[0];
}
