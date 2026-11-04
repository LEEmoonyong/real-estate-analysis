// [요구사항: Hooks] 커스텀 훅 — 데이터 소스 선택·대체·샘플 전환 (useEffect + AbortController + useRef 캐시)
// [요구사항: 데이터 처리] 외부 API(V-World·OSM) → 실패 시 로컬 샘플 JSON
//
// 대체 순서: V-World(키 있을 때) → OpenStreetMap → 가장 가까운 샘플
// - 소스가 "실패"하면 다음 소스로 넘어간다.
// - 소스가 성공했는데 건물이 0개면 그 지역에 데이터가 없는 것이므로 NO_BUILDINGS (샘플로 바꾸지 않는다).
import { useEffect, useRef, useState } from 'react';
import { DEFAULT_RADIUS_M } from '../config/constants';
import { isAbortError } from '../data/apiClient';
import { osmProvider, vworldProvider, type BuildingProvider } from '../data/providers/BuildingProvider';
import { loadSample, loadSampleIndex, nearestSample } from '../data/samples/sampleClient';
import type { SampleIndexEntry } from '../data/samples/sampleSchema';
import type { Place, RawBuilding } from '../domain/types';
import { useSceneData, useSceneDataActions } from '../contexts/SceneDataContext';
import { useSimulation, useSimulationDispatch } from '../contexts/SimulationContext';

export type BuildingsRequest =
  | { type: 'live'; place: Place; radiusM?: number; requestId: number }
  | { type: 'sample'; sample: SampleIndexEntry; requestId: number; reason?: string };

export interface BuildingsNotice {
  tone: 'info' | 'warning';
  message: string;
}

/** 같은 위치를 다시 검색하면 네트워크 요청 없이 재사용 */
const cacheKey = (provider: string, place: Place, radius: number) =>
  `${provider}:${place.lat.toFixed(5)},${place.lng.toFixed(5)}:${radius}`;

export function useBuildings(request: BuildingsRequest | null, keys: { vworld: boolean }) {
  const dispatch = useSimulationDispatch();
  const { phase } = useSimulation();
  const { buildings } = useSceneData();
  const { loadScene } = useSceneDataActions();
  const [notice, setNotice] = useState<BuildingsNotice | null>(null);
  const cacheRef = useRef(new Map<string, RawBuilding[]>());

  useEffect(() => {
    if (!request) return;
    const controller = new AbortController();
    const { signal } = controller;

    const loadSampleScene = async (entry: SampleIndexEntry) => {
      const { sample, buildings: raws } = await loadSample(entry, signal);
      loadScene({
        place: { name: sample.name, lat: sample.center.lat, lng: sample.center.lng },
        rawBuildings: raws,
        source: 'sample',
        notes: sample.notes,
      });
      dispatch({ type: 'DATA_LOADED' });
    };

    const run = async () => {
      if (request.type === 'sample') {
        dispatch({ type: 'SEARCH_START', source: 'sample' });
        setNotice(request.reason ? { tone: 'info', message: request.reason } : null);
        await loadSampleScene(request.sample);
        return;
      }

      const { place } = request;
      const radius = request.radiusM ?? DEFAULT_RADIUS_M;
      const providers: BuildingProvider[] = keys.vworld ? [vworldProvider, osmProvider] : [osmProvider];
      dispatch({ type: 'SEARCH_START', source: providers[0]!.id });
      setNotice(null);

      const failures: string[] = [];
      for (const [i, provider] of providers.entries()) {
        if (i > 0) dispatch({ type: 'SOURCE_FALLBACK', source: 'osm' });
        try {
          const key = cacheKey(provider.id, place, radius);
          const raws = cacheRef.current.get(key) ?? (await provider.fetch(place, radius, signal));
          cacheRef.current.set(key, raws);
          if (raws.length === 0) {
            dispatch({ type: 'DATA_LOADED' });
            loadScene({ place, rawBuildings: [], source: provider.id, notes: [] });
            return;
          }
          loadScene({ place, rawBuildings: raws, source: provider.id, notes: [] });
          if (failures.length) {
            setNotice({
              tone: 'warning',
              message: `${failures.join(', ')} 응답에 실패해 ${provider.label} 데이터를 사용합니다.`,
            });
          }
          dispatch({ type: 'DATA_LOADED' });
          return;
        } catch (err) {
          if (isAbortError(err)) throw err;
          failures.push(provider.label);
        }
      }

      // 모든 실데이터 소스 실패 → 가장 가까운 샘플로 자동 전환
      dispatch({ type: 'SOURCE_FALLBACK', source: 'sample' });
      const entry = nearestSample(await loadSampleIndex(), place);
      if (!entry) throw new Error('샘플 데이터를 찾을 수 없습니다.');
      await loadSampleScene(entry);
      setNotice({
        tone: 'warning',
        message: `건물 데이터를 불러오지 못해(${failures.join(', ')}) 가장 가까운 샘플 지역 '${entry.name}'을 표시합니다.`,
      });
    };

    run().catch((err: unknown) => {
      if (isAbortError(err)) return;
      dispatch({ type: 'DATA_FAILED', message: err instanceof Error ? err.message : String(err) });
    });

    // 새 요청이 오면 이전 요청은 취소된다
    return () => controller.abort();
  }, [request, keys.vworld, dispatch, loadScene]);

  // 장면 구성 결과에 따라 building → calculating / no-buildings
  useEffect(() => {
    if (phase !== 'building') return;
    dispatch(buildings.length > 0 ? { type: 'SCENE_READY' } : { type: 'NO_BUILDINGS' });
  }, [phase, buildings.length, dispatch]);

  return { notice, dismissNotice: () => setNotice(null) };
}
