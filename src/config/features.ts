// 기능 플래그: 미완성 기능은 false로 두어 UI 진입점을 숨긴다 (PLAN.md 11장)
export const FEATURES = {
  dongHoSearch: true, // B1
  floorCompare: true, // B2
  sunPath: true, // B3
  heightCorrection: true, // B4
  favorites: true, // B5 (축소 대상 아님)
  onboarding: true, // B6 (축소 대상 아님)
  windowView: true, // C7
  groundShadow: true, // C8
  skyView: true, // C9
  irradiance: true, // C10
  seasonTimelapse: true, // C11
  virtualBuilding: true, // X6 가상 건물 영향 분석
} as const;

export type FeatureKey = keyof typeof FEATURES;
