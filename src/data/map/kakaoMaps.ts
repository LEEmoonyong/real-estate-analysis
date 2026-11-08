// 카카오맵 JavaScript SDK 로더 — 스크립트를 한 번만 넣고, 준비되면 kakao.maps를 돌려준다
// [요구사항: 데이터 처리] 외부 API (카카오맵)
// JavaScript 키는 브라우저에 노출되는 키다(지도 SDK 구조상). 카카오 콘솔에 등록한 도메인에서만 동작해 그 자체로 보호된다.

/** 이 앱이 쓰는 kakao.maps의 최소 타입 (공식 타입 패키지를 추가하지 않기 위해 필요한 것만 선언) */
export interface KakaoLatLng {
  getLat(): number;
  getLng(): number;
}
export interface KakaoMap {
  setCenter(latlng: KakaoLatLng): void;
  panTo(latlng: KakaoLatLng): void;
  setLevel(level: number, options?: { animate?: boolean }): void;
  getLevel(): number;
  getCenter(): KakaoLatLng;
  getBounds(): { getSouthWest(): KakaoLatLng; getNorthEast(): KakaoLatLng };
  relayout(): void;
  setBounds(
    bounds: KakaoLatLngBounds,
    paddingTop?: number,
    paddingRight?: number,
    paddingBottom?: number,
    paddingLeft?: number,
  ): void;
}
export interface KakaoCustomOverlay {
  setMap(map: KakaoMap | null): void;
  setPosition(latlng: KakaoLatLng): void;
}
export interface KakaoPolyline {
  setMap(map: KakaoMap | null): void;
}
/** 지도 범위 — 행정구역 테두리 전체가 보이게 맞출 때 */
export interface KakaoLatLngBounds {
  extend(latlng: KakaoLatLng): void;
}
export interface KakaoMapsApi {
  load(callback: () => void): void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMap;
  CustomOverlay: new (options: {
    position: KakaoLatLng;
    content: HTMLElement | string;
    yAnchor?: number;
    xAnchor?: number;
    zIndex?: number;
    clickable?: boolean;
  }) => KakaoCustomOverlay;
  Polyline: new (options: {
    path: KakaoLatLng[];
    strokeWeight?: number;
    strokeColor?: string;
    strokeOpacity?: number;
    strokeStyle?: string;
    zIndex?: number;
  }) => KakaoPolyline;
  LatLngBounds: new () => KakaoLatLngBounds;
  event: {
    addListener(target: unknown, type: string, handler: (...args: unknown[]) => void): void;
    removeListener(target: unknown, type: string, handler: (...args: unknown[]) => void): void;
  };
}

declare global {
  interface Window {
    kakao?: { maps: KakaoMapsApi };
  }
}

export const KAKAO_JS_KEY: string = import.meta.env?.VITE_KAKAO_JS_KEY ?? '';

let loading: Promise<KakaoMapsApi> | null = null;

/** SDK 스크립트 주소 (autoload=false → load 콜백에서 초기화) */
export function sdkUrl(appKey: string): string {
  return `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false`;
}

export function loadKakaoMaps(appKey: string = KAKAO_JS_KEY, timeoutMs = 10_000): Promise<KakaoMapsApi> {
  if (!appKey) return Promise.reject(new Error('카카오 JavaScript 키가 설정되지 않았습니다.'));
  if (window.kakao?.maps?.LatLng) return Promise.resolve(window.kakao.maps);
  loading ??= new Promise<KakaoMapsApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = sdkUrl(appKey);
    script.async = true;
    const timer = window.setTimeout(() => fail('카카오 지도를 불러오는 데 시간이 너무 오래 걸립니다.'), timeoutMs);
    function fail(message: string) {
      window.clearTimeout(timer);
      loading = null;
      script.remove();
      reject(new Error(message));
    }
    script.onerror = () => fail('카카오 지도 스크립트를 불러오지 못했습니다(네트워크 또는 등록되지 않은 도메인).');
    script.onload = () => {
      const maps = window.kakao?.maps;
      if (!maps) return fail('카카오 지도 초기화에 실패했습니다.');
      maps.load(() => {
        window.clearTimeout(timer);
        resolve(maps);
      });
    };
    document.head.appendChild(script);
  });
  return loading;
}
