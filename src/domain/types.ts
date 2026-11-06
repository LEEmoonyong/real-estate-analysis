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
export interface Building {
  id: string;
  source: BuildingSource;
  /** 로컬 평면 좌표 (x0, z0, x1, z1, …), CCW, 정리 완료 */
  ring: Float64Array;
  /** 바닥 면적 [m²] */
  areaM2: number;
  floors: number;
  /** 건물 높이 [m] (지면 y=0부터) */
  heightM: number;
  heightSource: HeightSource;
  /** 기본값으로 추정한 높이 (화면에 "추정값" 표시) */
  isEstimated: boolean;
  isUserCorrected: boolean;
  /** 보정 전 데이터의 층수 */
  originalFloors: number;
  /** 보정 전 데이터의 높이 출처 */
  originalHeightSource: Exclude<HeightSource, 'user'>;
  dongNumber?: string;
  dongSource?: 'data' | 'user';
  name?: string;
  usage?: string;
  /** 자기교차 외곽선을 볼록 껍질로 복구함 */
  geometryRepaired: boolean;
  /** 가상 건물 영향 분석에서 사용자가 놓은 상자 (확장 X6) — 세대 없음, 반투명 표시 */
  isVirtual?: boolean;
}

export interface Place extends LatLng {
  name: string;
  address?: string;
}

export interface Favorite extends LatLng {
  id: string;
  name: string;
  address?: string;
  /** 샘플 지역이면 샘플 id (누르면 API 대신 샘플을 불러온다) */
  sampleId?: string;
  createdAt: number;
}

export interface RecentSearch extends LatLng {
  query: string;
  label: string;
  provider: 'kakao' | 'vworld' | 'sample';
  sampleId?: string;
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
