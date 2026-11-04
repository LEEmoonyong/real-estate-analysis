// 태양 경로 색상·이름 — 3D 궤적(SunPathDome)과 토글 범례(SunInfoCard)가 함께 쓴다
import type { SunPathDay } from '../contexts/SettingsContext';

export const SUN_PATH_STYLE: Record<SunPathDay, { label: string; color: string }> = {
  today: { label: '선택한 날짜', color: '#f5a524' },
  winter: { label: '동지', color: '#3b82f6' },
  summer: { label: '하지', color: '#d1343a' },
  spring: { label: '춘분·추분', color: '#1f8a4c' },
};
