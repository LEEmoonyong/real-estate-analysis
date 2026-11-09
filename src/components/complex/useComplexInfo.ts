// [요구사항: Hooks] 커스텀 훅 — 실거래 단지 이름 → 공동주택 단지 목록과 연결 → 기본정보(세대수·동수·난방 등)
// useEffect(AbortController) + useState. 단지 정보 탭과 단지 비교 화면이 같이 쓴다.
// (공공데이터포털 개발 계정은 기본정보 API 하루 한도가 작아 한 단지씩만 부르고, 응답은 클라이언트가 캐시한다)
import { useEffect, useState } from 'react';
import { getComplexes, getComplexInfo } from '../../data/realestate/realestateClient';
import { matchComplex, type MatchResult } from '../../domain/realestate/match';
import type { AptComplexInfo } from '../../domain/realestate/types';

export type ComplexInfoState =
  | { status: 'loading' }
  | { status: 'not-found'; searched: string }
  | { status: 'error'; message: string }
  | { status: 'ready'; info: AptComplexInfo; match: MatchResult };

/**
 * @param lawd 시군구 코드
 * @param name 실거래 단지 이름 ('' 이면 찾지 않음)
 */
export function useComplexInfo(lawd: string, name: string, umdName: string, jibun: string): ComplexInfoState {
  const [state, setState] = useState<ComplexInfoState>({ status: 'loading' });

  useEffect(() => {
    // 시군구를 아직 모르면 기다린다 (비교 화면: 단지 시세를 먼저 불러온 뒤)
    if (!lawd) {
      setState({ status: 'loading' });
      return;
    }
    if (!name) {
      setState({ status: 'not-found', searched: '' });
      return;
    }
    const controller = new AbortController();
    setState({ status: 'loading' });
    void (async () => {
      try {
        const list = await getComplexes(lawd, controller.signal);
        const refs = list.map((c) => ({
          kaptCode: c.kaptCode,
          name: c.name,
          dong: c.dong,
          jibun: '',
          sigungu: c.sigungu,
        }));
        const match = name ? matchComplex({ aptName: name, umdName, jibun }, refs) : null;
        if (!match) {
          setState({ status: 'not-found', searched: name });
          return;
        }
        const info = await getComplexInfo(match.kaptCode, controller.signal);
        setState({ status: 'ready', info, match });
      } catch (e) {
        if (controller.signal.aborted) return;
        setState({ status: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => controller.abort();
  }, [lawd, name, umdName, jibun]);

  return state;
}
