// 앱 전역 상수 (사용자 설정의 기본값)

/** VITE_FORCE_SAMPLE_MODE=true 이면 키가 있어도 샘플 모드로 시작 (비밀 값 아님) */
// import.meta.env는 Vite 밖(Node 스크립트·테스트)에서 undefined일 수 있다
export const FORCE_SAMPLE_MODE = import.meta.env?.VITE_FORCE_SAMPLE_MODE === 'true';

/** 기본 층고 [m] */
export const DEFAULT_FLOOR_HEIGHT_M = 2.9;
/** 층수·높이 정보가 없을 때 사용하는 기본 층수 (추정값 표시). 1일차 실측: 누락 건물 대부분이 소형 부속 건물 */
export const DEFAULT_FLOORS = 5;
/** 이 면적 [m²] 미만의 외곽선은 층수 정보가 없을 때 1층으로 추정 (경비실·창고 등) */
export const SMALL_STRUCTURE_AREA_M2 = 50;
/** 건물 조회 반경 [m] */
export const DEFAULT_RADIUS_M = 400;
/** 일조 판정 샘플링 간격 [분] */
export const DEFAULT_STEP_MINUTES = 10;
/** 세대 라인 폭 [m] */
export const DEFAULT_UNIT_WIDTH_M = 6;

/** 참고 기준 기본값: 동지 09~15시 연속 2시간 또는 08~16시 총 4시간 (법적 판단 아님) */
export const DEFAULT_CRITERIA = {
  continuousStartMin: 9 * 60,
  continuousEndMin: 15 * 60,
  continuousRequiredMin: 120,
  totalStartMin: 8 * 60,
  totalEndMin: 16 * 60,
  totalRequiredMin: 240,
} as const;

/** 첫 화면에 보여 줄 샘플 (층수 정보가 모두 있는 계획 신도시 판상형 단지) */
export const DEFAULT_SAMPLE_ID = 'sejong-hansol';

/** 장면이 없을 때 태양 위치 계산에 쓰는 기본 위치 (서울시청) */
export const DEFAULT_LOCATION = { lat: 37.5665, lng: 126.978 } as const;

/** localStorage 키 접두사 */
export const STORAGE_PREFIX = 'sunsim:';
