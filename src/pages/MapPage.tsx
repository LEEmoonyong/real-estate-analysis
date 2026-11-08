// [요구사항: 컴포넌트] 지도 홈 — 전국 지도에서 단지·건물 시세를 보고 단지 상세로 들어가는 시작 화면
// [요구사항: 상태관리] useState — 지도 상태(불러오는 중·준비·실패), 선택한 장소 카드, 시세 조건(유형·거래·방 구조)·필터
// [요구사항: 이벤트 처리] 검색 결과 선택, 지도 위 샘플·시세 표시 클릭, 지도 이동(idle) → 그 시군구 시세 불러오기, 조건 칩, "단지 열기" 클릭
// [요구사항: Hooks] useEffect(SDK 로드·지도 생성·표시 정리·조건이 바뀌면 다시 불러오기), useRef(지도 컨테이너·지도 객체·표시 목록)
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MarketControls } from '../components/map/MarketControls';
import { PlaceCard } from '../components/map/PlaceCard';
import { SearchBar } from '../components/search/SearchBar';
import { SampleChips } from '../components/search/SampleChips';
import { WatchlistCard } from '../components/watchlist/WatchlistCard';
import { useFavoritesActions } from '../contexts/FavoritesContext';
import { useWatchlist } from '../contexts/WatchlistContext';
import type { GeoResult } from '../data/geocode/geocodeClient';
import {
  KAKAO_JS_KEY,
  loadKakaoMaps,
  type KakaoCustomOverlay,
  type KakaoMap,
  type KakaoMapsApi,
} from '../data/map/kakaoMaps';
import { getDealPlaces, getRegion, latestDealMonth } from '../data/realestate/realestateClient';
import { loadSampleIndex } from '../data/samples/sampleClient';
import { findSummary, readSunSummaries, type SunSummary } from '../data/storage/sunSummary';
import { classOf, quantileBreaks } from '../domain/realestate/format';
import { DEFAULT_MAP_FILTER, isFilterActive, passesMapFilter, type MapFilter } from '../domain/realestate/mapFilter';
import {
  DEFAULT_MARKET_QUERY,
  FILTER_STEPS,
  filterValue,
  kindLabel,
  markerText,
  stepLabel,
  typeLabel,
  valueDescription,
  type DealKind,
  type DealPlace,
  type MarketQuery,
} from '../domain/realestate/property';
import type { Region } from '../domain/realestate/types';
import type { SampleIndexEntry } from '../data/samples/sampleSchema';
import { useApiHealth } from '../hooks/useApiHealth';
import { useNewDeals } from '../hooks/useNewDeals';
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
    }
  | { status: 'error'; message: string; query: MarketQuery };

const queryKey = (lawd: string, q: MarketQuery) => `${lawd}|${q.type}|${q.kind}|${q.room}`;

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

function overlayChip(label: string, variant: 'sample' | 'picked', onClick: () => void): HTMLElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `${styles.marker} ${variant === 'picked' ? styles.markerPicked : ''}`;
  el.textContent = label;
  el.addEventListener('click', onClick);
  return el;
}

export function MapPage() {
  const navigate = useNavigate();
  const health = useApiHealth();
  const { addRecent } = useFavoritesActions();
  // 관심 단지의 새 거래 (확장 X6)
  const { watched } = useWatchlist();
  const newDeals = useNewDeals(watched);
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
  const [shownCount, setShownCount] = useState(0);

  // 화면 중심 → 법정동 → 시군구(또는 조건)가 바뀌었으면 그 시군구 최근 3달 거래를 건물별로
  const loadMarketAt = useCallback(async (lat: number, lng: number) => {
    const q = queryRef.current;
    try {
      const region = await getRegion(lat, lng);
      const key = queryKey(region.lawdCode, q);
      if (key === marketKeyRef.current) return;
      marketKeyRef.current = key;
      setMarket({ status: 'loading', region, query: q });
      const r = await getDealPlaces(region, q, latestDealMonth());
      if (marketKeyRef.current !== key) return; // 그사이 다른 곳·다른 조건으로 바뀜
      const breaks = quantileBreaks(
        r.items.map((i) => i.value),
        PRICE_COLORS.length,
      );
      setMarket({ status: 'ready', region, query: q, items: r.items, total: r.total, truncated: r.truncated, breaks });
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

  // 지도 만들기 + 샘플 지역 표시 (한 번)
  useEffect(() => {
    if (!KAKAO_JS_KEY) return;
    let cancelled = false;
    const overlays: KakaoCustomOverlay[] = [];
    loadKakaoMaps()
      .then(async (api) => {
        if (cancelled || !containerRef.current) return;
        const map = new api.Map(containerRef.current, {
          center: new api.LatLng(KOREA_CENTER.lat, KOREA_CENTER.lng),
          level: KOREA_LEVEL,
        });
        mapRef.current = { api, map };
        setStatus('ready');
        // 지도를 움직이고 멈출 때마다: 충분히 확대했으면 화면 중심의 시군구 시세를 불러온다
        let regionTimer = 0;
        api.event.addListener(map, 'idle', () => {
          window.clearTimeout(regionTimer);
          regionTimer = window.setTimeout(reloadAtCenter, 250);
        });
        const samples = await loadSampleIndex().catch(() => [] as SampleIndexEntry[]);
        if (cancelled) return;
        for (const s of samples) {
          const overlay = new api.CustomOverlay({
            position: new api.LatLng(s.center.lat, s.center.lng),
            content: overlayChip(s.name.split(' (')[0]!, 'sample', () => pickSample(s)),
            yAnchor: 1.2,
            clickable: true,
          });
          overlay.setMap(map);
          overlays.push(overlay);
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setStatus('error');
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
      for (const o of overlays) o.setMap(null);
      for (const o of priceOverlaysRef.current) o.setMap(null);
      pickedOverlayRef.current?.setMap(null);
      mapRef.current = null;
    };
    // pickSample·reloadAtCenter는 안정적인 함수
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 조건(유형·거래 종류·방 구조)을 바꾸면 값 필터를 비우고 같은 시군구를 다시 불러온다
  const handleQuery = useCallback(
    (next: MarketQuery) => {
      setQuery(next);
      queryRef.current = next;
      setFilter(DEFAULT_MAP_FILTER);
      setPicked((p) => (p?.place ? null : p));
      marketKeyRef.current = null;
      reloadAtCenter();
    },
    [reloadAtCenter],
  );

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
        content: overlayChip(picked.title, 'picked', () => undefined),
        yAnchor: 1.2,
        zIndex: 5,
      });
      overlay.setMap(m.map);
      pickedOverlayRef.current = overlay;
    }
  }, [picked, status]);

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

  // 시세 표시 그리기 (목록·필터가 바뀔 때마다 지우고 다시)
  useEffect(() => {
    const m = mapRef.current;
    for (const o of priceOverlaysRef.current) o.setMap(null);
    priceOverlaysRef.current = [];
    if (!m || market.status !== 'ready') return;
    const { kind, type } = market.query;
    let shown = 0;
    for (const item of market.items) {
      if (item.lat === null || item.lng === null) continue;
      // 일조 요약은 아파트 단지 분석에서만 나온다
      const sun = type === 'apt' ? findSummary(summaries, { lat: item.lat, lng: item.lng }) : null;
      if (!passesMapFilter(filterValue(item, kind), sun?.meetsPct ?? null, filter)) continue;
      shown++;
      const overlay = new m.api.CustomOverlay({
        position: new m.api.LatLng(item.lat, item.lng),
        content: placeChip(item, classOf(item.value, market.breaks), kind, sun, () =>
          pickPlace(item, market.region, kind),
        ),
        yAnchor: 1.1,
        clickable: true,
        zIndex: item.level === 'dong' ? 1 : 2,
      });
      overlay.setMap(m.map);
      priceOverlaysRef.current.push(overlay);
    }
    setShownCount(shown);
  }, [market, pickPlace, filter, summaries]);

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
          <span aria-hidden="true">🏠</span> <span className={styles.titleText}>단지 탐색</span>
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
        <Link to="/calc" className={styles.headerLink}>
          계산기
        </Link>
      </header>

      <main className={styles.mapArea} aria-label="지도">
        <div ref={containerRef} className={styles.map} />
        {status === 'loading' && <p className={styles.mapMessage}>지도를 불러오는 중…</p>}
        {status === 'ready' && (
          <>
            <MarketControls query={query} onChange={handleQuery} />
            <MarketBadge
              market={market}
              query={query}
              filter={filter}
              onFilter={setFilter}
              shown={shownCount}
              sunCount={summaries.length}
            />
          </>
        )}
        {status === 'error' && (
          <div className={styles.mapMessage} role="status">
            <p>{error}</p>
            <p className={styles.muted}>지도 없이도 검색·샘플 지역으로 단지 분석을 열 수 있습니다.</p>
          </div>
        )}
      </main>

      <aside className={styles.panel} aria-label="선택한 장소">
        {picked?.place ? (
          <PlaceCard
            place={picked.place.place}
            kind={picked.place.kind}
            area={picked.place.area}
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
        ) : (
          <div className={styles.card}>
            <WatchlistCard deals={newDeals} />
            <p className={styles.cardTitle}>아파트·오피스텔·빌라 시세를 찾아보세요</p>
            <p className={styles.muted}>
              지도 왼쪽 위에서 유형(아파트·오피스텔·빌라·단독·상가)과 매매·전세·월세를 고르고 지도를 확대하면 최근 3달
              실거래가 건물마다 표시됩니다. 단지명·주소를 검색하거나 샘플 지역을 누르면 일조 분석을 열 수 있습니다.
            </p>
            <SampleChips activeId={null} onPick={pickSample} />
            <p className={styles.muted}>
              바로 보기:{' '}
              <Link to={complexPath({ kind: 'sample', sampleId: 'sejong-hansol' })}>세종 한솔동 일조 분석</Link>
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}

/** 지도 위 시세 안내·범례·필터 */
const SUN_STEPS = [50, 70, 90];

interface BadgeProps {
  market: MarketState;
  query: MarketQuery;
  filter: MapFilter;
  onFilter: (f: MapFilter) => void;
  shown: number;
  sunCount: number;
}

function MarketBadge({ market, query, filter, onFilter, shown, sunCount }: BadgeProps) {
  const num = (v: string) => (v === '' ? null : Number(v));
  const what = `${typeLabel(query.type)} ${kindLabel(query.kind)}`;
  let body: ReactNode;
  if (market.status === 'zoom-in') body = `지도를 확대하면 최근 3달 ${what} 시세가 건물마다 보입니다.`;
  else if (market.status === 'loading')
    body = `${market.region ? `${market.region.sigungu} ` : ''}${what} 실거래가를 불러오는 중…`;
  else if (market.status === 'error')
    body = /인증|서비스키|NO_KEY|키가/.test(market.message)
      ? `${what} 자료를 불러오지 못했습니다: 공공데이터포털에서 이 유형의 실거래가 API 활용신청이 필요합니다. (${market.message})`
      : `${what} 시세를 불러오지 못했습니다: ${market.message}`;
  else {
    const { kind, type } = market.query;
    const steps = FILTER_STEPS[kind];
    const dongLevel = type === 'sh' || type === 'nrg';
    body = (
      <>
        <span>
          {market.region.sido} {market.region.sigungu} · 최근 3달 {what} {market.total.toLocaleString()}건 ·{' '}
          {dongLevel ? '법정동' : '건물'} {market.items.length}곳 · {valueDescription(kind, type)}
          {market.query.room !== 'all' && ` · ${market.query.room === 'one' ? '원룸' : '투룸'}(면적 추정)`}
        </span>
        {dongLevel && <span className={styles.muted}>지번이 비공개라 법정동 위치에 묶어 표시합니다.</span>}
        <span className={styles.legend} aria-hidden="true">
          싸다
          {PRICE_COLORS.map((c) => (
            <i key={c} style={{ background: c }} />
          ))}
          비싸다
        </span>
        {/* [요구사항: 이벤트 처리] onChange — 필터를 바꾸면 표시를 다시 그린다 */}
        <form className={styles.filter} aria-label="시세 표시 필터" onSubmit={(e) => e.preventDefault()}>
          <label>
            {kind === 'trade' ? '평당' : kind === 'jeonse' ? '보증금' : '월세'}
            <select
              value={filter.minValue ?? ''}
              onChange={(e) => onFilter({ ...filter, minValue: num(e.target.value) })}
              aria-label="값 하한"
            >
              <option value="">하한 없음</option>
              {steps.map((v) => (
                <option key={v} value={v}>
                  {stepLabel(kind, v)} 이상
                </option>
              ))}
            </select>
            <select
              value={filter.maxValue ?? ''}
              onChange={(e) => onFilter({ ...filter, maxValue: num(e.target.value) })}
              aria-label="값 상한"
            >
              <option value="">상한 없음</option>
              {steps.map((v) => (
                <option key={v} value={v}>
                  {stepLabel(kind, v)} 이하
                </option>
              ))}
            </select>
          </label>
          {type === 'apt' && (
            <label>
              일조
              <select
                value={filter.minSunPct}
                onChange={(e) => onFilter({ ...filter, minSunPct: Number(e.target.value) })}
                aria-label="일조 기준 충족 세대 비율 하한"
              >
                <option value={0}>조건 없음</option>
                {SUN_STEPS.map((v) => (
                  <option key={v} value={v}>
                    기준 충족 {v}% 이상
                  </option>
                ))}
              </select>
            </label>
          )}
          {isFilterActive(filter) && (
            <button type="button" className={styles.filterReset} onClick={() => onFilter(DEFAULT_MAP_FILTER)}>
              초기화
            </button>
          )}
        </form>
        <span className={styles.muted} data-shown={shown}>
          표시 {shown}곳{market.truncated && ' · 거래가 많아 일부만 표시'}
          {filter.minSunPct > 0 && ` · 일조는 이 기기에서 분석한 곳(${sunCount}곳) 주변 400m 단지만 알 수 있습니다`}
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
