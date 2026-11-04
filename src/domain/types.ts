// [요구사항: 개발 언어] 도메인 모델 타입 (PLAN.md 부록 A)
// React·three.js에 의존하지 않는 순수 타입. Worker와 테스트에서도 그대로 사용한다.

export interface LatLng {
  lat: number;
  lng: number;
}

export type Vec3 = [number, number, number];

export type BuildingSource = 'vworld' | 'osm' | 'sample';

/** 높이 출처: 실측 높이 / 층수×층고 / 추정 기본값 / 사용자 보정 */
export type HeightSource = 'measured' | 'floors' | 'default' | 'user';

/** 데이터 소스에서 정규화된 건물 (로컬 좌표 변환 전) */
export interface RawBuilding {
  id: string;
  source: BuildingSource;
  /** [경도, 위도] 외곽 링, 닫힘 정점 없음 */
  footprint: [number, number][];
  floors: number;
  /** 실측 높이 [m] (없으면 null → 층수×층고) */
  heightM: number | null;
  heightSource: Exclude<HeightSource, 'user'>;
  dongNumber?: string;
  name?: string;
  usage?: string;
}

/** 보정값·동 번호·로컬 좌표가 반영된 건물 (3D·계산용) */
export interface Building extends RawBuilding {
  /** 로컬 평면 좌표 (x, z) 쌍, CCW, 정리 완료 — 3일차 구현 */
  ring: Float64Array;
  heightM: number;
  heightSourceResolved: HeightSource;
  isEstimated: boolean;
  isUserCorrected: boolean;
  originalFloors: number;
  dongSource?: 'data' | 'user' | 'sample';
}

export interface Place extends LatLng {
  name: string;
  address?: string;
}

export interface Favorite extends LatLng {
  id: string;
  name: string;
  address?: string;
  createdAt: number;
}

export interface RecentSearch extends LatLng {
  query: string;
  label: string;
  provider: 'kakao' | 'vworld' | 'sample';
  at: number;
}

/** 일조 참고 기준 (분 단위, 하루 0시 기준) */
export interface SunlightCriteria {
  continuousStartMin: number;
  continuousEndMin: number;
  continuousRequiredMin: number;
  totalStartMin: number;
  totalEndMin: number;
  totalRequiredMin: number;
}

/** 분석 레이어 */
export type AnalysisLayer = 'sunlight' | 'skyView' | 'irradiance' | 'groundShadow';

/** Worker 계산 종류 */
export type JobKind = 'sunlight' | 'skyView' | 'irradiance' | 'roof' | 'ground' | 'season';
