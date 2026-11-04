// [요구사항: Hooks] 커스텀 훅 — 화면 구간과 CPU 코어 수로 렌더링 품질 프리셋을 고른다
// [요구사항: UI] 모바일은 그림자 해상도·픽셀 비율을 낮춰 발열·배터리를 줄인다
import { useMemo } from 'react';
import { QUALITY_PRESETS, type QualityPreset } from '../config/quality';
import { useBreakpoint } from './useBreakpoint';

export function useQuality(): QualityPreset {
  const breakpoint = useBreakpoint();
  return useMemo(() => {
    if (breakpoint === 'mobile') return QUALITY_PRESETS.low;
    if (breakpoint === 'tablet') return QUALITY_PRESETS.medium;
    // 데스크톱이라도 코어가 적은 기기(저가 노트북)는 한 단계 낮춘다
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
    return cores <= 4 ? QUALITY_PRESETS.medium : QUALITY_PRESETS.high;
  }, [breakpoint]);
}
