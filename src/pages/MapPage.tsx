// [요구사항: 컴포넌트] 지도 홈 — 전국 지도에서 단지를 찾아 단지 상세로 들어가는 시작 화면
// [요구사항: 상태관리] useState — 지도 상태(불러오는 중·준비·실패), 선택한 장소 카드
// [요구사항: 이벤트 처리] 검색 결과 선택, 지도 위 샘플 표시 클릭, "단지 열기" 클릭
// [요구사항: Hooks] useEffect(SDK 로드·지도 생성·표시 정리), useRef(지도 컨테이너·지도 객체·표시 목록)
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SearchBar } from '../components/search/SearchBar';
import { SampleChips } from '../components/search/SampleChips';
import { useFavoritesActions } from '../contexts/FavoritesContext';
import type { GeoResult } from '../data/geocode/geocodeClient';
import {
  KAKAO_JS_KEY,
  loadKakaoMaps,
  type KakaoCustomOverlay,
  type KakaoMap,
  type KakaoMapsApi,
} from '../data/map/kakaoMaps';
import { loadSampleIndex } from '../data/samples/sampleClient';
import type { SampleIndexEntry } from '../data/samples/sampleSchema';
import { useApiHealth } from '../hooks/useApiHealth';
import { complexPath, type ComplexTarget } from '../routes/complexKey';
import styles from './MapPage.module.css';

type MapStatus = 'loading' | 'ready' | 'error';

interface Picked {
  target: ComplexTarget;
  title: string;
  subtitle?: string;
  lat: number;
  lng: number;
}

/** 첫 화면: 대한민국 전체가 보이는 중심·확대 수준 */
const KOREA_CENTER = { lat: 36.35, lng: 127.8 };
const KOREA_LEVEL = 13;
const PLACE_LEVEL = 4;

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
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ api: KakaoMapsApi; map: KakaoMap } | null>(null);
  const pickedOverlayRef = useRef<KakaoCustomOverlay | null>(null);
  const [status, setStatus] = useState<MapStatus>(KAKAO_JS_KEY ? 'loading' : 'error');
  const [error, setError] = useState<string | null>(
    KAKAO_JS_KEY ? null : '카카오 JavaScript 키가 설정되지 않아 지도를 표시할 수 없습니다.',
  );
  const [picked, setPicked] = useState<Picked | null>(null);

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
    m.map.setLevel(PLACE_LEVEL, { animate: true });
    m.map.panTo(pos);
    if (picked.target.kind === 'geo') {
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
      </header>

      <main className={styles.mapArea} aria-label="지도">
        <div ref={containerRef} className={styles.map} />
        {status === 'loading' && <p className={styles.mapMessage}>지도를 불러오는 중…</p>}
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
