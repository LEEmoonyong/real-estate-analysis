// [요구사항: Hooks] 커스텀 훅 — 주소·단지명 → 좌표 (useState + useRef(AbortController) + useEffect cleanup)
// [요구사항: 데이터 처리] 외부 API(카카오·V-World 지오코딩) / 샘플 모드에서는 로컬 샘플 목록 검색
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiClientError, isAbortError } from '../data/apiClient';
import { geocode, type GeoResult } from '../data/geocode/geocodeClient';
import { loadSampleIndex, matchSamples } from '../data/samples/sampleClient';
import type { SampleIndexEntry } from '../data/samples/sampleSchema';

export type GeocodeStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export type SearchCandidate = { type: 'place'; result: GeoResult } | { type: 'sample'; sample: SampleIndexEntry };

export interface GeocodeState {
  status: GeocodeStatus;
  candidates: SearchCandidate[];
  provider: 'kakao' | 'vworld' | 'sample' | null;
  error: string | null;
}

const INITIAL: GeocodeState = { status: 'idle', candidates: [], provider: null, error: null };

const ERROR_MESSAGES: Partial<Record<string, string>> = {
  NO_KEY: '지오코딩 API 키가 없어 검색할 수 없습니다. 샘플 지역을 이용해 주세요.',
  QUOTA: '검색 API 사용량을 초과했습니다. 잠시 후 다시 시도해 주세요.',
  TIMEOUT: '검색 응답이 늦어지고 있습니다. 다시 시도해 주세요.',
  NETWORK: '네트워크에 연결할 수 없습니다.',
};

export function useGeocode(mode: 'live' | 'sample' | 'checking') {
  const [state, setState] = useState<GeocodeState>(INITIAL);
  const controllerRef = useRef<AbortController | null>(null);

  // 언마운트 시 진행 중 요청 취소
  useEffect(() => () => controllerRef.current?.abort(), []);

  const search = useCallback(
    async (rawQuery: string) => {
      const query = rawQuery.trim();
      if (query.length < 2) {
        setState({ ...INITIAL, status: 'error', error: '검색어를 2글자 이상 입력해 주세요.' });
        return;
      }
      controllerRef.current?.abort(); // 이전 검색 취소
      const controller = new AbortController();
      controllerRef.current = controller;
      setState((s) => ({ ...s, status: 'loading', error: null }));

      // 샘플 후보는 모드와 관계없이 함께 보여 준다 (API 키 없이도 체험 가능)
      const samplePromise = loadSampleIndex()
        .then((index) => matchSamples(index, query))
        .catch(() => [] as SampleIndexEntry[]);

      try {
        const sampleMatches = await samplePromise;
        const sampleCandidates: SearchCandidate[] = sampleMatches.map((sample) => ({ type: 'sample', sample }));

        if (mode !== 'live') {
          if (controller.signal.aborted) return;
          setState({
            status: sampleCandidates.length ? 'success' : 'empty',
            candidates: sampleCandidates,
            provider: 'sample',
            error: sampleCandidates.length
              ? null
              : '샘플 모드에서는 샘플 지역(잠실·마린시티·세종)만 검색할 수 있습니다.',
          });
          return;
        }

        const { provider, results } = await geocode(query, controller.signal);
        const candidates: SearchCandidate[] = [
          ...results.map((result): SearchCandidate => ({ type: 'place', result })),
          ...sampleCandidates,
        ];
        setState({
          status: candidates.length ? 'success' : 'empty',
          candidates,
          provider,
          error: candidates.length ? null : `'${query}'에 대한 검색 결과가 없습니다.`,
        });
      } catch (err) {
        if (isAbortError(err)) return;
        const sampleCandidates = (await samplePromise).map((sample): SearchCandidate => ({ type: 'sample', sample }));
        const message =
          err instanceof ApiClientError ? (ERROR_MESSAGES[err.code] ?? err.message) : '검색 중 오류가 발생했습니다.';
        setState({ status: 'error', candidates: sampleCandidates, provider: null, error: message });
      }
    },
    [mode],
  );

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    setState(INITIAL);
  }, []);

  return { ...state, search, reset };
}
