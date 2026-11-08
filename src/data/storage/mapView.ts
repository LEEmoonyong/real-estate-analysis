// [요구사항: 데이터 처리] 로컬 데이터 — 지도 화면의 마지막 위치·확대 수준
// 단지 상세를 보고 "← 지도"로 돌아왔을 때 보던 곳 그대로 열리도록 기억한다.
// 같은 탭 안에서만 의미가 있으므로 sessionStorage(탭을 닫으면 사라짐) + 메모리에 둔다.

export interface MapView {
  lat: number;
  lng: number;
  /** 카카오 지도 확대 수준 (1=가장 가까이 ~ 14) */
  level: number;
}

const KEY = 'sunlight:mapView';
let memory: MapView | null = null;

export function isMapView(x: unknown): x is MapView {
  if (typeof x !== 'object' || x === null) return false;
  const v = x as Record<string, unknown>;
  return (
    typeof v.lat === 'number' &&
    typeof v.lng === 'number' &&
    typeof v.level === 'number' &&
    v.lat > 32 &&
    v.lat < 40 &&
    v.lng > 123 &&
    v.lng < 133 &&
    v.level >= 1 &&
    v.level <= 14
  );
}

/** 마지막으로 본 지도 위치 (없으면 null — 처음 열 때는 전국 지도) */
export function readMapView(): MapView | null {
  if (memory) return memory;
  try {
    const parsed: unknown = JSON.parse(window.sessionStorage.getItem(KEY) ?? 'null');
    memory = isMapView(parsed) ? parsed : null;
  } catch {
    memory = null; // 저장소를 쓸 수 없는 환경 — 메모리만
  }
  return memory;
}

export function saveMapView(view: MapView): void {
  memory = view;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(view));
  } catch {
    /* 저장 실패해도 메모리에는 남는다 */
  }
}
