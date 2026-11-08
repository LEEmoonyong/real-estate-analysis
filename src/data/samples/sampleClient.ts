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

/** 샘플 파일 캐시 — 한 번 받은 샘플은 네트워크가 끊겨도 다시 보여 줄 수 있다 */
const sampleCache = new Map<string, Promise<{ sample: SampleFile; buildings: RawBuilding[] }>>();

export function loadSample(
  entry: SampleIndexEntry,
  signal?: AbortSignal,
): Promise<{ sample: SampleFile; buildings: RawBuilding[] }> {
  let promise = sampleCache.get(entry.file);
  if (!promise) {
    // 캐시에 넣는 요청은 취소 신호와 묶지 않는다 (호출한 쪽이 취소되면 결과만 버린다)
    promise = fetch(`${BASE}${entry.file}`)
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error(`샘플 파일을 불러오지 못했습니다 (${res.status}).`)),
      )
      .then((body: unknown) => {
        if (!isSampleFile(body)) throw new Error('샘플 파일 형식이 올바르지 않습니다.');
        return { sample: body, buildings: body.buildings };
      });
    promise.catch(() => sampleCache.delete(entry.file)); // 실패하면 다음에 다시 시도
    sampleCache.set(entry.file, promise);
  }
  if (!signal) return promise;
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    promise.then(resolve, reject);
  });
}

/**
 * 모든 샘플을 미리 받아 둔다 — 나중에 네트워크가 끊겨도(오프라인) 샘플 지역은 계속 쓸 수 있게.
 * 첫 화면 표시 뒤 여유 시간에 호출한다.
 */
export async function prefetchSamples(): Promise<void> {
  const index = await loadSampleIndex();
  await Promise.allSettled(index.map((e) => loadSample(e)));
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

/** 샘플 지역 반경 [m] — 이보다 먼 곳은 샘플로 대신 보여 주면 엉뚱한 단지가 되므로 쓰지 않는다 */
export const SAMPLE_COVER_M = 1_500;

/** 이 위치가 덮이는 샘플 (가장 가까운 샘플 중심이 SAMPLE_COVER_M 안일 때만) */
export function coveringSample(index: readonly SampleIndexEntry[], point: LatLng): SampleIndexEntry | undefined {
  const e = nearestSample(index, point);
  if (!e) return undefined;
  const dy = (e.center.lat - point.lat) * 111_320;
  const dx = (e.center.lng - point.lng) * 111_320 * Math.cos((point.lat * Math.PI) / 180);
  return Math.hypot(dx, dy) <= SAMPLE_COVER_M ? e : undefined;
}
