// [요구사항: 컴포넌트] 최상위 조립 — Context 계층 + 반응형 레이아웃 + 검색·3D 장면
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppHeader } from './components/common/AppHeader';
import { DataSourceBadge } from './components/common/DataSourceBadge';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { StatusBanner } from './components/common/StatusBanner';
import { BuildingInfo } from './components/detail/BuildingInfo';
import { AppLayout } from './components/layout/AppLayout';
import { Panel } from './components/layout/Panel';
import { SampleChips } from './components/search/SampleChips';
import { SearchBar } from './components/search/SearchBar';
import { DEFAULT_SAMPLE_ID } from './config/constants';
import { AppProviders } from './contexts/AppProviders';
import { useSceneData } from './contexts/SceneDataContext';
import { useSettings } from './contexts/SettingsContext';
import { useTime } from './contexts/TimeContext';
import type { GeoResult } from './data/geocode/geocodeClient';
import { loadSampleIndex, nearestSample } from './data/samples/sampleClient';
import type { SampleIndexEntry } from './data/samples/sampleSchema';
import { useApiHealth } from './hooks/useApiHealth';
import { useBuildings, type BuildingsRequest } from './hooks/useBuildings';
import { SceneCanvas } from './scene/SceneCanvas';
import styles from './App.module.css';

/** 설정의 테마를 <html data-theme>에 반영 */
function ThemeSync() {
  const { settings } = useSettings();
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = settings.theme;
  }, [settings.theme]);
  return null;
}

function Placeholder({ text }: { text: string }) {
  return <p className={styles.placeholder}>{text}</p>;
}

function SceneFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className={styles.sceneError} role="alert">
      <p>3D 장면을 표시하는 중 오류가 발생했습니다.</p>
      <p className={styles.muted}>{error.message}</p>
      <button type="button" onClick={reset}>
        다시 그리기
      </button>
    </div>
  );
}

function Shell() {
  const health = useApiHealth();
  const { date } = useTime();
  const { scene, selectedBuildingId, selectedUnitId } = useSceneData();

  // [요구사항: 상태관리] useState — 현재 건물 데이터 요청 (검색·샘플 선택·재시도마다 새 객체)
  const [request, setRequest] = useState<BuildingsRequest | null>(null);
  const requestIdRef = useRef(0);
  const nextId = () => ++requestIdRef.current;
  const { notice, dismissNotice } = useBuildings(request, health.keys);

  // 첫 화면: 연결 확인이 끝나면 기본 샘플을 보여 준다 (API 키가 없어도 바로 3D를 볼 수 있게)
  useEffect(() => {
    if (health.mode === 'checking' || requestIdRef.current > 0) return;
    let cancelled = false;
    loadSampleIndex()
      .then((index) => {
        const entry = index.find((e) => e.id === DEFAULT_SAMPLE_ID) ?? index[0];
        if (cancelled || !entry || requestIdRef.current > 0) return;
        setRequest({
          type: 'sample',
          sample: entry,
          requestId: nextId(),
          reason:
            health.mode === 'sample'
              ? `${health.reason ?? ''} 샘플 지역 '${entry.name}'을 표시합니다.`.trim()
              : `샘플 지역 '${entry.name}'을 표시하고 있습니다. 검색창에서 전국의 아파트 단지를 찾아보세요.`,
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [health.mode, health.reason]);

  // [요구사항: Hooks] useCallback — 자식에게 넘기는 이벤트 핸들러 참조 고정
  const handlePickPlace = useCallback((result: GeoResult) => {
    setRequest({
      type: 'live',
      place: { name: result.label, address: result.address, lat: result.lat, lng: result.lng },
      requestId: nextId(),
    });
  }, []);

  const handlePickSample = useCallback((sample: SampleIndexEntry) => {
    setRequest({ type: 'sample', sample, requestId: nextId() });
  }, []);

  const handleRetry = useCallback(() => {
    setRequest((r) => (r ? { ...r, requestId: nextId() } : r));
  }, []);

  const handleShowSample = useCallback(() => {
    void loadSampleIndex().then((index) => {
      const near = scene ? nearestSample(index, scene.place) : undefined;
      const entry = near ?? index.find((e) => e.id === DEFAULT_SAMPLE_ID);
      if (entry) setRequest({ type: 'sample', sample: entry, requestId: nextId() });
    });
  }, [scene]);

  const activeSampleId = request?.type === 'sample' && scene?.source === 'sample' ? request.sample.id : null;

  return (
    <AppLayout
      detailFocusKey={selectedUnitId ?? selectedBuildingId}
      header={<AppHeader health={health} />}
      search={<SearchBar mode={health.mode} onPickPlace={handlePickPlace} onPickSample={handlePickSample} />}
      scene={
        <>
          <ErrorBoundary
            scope="3D 장면"
            resetKey={scene}
            fallback={(error, reset) => <SceneFallback error={error} reset={reset} />}
          >
            <SceneCanvas />
          </ErrorBoundary>
          <StatusBanner
            notice={notice}
            onDismissNotice={dismissNotice}
            onRetry={handleRetry}
            onShowSample={handleShowSample}
          />
          <DataSourceBadge />
        </>
      }
      primary={
        <>
          <Panel title="샘플 지역" tourId="samples">
            <SampleChips activeId={activeSampleId} onPick={handlePickSample} />
          </Panel>
          <Panel title="날짜·시각" tourId="time">
            <Placeholder text={`선택 날짜 ${date} — 시각 슬라이더 (5일차)`} />
          </Panel>
        </>
      }
      analysis={
        <Panel title="분석 레이어" tourId="layers">
          <Placeholder text="일조 / 천공률 / 일사량 / 지면 그림자 (7·12일차)" />
        </Panel>
      }
      secondary={
        <Panel title="즐겨찾기·최근 검색">
          <Placeholder text="10일차" />
        </Panel>
      }
      detail={
        <Panel title="건물 정보" tourId="detail">
          <BuildingInfo />
        </Panel>
      }
    />
  );
}

export default function App() {
  return (
    <AppProviders>
      <ThemeSync />
      <Shell />
    </AppProviders>
  );
}
