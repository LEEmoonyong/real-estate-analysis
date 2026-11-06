// [요구사항: 컴포넌트] 지도 홈 — 전국 지도에서 단지를 찾아 단지 상세로 들어가는 시작 화면
// [요구사항: 상태관리] useState — 지도 상태(불러오는 중·준비·실패), 선택한 장소 카드
// [요구사항: 이벤트 처리] 검색 결과 선택, 지도 위 샘플·시세 표시 클릭, 지도 이동(idle) → 그 시군구 시세 불러오기, "단지 열기" 클릭
// [요구사항: Hooks] useEffect(SDK 로드·지도 생성·표시 정리), useRef(지도 컨테이너·지도 객체·표시 목록)
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import { getRegion, getTradeComplexes, latestDealMonth } from '../data/realestate/realestateClient';
import { loadSampleIndex } from '../data/samples/sampleClient';
import { findSummary, readSunSummaries, type SunSummary } from '../data/storage/sunSummary';
import {
  classOf,
  formatArea,
  formatManwon,
  formatManwonShort,
  perPyeong,
  quantileBreaks,
} from '../domain/realestate/format';
import { DEFAULT_MAP_FILTER, isFilterActive, passesMapFilter, type MapFilter } from '../domain/realestate/mapFilter';
import type { Region, TradeComplex } from '../domain/realestate/types';
import type { SampleIndexEntry } from '../data/samples/sampleSchema';
import { useApiHealth } from '../hooks/useApiHealth';
import { useNewDeals } from '../hooks/useNewDeals';
import { complexPath, type ComplexTarget } from '../routes/complexKey';
import styles from './MapPage.module.css';

type MapStatus = 'loading' | 'ready' | 'error';

interface Picked {
  target: ComplexTarget;
  title: string;
  subtitle?: string;
  lat: number;
  lng: number;
  /** 지도 위 표시를 눌러 고른 경우 — 확대 수준을 바꾸지 않는다 */
  keepZoom?: boolean;
}

/** 첫 화면: 대한민국 전체가 보이는 중심·확대 수준 */
const KOREA_CENTER = { lat: 36.35, lng: 127.8 };
const KOREA_LEVEL = 13;
const PLACE_LEVEL = 4;
/** 이 확대 수준 이하(더 가까이)에서만 시군구 시세를 불러온다 — 전국 단위로는 너무 많다 */
const MARKET_LEVEL = 6;
/** 평당가 5등급 색 (싼 → 비싼) — 밝기가 단조로워 색각 이상에도 구분된다 */
const PRICE_COLORS = ['#fde4b2', '#fbb469', '#f58141', '#d9512b', '#9e2716'] as const;

type MarketState =
  | { status: 'zoom-in' }
  | { status: 'loading'; region: Region | null }
  | { status: 'ready'; region: Region; items: TradeComplex[]; breaks: number[] }
  | { status: 'error'; message: string };

function priceChip(item: TradeComplex, cls: number, sun: SunSummary | null, onClick: () => void): HTMLElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = styles.priceMarker ?? '';
  el.style.background = PRICE_COLORS[cls] ?? PRICE_COLORS[0];
  el.style.color = cls >= 3 ? '#fff' : '#1b1f24';
  el.title = `${item.aptName} · 평당 ${formatManwon(perPyeong(item.medianPricePerM2))} · 최근 3달 ${item.count}건`;
  el.setAttribute('aria-label', el.title);
  const price = document.createElement('strong');
  price.textContent = `평당 ${formatManwonShort(perPyeong(item.medianPricePerM2))}`;
  const name = document.createElement('span');
  name.className = styles.priceName ?? '';
  name.textContent = item.aptName;
  el.append(price, name);
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
  // [요구사항: 상태관리] useState — 지금 보이는 시군구의 시세 상태
  const [market, setMarket] = useState<MarketState>({ status: 'zoom-in' });
  const marketLawdRef = useRef<string | null>(null);
  const priceOverlaysRef = useRef<KakaoCustomOverlay[]>([]);
  // [요구사항: 상태관리] useState — 지도 필터(평당가·일조), 이 기기에 저장된 단지 일조 요약
  const [filter, setFilter] = useState<MapFilter>(DEFAULT_MAP_FILTER);
  const [summaries] = useState<SunSummary[]>(readSunSummaries);
  const [shownCount, setShownCount] = useState(0);

  // 화면 중심 → 법정동 → 시군구가 바뀌었으면 그 시군구 최근 3달 거래 단지
  const loadMarketAt = useCallback(async (lat: number, lng: number) => {
    try {
      const region = await getRegion(lat, lng);
      if (region.lawdCode === marketLawdRef.current) return;
      marketLawdRef.current = region.lawdCode;
      setMarket({ status: 'loading', region });
      const items = await getTradeComplexes(region, latestDealMonth());
      if (marketLawdRef.current !== region.lawdCode) return; // 그사이 다른 곳으로 이동
      const breaks = quantileBreaks(
        items.map((i) => i.medianPricePerM2),
        PRICE_COLORS.length,
      );
      setMarket({ status: 'ready', region, items, breaks });
    } catch (e) {
      marketLawdRef.current = null;
      setMarket({ status: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }, []);
  const loadMarketRef = useRef(loadMarketAt);
  loadMarketRef.current = loadMarketAt;

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
          if (map.getLevel() > MARKET_LEVEL) {
            marketLawdRef.current = null;
            setMarket({ status: 'zoom-in' });
            return;
          }
          regionTimer = window.setTimeout(() => {
            const c = map.getCenter();
            void loadMarketRef.current(Math.round(c.getLat() * 1e3) / 1e3, Math.round(c.getLng() * 1e3) / 1e3);
          }, 250);
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
    // pickSample은 setPicked만 쓰는 안정적인 함수
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 선택한 장소로 지도 이동 + 표시
  useEffect(() => {
    const m = mapRef.current;
    pickedOverlayRef.current?.setMap(null);
    if (!m || !picked) return;
    const pos = new m.api.LatLng(picked.lat, picked.lng);
    if (!picked.keepZoom) m.map.setLevel(PLACE_LEVEL, { animate: true });
    m.map.panTo(pos);
    if (picked.target.kind === 'geo' && !picked.keepZoom) {
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

  const pickTrade = useCallback((item: TradeComplex, region: Region) => {
    if (item.lat === null || item.lng === null) return;
    const built = item.buildYear ? ` · ${item.buildYear}년 준공` : '';
    setPicked({
      target: {
        kind: 'geo',
        lat: item.lat,
        lng: item.lng,
        name: item.aptName,
        address: `${region.sido} ${region.sigungu} ${item.umdName} ${item.jibun}`,
        aptSeq: item.aptSeq,
        lawd: region.lawdCode,
      },
      title: item.aptName,
      subtitle: `최근 거래 ${formatArea(item.lastArea)} ${formatManwon(item.lastPrice)} (${item.lastDate}) · 최근 3달 ${item.count}건 · 평당 ${formatManwon(perPyeong(item.medianPricePerM2))}${built}`,
      lat: item.lat,
      lng: item.lng,
      keepZoom: true,
    });
  }, []);

  // 시세 표시 그리기 (목록이 바뀔 때마다 지우고 다시)
  useEffect(() => {
    const m = mapRef.current;
    for (const o of priceOverlaysRef.current) o.setMap(null);
    priceOverlaysRef.current = [];
    if (!m || market.status !== 'ready') return;
    let shown = 0;
    for (const item of market.items) {
      if (item.lat === null || item.lng === null) continue;
      const sun = findSummary(summaries, { lat: item.lat, lng: item.lng });
      if (!passesMapFilter(perPyeong(item.medianPricePerM2), sun?.meetsPct ?? null, filter)) continue;
      shown++;
      const overlay = new m.api.CustomOverlay({
        position: new m.api.LatLng(item.lat, item.lng),
        content: priceChip(item, classOf(item.medianPricePerM2, market.breaks), sun, () =>
          pickTrade(item, market.region),
        ),
        yAnchor: 1.1,
        clickable: true,
        zIndex: 2,
      });
      overlay.setMap(m.map);
      priceOverlaysRef.current.push(overlay);
    }
    setShownCount(shown);
  }, [market, pickTrade, filter, summaries]);

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
    (result: GeoResult, query: string, provider: 'kakao' | 'vworld') => {
      setPicked({
        target: { kind: 'geo', name: result.label, address: result.address, lat: result.lat, lng: result.lng },
        title: result.label,
        subtitle: result.address,
        lat: result.lat,
        lng: result.lng,
      });
      addRecent({ query, label: result.label, lat: result.lat, lng: result.lng, provider });
    },
    [addRecent],
  );

  const handlePickSample = useCallback(
    (s: SampleIndexEntry, query?: string) => {
      pickSample(s);
      if (query)
        addRecent({ query, label: s.name, lat: s.center.lat, lng: s.center.lng, provider: 'sample', sampleId: s.id });
    },
    [addRecent, pickSample],
  );

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
          <MarketBadge
            market={market}
            filter={filter}
            onFilter={setFilter}
            shown={shownCount}
            sunCount={summaries.length}
          />
        )}
        {status === 'error' && (
          <div className={styles.mapMessage} role="status">
            <p>{error}</p>
            <p className={styles.muted}>지도 없이도 검색·샘플 지역으로 단지 분석을 열 수 있습니다.</p>
          </div>
        )}
      </main>

      <aside className={styles.panel} aria-label="선택한 장소">
        {picked ? (
          <div className={styles.card}>
            <p className={styles.cardTitle}>{picked.title}</p>
            {picked.subtitle && <p className={styles.muted}>{picked.subtitle}</p>}
            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={() => navigate(complexPath(picked.target))}>
                단지 분석 열기 →
              </button>
              <button type="button" className={styles.secondary} onClick={() => setPicked(null)}>
                닫기
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.card}>
            <WatchlistCard deals={newDeals} />
            <p className={styles.cardTitle}>아파트 단지를 찾아보세요</p>
            <p className={styles.muted}>
              단지명·주소를 검색하거나 지도 위 샘플 지역을 누르면 일조·시세 분석을 열 수 있습니다.
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

/** 지도 위 시세 안내·범례 */
const PYEONG_STEPS = [2_000, 3_000, 4_000, 5_000, 6_000, 8_000, 10_000, 15_000];
const SUN_STEPS = [50, 70, 90];

interface BadgeProps {
  market: MarketState;
  filter: MapFilter;
  onFilter: (f: MapFilter) => void;
  shown: number;
  sunCount: number;
}

function MarketBadge({ market, filter, onFilter, shown, sunCount }: BadgeProps) {
  const num = (v: string) => (v === '' ? null : Number(v));
  let body: ReactNode;
  if (market.status === 'zoom-in') body = '지도를 확대하면 최근 3달 거래된 단지의 평당가가 보입니다.';
  else if (market.status === 'loading')
    body = `${market.region ? `${market.region.sigungu} ` : ''}실거래가를 불러오는 중…`;
  else if (market.status === 'error') body = `시세를 불러오지 못했습니다: ${market.message}`;
  else
    body = (
      <>
        <span>
          {market.region.sido} {market.region.sigungu} · 최근 3달 거래 단지 {market.items.length}곳 · 전용면적 기준
          평당가
        </span>
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
            평당
            <select
              value={filter.minPyeong ?? ''}
              onChange={(e) => onFilter({ ...filter, minPyeong: num(e.target.value) })}
              aria-label="평당가 하한"
            >
              <option value="">하한 없음</option>
              {PYEONG_STEPS.map((v) => (
                <option key={v} value={v}>
                  {formatManwonShort(v)} 이상
                </option>
              ))}
            </select>
            <select
              value={filter.maxPyeong ?? ''}
              onChange={(e) => onFilter({ ...filter, maxPyeong: num(e.target.value) })}
              aria-label="평당가 상한"
            >
              <option value="">상한 없음</option>
              {PYEONG_STEPS.map((v) => (
                <option key={v} value={v}>
                  {formatManwonShort(v)} 이하
                </option>
              ))}
            </select>
          </label>
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
          {isFilterActive(filter) && (
            <button type="button" className={styles.filterReset} onClick={() => onFilter(DEFAULT_MAP_FILTER)}>
              초기화
            </button>
          )}
        </form>
        <span className={styles.muted} data-shown={shown}>
          표시 {shown}곳
          {filter.minSunPct > 0 && ` · 일조는 이 기기에서 분석한 곳(${sunCount}곳) 주변 400m 단지만 알 수 있습니다`}
        </span>
      </>
    );
  return (
    <div className={styles.marketBadge} role="status" data-market={market.status}>
      {body}
    </div>
  );
}
