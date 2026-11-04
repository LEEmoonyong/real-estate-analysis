// 기기 등급별 렌더링 품질 프리셋 (PLAN.md 13.1)
// 계산 결과(세대 샘플 수 등)는 기기와 관계없이 같게 두고, 화면 해상도·그림자 품질만 바꾼다.

export type QualityLevel = 'low' | 'medium' | 'high';

export interface QualityPreset {
  level: QualityLevel;
  /** devicePixelRatio 상한 */
  maxDpr: number;
  /** 그림자 맵 한 변 [px] */
  shadowMapSize: number;
}

export const QUALITY_PRESETS: Record<QualityLevel, QualityPreset> = {
  low: { level: 'low', maxDpr: 1.5, shadowMapSize: 1024 },
  medium: { level: 'medium', maxDpr: 1.75, shadowMapSize: 2048 },
  high: { level: 'high', maxDpr: 2, shadowMapSize: 4096 },
};
