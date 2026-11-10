// [요구사항: 컴포넌트] 지도 홈 — 전국 지도에서 단지·건물 시세를 보고 단지 상세로 들어가는 시작 화면
// [요구사항: 상태관리] useState — 지도 상태(불러오는 중·준비·실패), 선택한 장소 카드, 시세 조건(지역·유형 여러 개·거래·방 구조)·세부 조건
// [요구사항: 이벤트 처리] 검색 결과 선택, 지역·조건 패널(시·도·시·군·구·체크·세부 조건), 시세 표시 클릭, 지도 이동(idle·dragstart) → 그 시군구 시세 불러오기, "단지 열기" 클릭
// [요구사항: Hooks] useEffect(SDK 로드·지도 생성·표시 정리·조건이 바뀌면 다시 불러오기), useRef(지도 컨테이너·지도 객체·표시 목록)
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { MarketPanel } from '../components/map/MarketPanel';
import { PlaceCard } from '../components/map/PlaceCard';
import { SearchBar } from '../components/search/SearchBar';
import { WatchlistCard } from '../components/watchlist/WatchlistCard';
import { useFavorites, useFavoritesActions } from '../contexts/FavoritesContext';
import type { Favorite } from '../domain/types';
import { useWatchlist } from '../contexts/WatchlistContext';
import type { GeoResult } from '../data/geocode/geocodeClient';
import {
  KAKAO_JS_KEY,
  loadKakaoMaps,
  type KakaoCustomOverlay,
  type KakaoLatLng,
  type KakaoMap,
  type KakaoMapsApi,
  type KakaoPolyline,
} from '../data/map/kakaoMaps';
import { getDealPlaces, getRegion, latestDealMonth } from '../data/realestate/realestateClient';
import { findRegion, sigunguOf, type RegionEntry } from '../data/regions/regions';
import {
  boundaryContains,
  getBoundary,
  levelForZoom,
  type Boundary,
  type BoundaryQuery,
} from '../data/boundary/boundaryClient';
import { readMapView, saveMapView } from '../data/storage/mapView';
import { findSummary, readSunSummaries, type SunSummary } from '../data/storage/sunSummary';
import { classOf, formatManwonShort, quantileBreaks } from '../domain/realestate/format';
import { DEFAULT_MAP_FILTER, isFilterActive, passesMapFilter, type MapFilter } from '../domain/realestate/mapFilter';
import {
  DEFAULT_MARKET_QUERY,
  dongCenter,
  dongNames,
  filterValue,
  kindLabel,
  kindsFor,
  markerText,
  typeLabel,
  valueDescription,
  type DealKind,
  type DealPlace,
  type MarketQuery,
} from '../domain/realestate/property';
import { clusterByScreen, placeJeonseRatios, toScreen } from '../domain/realestate/insight';
import type { Region } from '../domain/realestate/types';
import type { SampleIndexEntry } from '../data/samples/sampleSchema';
import { useApiHealth } from '../hooks/useApiHealth';
import { useNewDeals } from '../hooks/useNewDeals';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { STORAGE_KEYS } from '../data/storage/schema';
import { DEFAULT_BUDGET, isBudgetSetting } from '../data/storage/complexNotes';
import { affordablePrice, budgetCap, placeTotal, type BudgetInfo } from '../domain/finance/budget';
import { classifyArea } from '../domain/finance/loan';
import { complexPath, type ComplexTarget } from '../routes/complexKey';
import styles from './MapPage.module.css';

type MapStatus = 'loading' | 'ready' | 'error';

interface Picked {
  /** 열 수 있는 단지 상세 (동 단위 시세 표시는 없음) */
  target: ComplexTarget | null;
  title: string;
  subtitle?: string;
  lat: number;
  lng: number;
  /** 지도 위 표시를 눌러 고른 경우 — 확대 수준을 바꾸지 않는다 */
  keepZoom?: boolean;
  /** 시세 표시를 눌러 고른 건물(또는 동)과 그때의 거래 종류 */
  place?: { place: DealPlace; kind: DealKind; area: string };
}

/** 첫 화면: 대한민국 전체가 보이는 중심·확대 수준 */
const KOREA_CENTER = { lat: 36.35, lng: 127.8 };
const KOREA_LEVEL = 13;
const PLACE_LEVEL = 4;
/** 시세를 아직 못 불러왔을 때 가격 분포 값 (매 렌더 새 배열이 되지 않게) */
const EMPTY_VALUES: readonly number[] = [];
/** 이 확대 수준 이하(더 가까이)에서만 시군구 시세를 불러온다 — 전국 단위로는 너무 많다 */
const MARKET_LEVEL = 6;
/** 5등급 색 (싼 → 비싼) — 밝기가 단조로워 색각 이상에도 구분된다 */
const PRICE_COLORS = ['#fde4b2', '#fbb469', '#f58141', '#d9512b', '#9e2716'] as const;

type MarketState =
  | { status: 'zoom-in' }
  | { status: 'loading'; region: Region | null; query: MarketQuery }
  | {
      status: 'ready';
      region: Region;
      query: MarketQuery;
      items: DealPlace[];
      total: number;
      truncated: boolean;
      breaks: number[];
      /** 매매일 때 건물 key → 전세가율 (같은 건물 전세 표시를 따로 불러와 맞춘다, 다 받기 전에는 없음) */
      jeonseRatios?: ReadonlyMap<string, number>;
    }
  | { status: 'error'; message: string; query: MarketQuery };

const queryKey = (lawd: string, q: MarketQuery) => `${lawd}|${q.type}|${q.kind}|${q.room}`;

/** 지역 목록 항목 → 실거래 조회에 쓰는 지역 (법정동은 모름) */
const toRegion = (r: RegionEntry): Region => ({
  bjdCode: `${r.lawdCode}00000`,
  lawdCode: r.lawdCode,
  sido: r.sido,
  sigungu: r.sigungu,
  dong: '',
});
/** 시·군·구 하나가 대략 보이는 확대 수준 (시세를 불러오는 가장 넓은 수준) */
const SIGUNGU_LEVEL = 6;
/** 법정동 하나가 보이는 확대 수준 */
const DONG_LEVEL = 5;

function placeChip(
  place: DealPlace,
  cls: number,
  kind: DealKind,
  sun: SunSummary | null,
  onClick: () => void,
): HTMLElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `${styles.priceMarker ?? ''} ${place.level === 'dong' ? (styles.dongMarker ?? '') : ''}`;
  el.style.background = PRICE_COLORS[cls] ?? PRICE_COLORS[0];
  el.style.color = cls >= 3 ? '#fff' : '#1b1f24';
  const text = markerText(place, kind);
  el.title = `${place.name} · ${text.main}${text.sub ? ` (${text.sub})` : ''} · 최근 3달 ${kindLabel(kind)} ${place.count}건`;
  el.setAttribute('aria-label', el.title);
  const main = document.createElement('strong');
  main.textContent = text.main;
  el.append(main);
  if (text.sub) {
    const sub = document.createElement('span');
    sub.className = styles.priceSub ?? '';
    sub.textContent = text.sub;
    el.append(sub);
  }
  const name = document.createElement('span');
  name.className = styles.priceName ?? '';
  name.textContent = place.name;
  el.append(name);
  if (sun) {
    // 이 기기에서 일조를 계산한 단지 — 참고 기준 충족 세대 비율
    const badge = document.createElement('span');
    badge.className = styles.sunTag ?? '';
    badge.textContent = `☀ ${sun.meetsPct}%`;
    el.append(badge);
    el.title += ` · 일조 기준 충족 ${sun.meetsPct}% (${sun.date} 분석)`;
    el.setAttribute('aria-label', el.title);
  }
  el.addEventListener('click', onClick);
  return el;
}

/** 이 확대 수준 이상(멀리 볼 때)부터 겹치는 가격 표시를 묶는다 (1~2는 충분히 가까워 묶지 않음) */
const CLUSTER_LEVEL = 3;

/** 겹친 가격 표시 묶음 — "12곳" + 가격 범위, 색은 중앙값 구간 */
function clusterChip(
  members: readonly DealPlace[],
  kind: DealKind,
  breaks: number[],
  onClick: () => void,
): HTMLElement {
  const values = members.map((p) => filterValue(p, kind)).sort((a, b) => a - b);
  const lo = values[0] ?? 0;
  const hi = values[values.length - 1] ?? 0;
  const raw = members.map((p) => p.value).sort((a, b) => a - b);
  const cls = classOf(raw[raw.length >> 1] ?? 0, breaks);
  const range =
    kind === 'wolse'
      ? `월 ${Math.round(lo)}~${Math.round(hi)}만`
      : `${kind === 'trade' ? '평당' : '전세'} ${formatManwonShort(lo)}~${formatManwonShort(hi)}`;
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `${styles.priceMarker ?? ''} ${styles.clusterMarker ?? ''}`;
  el.style.background = PRICE_COLORS[cls] ?? PRICE_COLORS[0];
  el.style.color = cls >= 3 ? '#fff' : '#1b1f24';
  const main = document.createElement('strong');
  main.textContent = `${members.length}곳`;
  const sub = document.createElement('span');
  sub.className = styles.priceSub ?? '';
  sub.textContent = range;
  el.append(main, sub);
  el.title = `겹친 ${members.length}곳 (${range}) — 누르면 확대`;
  el.setAttribute('aria-label', el.title);
  el.addEventListener('click', onClick);
  return el;
}

/** 행정구역 테두리 색 (선만) */
const BOUNDARY_COLOR = '#e4572e';

/** 테두리 이름표 (예: 경기도 광주시 남한산성면) */
function boundaryLabel(name: string): HTMLElement {
  const el = document.createElement('div');
  el.className = styles.boundaryLabel ?? '';
  el.textContent = name;
  return el;
}

/** 테두리 안을 눌렀을 때 뜨는 말풍선 — "테두리 지우기" */
function clearBoundaryPopup(name: string, onClear: () => void): HTMLElement {
  const el = document.createElement('div');
  el.className = styles.boundaryPopup ?? '';
  const title = document.createElement('span');
  title.textContent = name;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = '테두리 지우기';
  btn.setAttribute('aria-label', `${name} 테두리 지우기`);
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    onClear();
  });
  el.append(title, btn);
  return el;
}

/** 즐겨찾기 표시 — 누르면 바로 단지 분석으로 */
function favoriteChip(fav: Favorite, onClick: () => void): HTMLElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = styles.favMarker ?? '';
  el.textContent = `★ ${fav.name}`;
  el.title = `즐겨찾기: ${fav.name} — 눌러서 단지 분석 열기`;
  el.setAttribute('aria-label', el.title);
  el.addEventListener('click', onClick);
  return el;
}

/** 즐겨찾기 → 단지 분석 주소의 대상 */
function favoriteTarget(fav: Favorite): ComplexTarget {
  return fav.sampleId
    ? { kind: 'sample', sampleId: fav.sampleId }
    : { kind: 'geo', name: fav.name, lat: fav.lat, lng: fav.lng, ...(fav.address ? { address: fav.address } : {}) };
}

function pickedChip(label: string): HTMLElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `${styles.marker} ${styles.markerPicked}`;
  el.textContent = label;
  return el;
}

export function MapPage() {
  const navigate = useNavigate();
  const health = useApiHealth();
  const { addRecent } = useFavoritesActions();
  const { favorites } = useFavorites();
  // 관심 단지의 새 거래 (확장 X6)
  const { watched } = useWatchlist();
  const newDeals = useNewDeals(watched);
  // 안내 카드 닫힘 여부 — 한 번 닫으면 다음 방문에도 접힌 채로(작은 "? 안내" 버튼으로 다시 열기)
  const [guideHidden, setGuideHidden] = useLocalStorage(STORAGE_KEYS.mapGuideHidden, false, {
    version: 1,
    validate: (d): d is boolean => typeof d === 'boolean',
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ api: KakaoMapsApi; map: KakaoMap } | null>(null);
  const pickedOverlayRef = useRef<KakaoCustomOverlay | null>(null);
  const [status, setStatus] = useState<MapStatus>(KAKAO_JS_KEY ? 'loading' : 'error');
  const [error, setError] = useState<string | null>(
    KAKAO_JS_KEY ? null : '카카오 JavaScript 키가 설정되지 않아 지도를 표시할 수 없습니다.',
  );
  const [picked, setPicked] = useState<Picked | null>(null);
  // [요구사항: 상태관리] useState — 시세 조건(유형·거래 종류·방 구조)과 지금 보이는 시군구의 시세 상태
  const [query, setQuery] = useState<MarketQuery>(DEFAULT_MARKET_QUERY);
  const queryRef = useRef(query);
  queryRef.current = query;
  const [market, setMarket] = useState<MarketState>({ status: 'zoom-in' });
  const marketKeyRef = useRef<string | null>(null);
  const priceOverlaysRef = useRef<KakaoCustomOverlay[]>([]);
  // [요구사항: 상태관리] useState — 지도 필터(값 범위·일조), 이 기기에 저장된 단지 일조 요약
  const [filter, setFilter] = useState<MapFilter>(DEFAULT_MAP_FILTER);
  const [summaries] = useState<SunSummary[]>(readSunSummaries);
  // [요구사항: 상태관리] useState — 지도 확대 수준 (바뀌면 겹치는 가격 표시를 다시 묶는다)
  const [mapLevel, setMapLevel] = useState<number | null>(null);
  // [요구사항: 상태관리] useState — 지도에 테두리를 그릴 행정구역 (지역 선택·지역 검색). fit = 테두리 전체가 보이게 맞춤
  const [boundaryQuery, setBoundaryQuery] = useState<(BoundaryQuery & { fit?: boolean }) | null>(null);
  // 지금 그려진 테두리와, 테두리 안을 눌렀을 때 뜨는 "테두리 지우기" 말풍선
  const boundaryRef = useRef<Boundary | null>(null);
  const clearPopupRef = useRef<KakaoCustomOverlay | null>(null);
  const closeClearPopup = useCallback(() => {
    clearPopupRef.current?.setMap(null);
    clearPopupRef.current = null;
  }, []);
  /**
   * 지도 클릭: 누른 곳의 행정구역 테두리를 그린다 — 확대 수준에 따라 동 · 구 · 시 · 시·도.
   * 이미 그려진 같은 단계 테두리 안을 다시 누르면 "테두리 지우기" 버튼을 띄운다.
   */
  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      closeClearPopup();
      const m = mapRef.current;
      if (!m) return;
      const want = levelForZoom(m.map.getLevel());
      const b = boundaryRef.current;
      if (!b || b.level !== want || !boundaryContains(b, lat, lng)) {
        setBoundaryQuery({ level: want, lat, lng });
        return;
      }
      const popup = new m.api.CustomOverlay({
        position: new m.api.LatLng(lat, lng),
        content: clearBoundaryPopup(b.name, () => {
          closeClearPopup();
          setBoundaryQuery(null);
        }),
        yAnchor: 1.15,
        clickable: true,
        zIndex: 7,
      });
      popup.setMap(m.map);
      clearPopupRef.current = popup;
    },
    [closeClearPopup],
  );
  const mapClickRef = useRef(handleMapClick);
  mapClickRef.current = handleMapClick;
  // [요구사항: 상태관리] useState — 고른 법정동 ('' = 시·군·구 전체). 불러온 시·군·구가 바뀌면 비운다
  const [dong, setDong] = useState('');
  const loadedLawd =
    market.status === 'ready' || market.status === 'loading' ? (market.region?.lawdCode ?? null) : null;
  const [dongLawd, setDongLawd] = useState<string | null>(null);
  if (dong && dongLawd !== loadedLawd) {
    // 렌더 중 상태 맞추기 (다른 시·군·구로 옮겨 가면 동 선택 해제)
    setDong('');
    setDongLawd(null);
  }

  // 화면 중심 → 법정동 → 시군구(또는 조건)가 바뀌었으면 그 시군구 최근 3달 거래를 건물별로
  // 지역 패널에서 고른 시·군·구 — 지도를 끌어 옮기기 전까지는 화면 중심이 아니라 이 지역을 불러온다
  const lockedRegionRef = useRef<Region | null>(null);
  const loadMarketAt = useCallback(async (lat: number, lng: number) => {
    const q = queryRef.current;
    try {
      const region = lockedRegionRef.current ?? (await getRegion(lat, lng));
      const key = queryKey(region.lawdCode, q);
      if (key === marketKeyRef.current) return;
      marketKeyRef.current = key;
      setMarket({ status: 'loading', region, query: q });
      const r = await getDealPlaces(region, q.type, q, latestDealMonth());
      if (marketKeyRef.current !== key) return; // 그사이 다른 곳·다른 조건으로 바뀜
      const breaks = quantileBreaks(
        r.items.map((i) => i.value),
        PRICE_COLORS.length,
      );
      setMarket({ status: 'ready', region, query: q, items: r.items, total: r.total, truncated: r.truncated, breaks });
      // 매매를 볼 때는 같은 건물 전세 표시도 받아 전세가율을 붙인다 (표시를 먼저 그리고, 실패해도 그냥 둔다)
      if (q.kind === 'trade' && kindsFor(q.type).includes('jeonse')) {
        getDealPlaces(region, q.type, { kind: 'jeonse', room: q.room }, latestDealMonth())
          .then((j) => {
            if (marketKeyRef.current !== key) return;
            const jeonseRatios = placeJeonseRatios(r.items, j.items);
            setMarket((prev) => (prev.status === 'ready' ? { ...prev, jeonseRatios } : prev));
          })
          .catch(() => undefined);
      }
    } catch (e) {
      marketKeyRef.current = null;
      setMarket({ status: 'error', message: e instanceof Error ? e.message : String(e), query: q });
    }
  }, []);
  const loadMarketRef = useRef(loadMarketAt);
  loadMarketRef.current = loadMarketAt;

  /** 지금 화면 중심으로 시세를 불러온다 (충분히 확대했을 때만) */
  const reloadAtCenter = useCallback(() => {
    const m = mapRef.current;
    if (!m) return;
    if (m.map.getLevel() > MARKET_LEVEL) {
      marketKeyRef.current = null;
      setMarket({ status: 'zoom-in' });
      return;
    }
    const c = m.map.getCenter();
    void loadMarketRef.current(Math.round(c.getLat() * 1e3) / 1e3, Math.round(c.getLng() * 1e3) / 1e3);
  }, []);

  // 지도 만들기 (한 번)
  useEffect(() => {
    if (!KAKAO_JS_KEY) return;
    let cancelled = false;
    loadKakaoMaps()
      .then((api) => {
        if (cancelled || !containerRef.current) return;
        // 단지 상세에서 돌아오면 보던 위치·확대 수준 그대로 (처음이면 전국 지도)
        const start = readMapView() ?? { ...KOREA_CENTER, level: KOREA_LEVEL };
        const map = new api.Map(containerRef.current, {
          center: new api.LatLng(start.lat, start.lng),
          level: start.level,
        });
        mapRef.current = { api, map };
        setStatus('ready');
        setMapLevel(start.level);
        // 돌아온 위치가 이미 확대돼 있으면 첫 idle을 기다리지 않고 바로 그 시군구 시세를 불러온다
        if (start.level <= MARKET_LEVEL) reloadAtCenter();
        // 지도를 움직이고 멈출 때마다: 충분히 확대했으면 화면 중심의 시군구 시세를 불러온다
        let regionTimer = 0;
        // 지도를 직접 끌면 패널에서 고른 지역 고정을 풀고 화면 중심을 따라간다
        api.event.addListener(map, 'click', (...args: unknown[]) => {
          const at = (args[0] as { latLng?: KakaoLatLng } | undefined)?.latLng;
          if (at) mapClickRef.current(at.getLat(), at.getLng());
        });
        api.event.addListener(map, 'dragstart', () => {
          lockedRegionRef.current = null;
        });
        api.event.addListener(map, 'idle', () => {
          const c = map.getCenter();
          saveMapView({ lat: c.getLat(), lng: c.getLng(), level: map.getLevel() });
          // 확대 수준이 바뀌면 겹치는 표시를 다시 묶는다
          setMapLevel(map.getLevel());
          window.clearTimeout(regionTimer);
          regionTimer = window.setTimeout(reloadAtCenter, 250);
        });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setStatus('error');
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
      for (const o of priceOverlaysRef.current) o.setMap(null);
      pickedOverlayRef.current?.setMap(null);
      mapRef.current = null;
    };
    // reloadAtCenter는 안정적인 함수
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 조건(유형·거래 종류·방 구조)을 바꾸면 값 필터를 비우고 같은 시군구를 다시 불러온다
  // 거래 종류가 바뀌면 값 범위(평당가 ↔ 보증금 ↔ 월세)는 뜻이 달라지므로 비우고, 면적·준공 조건은 그대로 둔다
  const handleQuery = useCallback(
    (next: MarketQuery) => {
      const prev = queryRef.current;
      setQuery(next);
      queryRef.current = next;
      setFilter((f) => ({
        ...f,
        ...(next.kind !== prev.kind ? { minValue: null, maxValue: null, maxDeposit: null } : {}),
      }));
      setPicked((p) => (p?.place ? null : p));
      marketKeyRef.current = null;
      reloadAtCenter();
    },
    [reloadAtCenter],
  );

  /** 패널에서 시·군·구를 고름 → 그 지역으로 지도를 옮기고 바로 불러온다 */
  const selectRegion = useCallback((r: RegionEntry) => {
    const m = mapRef.current;
    if (!m) return;
    lockedRegionRef.current = toRegion(r);
    setPicked(null);
    setBoundaryQuery({ level: 'sigungu', lat: r.lat, lng: r.lng });
    m.map.setLevel(SIGUNGU_LEVEL);
    m.map.setCenter(new m.api.LatLng(r.lat, r.lng));
    marketKeyRef.current = null;
    void loadMarketRef.current(r.lat, r.lng);
  }, []);

  /** 동을 고름 → 그 동 표시들의 가운데로 옮기고 그 동만 보여 준다 ('' = 전체로 되돌림) */
  const selectDong = useCallback(
    (next: string) => {
      setDong(next);
      setDongLawd(loadedLawd);
      setPicked(null);
      const m = mapRef.current;
      if (!m || market.status !== 'ready') return;
      if (!next) {
        const r = findRegion(market.region.lawdCode);
        if (r) setBoundaryQuery({ level: 'sigungu', lat: r.lat, lng: r.lng });
        m.map.setLevel(SIGUNGU_LEVEL);
        return;
      }
      const c = dongCenter(market.items, next);
      if (!c) return;
      // 법정동 테두리: 이름 + 시·군·구 코드로 찾고, 안 되면 거래 위치 가운데로
      setBoundaryQuery({ level: 'emd', name: next, sig: market.region.lawdCode, lat: c.lat, lng: c.lng });
      m.map.setLevel(DONG_LEVEL);
      m.map.panTo(new m.api.LatLng(c.lat, c.lng));
    },
    [loadedLawd, market],
  );

  /** 시·도만 고름 → 그 시·도가 보이게 옮긴다 (시·군·구를 고를 때까지 시세는 확대 안내) */
  const selectSido = useCallback((sido: string) => {
    const m = mapRef.current;
    // 시·도 안에 있는 게 확실한 점(첫 시·군·구 대표 좌표)으로 테두리를 찾고, 테두리 전체가 보이게 맞춘다
    const inside = sigunguOf(sido)[0];
    if (!m || !inside) return;
    lockedRegionRef.current = null;
    setPicked(null);
    setBoundaryQuery({ level: 'sido', lat: inside.lat, lng: inside.lng, fit: true });
  }, []);

  // 행정구역 테두리 그리기 — 색은 칠하지 않고 선만 (지도·시세 표시를 가리지 않게)
  useEffect(() => {
    const m = mapRef.current;
    if (!m || status !== 'ready' || !boundaryQuery) return;
    const controller = new AbortController();
    const lines: KakaoPolyline[] = [];
    let label: KakaoCustomOverlay | null = null;
    getBoundary(boundaryQuery, controller.signal)
      .then((b) => {
        if (controller.signal.aborted) return;
        boundaryRef.current = b;
        const bounds = new m.api.LatLngBounds();
        for (const ring of b.rings) {
          const path = ring.map(([lng, lat]) => new m.api.LatLng(lat, lng));
          path.forEach((p) => bounds.extend(p));
          const line = new m.api.Polyline({
            path,
            strokeWeight: 3,
            strokeColor: BOUNDARY_COLOR,
            strokeOpacity: 0.9,
            strokeStyle: 'solid',
            zIndex: 3,
          });
          line.setMap(m.map);
          lines.push(line);
        }
        label = new m.api.CustomOverlay({
          position: new m.api.LatLng(boundaryQuery.lat, boundaryQuery.lng),
          content: boundaryLabel(b.name),
          yAnchor: 2.2,
          zIndex: 4,
        });
        label.setMap(m.map);
        if (boundaryQuery.fit) m.map.setBounds(bounds, 40, 40, 40, 40);
      })
      .catch(() => {
        // 테두리는 보조 표시 — 못 불러와도 지도·시세는 그대로 쓴다
      });
    return () => {
      controller.abort();
      for (const l of lines) l.setMap(null);
      label?.setMap(null);
      boundaryRef.current = null;
      closeClearPopup();
    };
  }, [boundaryQuery, status, closeClearPopup]);

  // 선택한 장소로 지도 이동 + 표시
  useEffect(() => {
    const m = mapRef.current;
    pickedOverlayRef.current?.setMap(null);
    if (!m || !picked) return;
    const pos = new m.api.LatLng(picked.lat, picked.lng);
    if (!picked.keepZoom) m.map.setLevel(PLACE_LEVEL, { animate: true });
    m.map.panTo(pos);
    if (picked.target?.kind === 'geo' && !picked.keepZoom) {
      const overlay = new m.api.CustomOverlay({
        position: pos,
        content: pickedChip(picked.title),
        yAnchor: 1.2,
        zIndex: 5,
      });
      overlay.setMap(m.map);
      pickedOverlayRef.current = overlay;
    }
  }, [picked, status]);

  // 즐겨찾기한 곳을 지도에 ★로 표시 — 누르면 바로 단지 분석(일조·조망 탭)으로
  useEffect(() => {
    const m = mapRef.current;
    if (!m || status !== 'ready') return;
    const overlays = favorites.map((fav) => {
      const overlay = new m.api.CustomOverlay({
        position: new m.api.LatLng(fav.lat, fav.lng),
        content: favoriteChip(fav, () => navigate(complexPath(favoriteTarget(fav)))),
        yAnchor: 1.3,
        clickable: true,
        zIndex: 6, // 시세 표시보다 위
      });
      overlay.setMap(m.map);
      return overlay;
    });
    return () => {
      for (const o of overlays) o.setMap(null);
    };
  }, [favorites, status, navigate]);

  /** 시세 표시를 눌렀을 때: 아파트는 단지 상세, 그 밖의 건물은 그 자리 일조 분석, 동 단위는 목록만 */
  const pickPlace = useCallback((place: DealPlace, region: Region, kind: DealKind) => {
    if (place.lat === null || place.lng === null) return;
    const area = `${region.sido} ${region.sigungu}`;
    const target: ComplexTarget | null =
      place.level === 'dong'
        ? null
        : {
            kind: 'geo',
            lat: place.lat,
            lng: place.lng,
            name: place.name,
            address: `${area} ${place.umdName} ${place.jibun}`,
            ...(place.type === 'apt' ? { aptSeq: place.key, lawd: region.lawdCode } : {}),
          };
    setPicked({
      target,
      title: place.name,
      lat: place.lat,
      lng: place.lng,
      keepZoom: true,
      place: { place, kind, area },
    });
  }, []);

  // [요구사항: 상태관리] useLocalStorage — 예산으로 찾기 입력(자기 자금·연소득·켜짐). 새로 고침해도 남는다
  const [budget, setBudget] = useLocalStorage(STORAGE_KEYS.budget, DEFAULT_BUDGET, {
    version: 1,
    validate: isBudgetSetting,
  });
  // 지금 보는 지역의 대출 규제(규제지역·수도권·지방)로 살 수 있는 최대 가격을 구한다
  const budgetRegion = market.status === 'ready' || market.status === 'loading' ? market.region : null;
  const budgetKind = query.kind;
  const budgetInfo = useMemo<BudgetInfo | null>(() => {
    if (!budgetRegion) return null;
    const result = affordablePrice({
      ownFunds: budget.ownFunds,
      annualIncome: budget.annualIncome,
      areaClass: classifyArea(budgetRegion.sido, budgetRegion.sigungu),
    });
    return {
      ...result,
      cap: budgetCap(result, budget.ownFunds, budgetKind),
      kind: budgetKind,
      area: budgetRegion.sigungu || budgetRegion.sido,
    };
  }, [budget.ownFunds, budget.annualIncome, budgetRegion, budgetKind]);

  // 조건에 맞는 곳 — 지도 표시와 패널 결과 목록이 같이 쓴다.
  // priceValues: 가격 외 조건만 통과한 곳의 값 (가격 분포 막대용 — 가격을 좁혀도 분포 전체가 보이게)
  const results = useMemo(() => {
    if (market.status !== 'ready') return null;
    const { kind } = market.query;
    const withoutPrice: MapFilter = { ...filter, minValue: null, maxValue: null };
    const cap = budget.on && budgetInfo ? budgetInfo.cap : null;
    const visible: DealPlace[] = [];
    const priceValues: number[] = [];
    for (const item of market.items) {
      if (item.lat === null || item.lng === null) continue;
      if (dong && item.umdName !== dong) continue;
      // 예산으로 찾기: 매매는 총액, 전세·월세는 보증금이 예산을 넘으면 뺀다
      if (cap !== null && placeTotal(item, kind) > cap) continue;
      const subject = {
        value: filterValue(item, kind),
        deposit: item.depositMedian,
        areaM2: item.areaMedian,
        buildYear: item.buildYear,
        count: item.count,
      };
      if (!passesMapFilter(subject, withoutPrice)) continue;
      priceValues.push(subject.value);
      if (passesMapFilter(subject, filter)) visible.push(item);
    }
    return { visible, priceValues };
  }, [market, filter, dong, budget.on, budgetInfo]);

  // 시세 표시 그리기 (목록·필터가 바뀔 때마다 지우고 다시)
  useEffect(() => {
    const m = mapRef.current;
    for (const o of priceOverlaysRef.current) o.setMap(null);
    priceOverlaysRef.current = [];
    if (!m || market.status !== 'ready' || !results) return;
    const { kind } = market.query;
    const items = results.visible.filter((i) => i.lat !== null && i.lng !== null);
    // 화면에서 겹치는 표시는 한 묶음으로 ("12곳 · 평당 9천만~1.3억") — 거래 많은 곳이 묶음의 기준
    const order = items.map((_, i) => i).sort((a, b) => items[b]!.count - items[a]!.count);
    let groups = order.map((i) => [i]);
    const el = containerRef.current;
    if ((mapLevel ?? m.map.getLevel()) >= CLUSTER_LEVEL && el && el.clientWidth > 0) {
      const b = m.map.getBounds();
      const sw = b.getSouthWest();
      const ne = b.getNorthEast();
      const bounds = { south: sw.getLat(), west: sw.getLng(), north: ne.getLat(), east: ne.getLng() };
      const size = { width: el.clientWidth, height: el.clientHeight };
      const pts = order.map((i) => toScreen({ lat: items[i]!.lat!, lng: items[i]!.lng! }, bounds, size));
      groups = clusterByScreen(pts).map((g) => g.map((k) => order[k]!));
    }
    for (const g of groups) {
      const lead = items[g[0]!]!;
      const position = new m.api.LatLng(lead.lat!, lead.lng!);
      let content: HTMLElement;
      if (g.length === 1) {
        // 일조 요약은 아파트 단지 분석에서만 나온다
        const sun = lead.type === 'apt' ? findSummary(summaries, { lat: lead.lat!, lng: lead.lng! }) : null;
        content = placeChip(lead, classOf(lead.value, market.breaks), kind, sun, () =>
          pickPlace(lead, market.region, kind),
        );
      } else {
        const members = g.map((i) => items[i]!);
        content = clusterChip(members, kind, market.breaks, () => {
          // 누르면 묶음 전체가 보이게 확대
          const bounds = new m.api.LatLngBounds();
          for (const p of members) bounds.extend(new m.api.LatLng(p.lat!, p.lng!));
          m.map.setBounds(bounds, 80, 60, 80, 60);
        });
      }
      const overlay = new m.api.CustomOverlay({
        position,
        content,
        yAnchor: 1.1,
        clickable: true,
        zIndex: g.length > 1 ? 3 : lead.level === 'dong' ? 1 : 2,
      });
      overlay.setMap(m.map);
      priceOverlaysRef.current.push(overlay);
    }
  }, [market, pickPlace, results, summaries, mapLevel]);

  const pickSample = useCallback((s: SampleIndexEntry) => {
    setPicked({
      target: { kind: 'sample', sampleId: s.id },
      title: s.name,
      subtitle: '샘플 지역 · API 키 없이도 동작',
      lat: s.center.lat,
      lng: s.center.lng,
    });
  }, []);

  const handlePickPlace = useCallback(
    (result: GeoResult, q: string, provider: 'kakao' | 'vworld') => {
      if (result.region) {
        // 지역 이름을 검색 → 그 행정구역 테두리를 그리고 전체가 보이게 맞춘다 (단지가 아니므로 분석 버튼 없음)
        lockedRegionRef.current = null;
        setBoundaryQuery({ level: result.region, lat: result.lat, lng: result.lng, fit: true });
        setPicked({
          target: null,
          title: result.label,
          subtitle: '지역 테두리를 표시했습니다. 지도를 확대하면 실거래가가 보입니다.',
          lat: result.lat,
          lng: result.lng,
          keepZoom: true,
        });
        addRecent({ query: q, label: result.label, lat: result.lat, lng: result.lng, provider });
        return;
      }
      setBoundaryQuery(null);
      setPicked({
        target: { kind: 'geo', name: result.label, address: result.address, lat: result.lat, lng: result.lng },
        title: result.label,
        subtitle: result.address,
        lat: result.lat,
        lng: result.lng,
      });
      addRecent({ query: q, label: result.label, lat: result.lat, lng: result.lng, provider });
    },
    [addRecent],
  );

  const handlePickSample = useCallback(
    (s: SampleIndexEntry, q?: string) => {
      pickSample(s);
      if (q)
        addRecent({
          query: q,
          label: s.name,
          lat: s.center.lat,
          lng: s.center.lng,
          provider: 'sample',
          sampleId: s.id,
        });
    },
    [addRecent, pickSample],
  );

  const openPicked = (p: Picked) => {
    if (!p.target) return null;
    const target = p.target;
    if (p.place && p.place.place.type !== 'apt')
      return { label: '이 건물 일조 분석 →', onOpen: () => navigate(complexPath(target, 'sun')) };
    // 아파트 전월세 표시에서 열면 시세 탭으로
    const tab = p.place && p.place.kind !== 'trade' ? 'price' : 'sun';
    return { label: '단지 분석 열기 →', onOpen: () => navigate(complexPath(target, tab)) };
  };

  return (
    <div className={styles.root} data-map-status={status}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          <span className={styles.titleText}>단지 탐색</span>
        </h1>
        <div className={styles.search}>
          <SearchBar mode={health.mode} onPickPlace={handlePickPlace} onPickSample={handlePickSample} />
        </div>
        {health.route === 'remote' && (
          <span className={styles.badge} title="이 컴퓨터에 API 키가 없어 배포 서버를 거쳐 검색합니다.">
            배포 서버 경유
          </span>
        )}
        {newDeals.status === 'ready' && newDeals.total > 0 && (
          <button
            type="button"
            className={styles.alertButton}
            onClick={() => setPicked(null)}
            title="관심 단지 새 거래 보기"
          >
            🔔 새 거래 {newDeals.total}
          </button>
        )}
      </header>

      <main className={styles.mapArea} aria-label="지도">
        <div ref={containerRef} className={styles.map} />
        {status === 'loading' && <p className={styles.mapMessage}>지도를 불러오는 중…</p>}
        {status === 'ready' && (
          // 검색창 바로 아래: 지역·조건 패널(접기/열기)과 그 결과 안내
          <div className={styles.side}>
            <MarketPanel
              query={query}
              onQuery={handleQuery}
              filter={filter}
              onFilter={setFilter}
              regionLawd={
                market.status === 'loading' || market.status === 'ready' ? (market.region?.lawdCode ?? null) : null
              }
              onRegion={selectRegion}
              onSido={selectSido}
              dongs={market.status === 'ready' ? dongNames(market.items) : []}
              dong={dong}
              onDong={selectDong}
              onOpenFavorite={(fav) => navigate(complexPath(favoriteTarget(fav)))}
              onShowGuide={guideHidden ? () => setGuideHidden(false) : null}
              results={results?.visible ?? null}
              priceValues={results?.priceValues ?? EMPTY_VALUES}
              jeonseRatios={market.status === 'ready' ? market.jeonseRatios : undefined}
              budget={budget}
              onBudget={setBudget}
              budgetInfo={budgetInfo}
              onPickResult={(p) => {
                if (market.status === 'ready') pickPlace(p, market.region, market.query.kind);
              }}
            />
            <MarketBadge
              market={market}
              query={query}
              shown={results?.visible.length ?? 0}
              filtered={isFilterActive(filter) || budget.on}
              dong={dong}
            />
          </div>
        )}
        {status === 'error' && (
          <div className={styles.mapMessage} role="status">
            <p>{error}</p>
            <p className={styles.muted}>지도 없이도 위 검색으로 단지 분석을 열 수 있습니다.</p>
          </div>
        )}
      </main>

      <aside className={styles.panel} aria-label="선택한 장소">
        {picked?.place ? (
          <PlaceCard
            place={picked.place.place}
            kind={picked.place.kind}
            area={picked.place.area}
            jeonseRatio={
              market.status === 'ready' && picked.place.kind === 'trade'
                ? (market.jeonseRatios?.get(picked.place.place.key) ?? null)
                : null
            }
            open={openPicked(picked)}
            onClose={() => setPicked(null)}
          />
        ) : picked ? (
          <div className={styles.card}>
            <p className={styles.cardTitle}>{picked.title}</p>
            {picked.subtitle && <p className={styles.muted}>{picked.subtitle}</p>}
            <div className={styles.actions}>
              {picked.target && (
                <button type="button" className={styles.primary} onClick={() => openPicked(picked)?.onOpen()}>
                  단지 분석 열기 →
                </button>
              )}
              <button type="button" className={styles.secondary} onClick={() => setPicked(null)}>
                닫기
              </button>
            </div>
          </div>
        ) : guideHidden && status === 'ready' ? (
          <WatchlistCard deals={newDeals} />
        ) : (
          <div className={styles.card}>
            <button
              type="button"
              className={styles.guideClose}
              onClick={() => setGuideHidden(true)}
              aria-label="안내 닫기"
              title="안내 닫기"
            >
              ×
            </button>
            <WatchlistCard deals={newDeals} />
            <p className={`${styles.cardTitle} ${styles.guideTitle}`}>아파트·오피스텔·빌라 시세를 찾아보세요</p>
            <p className={styles.muted}>
              검색창 아래 <strong>지역·조건</strong>에서 시·도와 시·군·구를 고르고, 유형과 매매·전세·월세, 세부
              조건(가격·면적·준공 연도 등)을 정하면 그 지역의 최근 3달 실거래가 건물마다 표시됩니다. 지도를 직접 옮기고
              확대해도 됩니다. 단지명·주소를 검색하면 일조 분석을 열 수 있습니다.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}

/** 지도 위 시세 안내·범례 (조건은 지역·조건 패널에서) */
interface BadgeProps {
  market: MarketState;
  query: MarketQuery;
  shown: number;
  filtered: boolean;
  /** 고른 법정동 ('' = 시·군·구 전체) */
  dong: string;
}

const KEY_ERROR = /인증|서비스키|NO_KEY|키가/;

function MarketBadge({ market, query, shown, filtered, dong }: BadgeProps) {
  const what = `${typeLabel(query.type)} ${kindLabel(query.kind)}`;
  let body: ReactNode;
  // 확대 전에는 안내 문구 없이 비워 둔다 (지역·조건 패널과 지도만)
  if (market.status === 'zoom-in') return null;
  if (market.status === 'loading')
    body = `${market.region ? `${market.region.sigungu || market.region.sido} ` : ''}${what} 실거래가를 불러오는 중…`;
  else if (market.status === 'error')
    body = KEY_ERROR.test(market.message)
      ? `${what} 자료를 불러오지 못했습니다: 공공데이터포털에서 이 유형의 실거래가 API 활용신청이 필요합니다. (${market.message})`
      : `${what} 시세를 불러오지 못했습니다: ${market.message}`;
  else {
    const { kind } = market.query;
    // 지번이 비공개인 거래(단독·다가구 전부, 상가 일반 건물)는 법정동 표시로 묶인다
    const dongCount = market.items.filter((i) => i.level === 'dong').length;
    const buildingCount = market.items.length - dongCount;
    body = (
      <>
        <span>
          {market.region.sido} {market.region.sigungu}
          {dong && ` ${dong}`} · 최근 3달 {what} {market.total.toLocaleString()}건 ·{' '}
          {[buildingCount > 0 && `건물 ${buildingCount}곳`, dongCount > 0 && `법정동 ${dongCount}곳`]
            .filter(Boolean)
            .join(' · ')}{' '}
          · {valueDescription(kind, market.query.type)}
          {market.query.room !== 'all' && ` · ${market.query.room === 'one' ? '원룸' : '투룸'}(면적 추정)`}
        </span>
        {dongCount > 0 && (
          <span className={styles.muted}>지번이 비공개인 거래는 법정동 위치에 묶어 점선 테두리로 표시합니다.</span>
        )}
        <span className={styles.legend} aria-hidden="true">
          싸다
          {PRICE_COLORS.map((c) => (
            <i key={c} style={{ background: c }} />
          ))}
          비싸다
        </span>
        <span className={styles.muted} data-shown={shown}>
          표시 {shown}곳{filtered && ' (세부 조건 적용)'}
          {market.truncated && ' · 거래가 많아 일부만 표시'}
        </span>
      </>
    );
  }
  return (
    <div className={styles.marketBadge} role="status" data-market={market.status}>
      {body}
    </div>
  );
}
