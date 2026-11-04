// [요구사항: 컴포넌트] 최상위 조립 — Context 계층 + 반응형 레이아웃 + 검색·3D 장면
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AppHeader } from './components/common/AppHeader';
import { CalculationStatus } from './components/common/CalculationStatus';
import { DataSourceBadge } from './components/common/DataSourceBadge';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { GlobalShortcuts } from './components/common/GlobalShortcuts';
import { LimitationsDialog, ShortcutsDialog } from './components/common/HelpDialogs';
import { StatusBanner } from './components/common/StatusBanner';
import { WindowViewControls } from './components/common/WindowViewControls';
import { LayerSelector } from './components/controls/LayerSelector';
import { TimeControls } from './components/controls/TimeControls';
import { BuildingInfo } from './components/detail/BuildingInfo';
import { UnitDetailPanel } from './components/detail/UnitDetailPanel';
import { DongHoSearch } from './components/dongHo/DongHoSearch';
import { FavoritesPanel, type NavigateTarget } from './components/favorites/FavoritesPanel';
import { RecentSearches } from './components/favorites/RecentSearches';
import { OnboardingTour } from './components/onboarding/OnboardingTour';
import { useOnboarding } from './components/onboarding/useOnboarding';
import { SolarPotentialCard } from './components/solar/SolarPotentialCard';
import { SeasonTimelapseControls } from './components/season/SeasonTimelapseControls';
import { SunInfoCard } from './components/sunPath/SunInfoCard';
import { AppLayout } from './components/layout/AppLayout';
import { Panel } from './components/layout/Panel';
import { SampleChips } from './components/search/SampleChips';
import { SearchBar } from './components/search/SearchBar';
import { DEFAULT_SAMPLE_ID } from './config/constants';
import { FEATURES } from './config/features';
import { AppProviders } from './contexts/AppProviders';
import { useFavoritesActions } from './contexts/FavoritesContext';
import { useSceneData } from './contexts/SceneDataContext';
import { useSettings } from './contexts/SettingsContext';
import type { GeoResult } from './data/geocode/geocodeClient';
import { loadSampleIndex, nearestSample, prefetchSamples } from './data/samples/sampleClient';
import type { SampleIndexEntry } from './data/samples/sampleSchema';
import { useApiHealth } from './hooks/useApiHealth';
import { useBuildings, type BuildingsRequest } from './hooks/useBuildings';
import styles from './App.module.css';

// [요구사항: UI] 코드 분할 — three.js·R3F(3D 장면)와 recharts(그래프)는 처음 화면에 필요할 때 따로 받는다.
// 검색창·컨트롤이 먼저 뜨고, 3D 엔진은 병렬로 내려받는다.
const SceneCanvas = lazy(() => import('./scene/SceneCanvas').then((m) => ({ default: m.SceneCanvas })));
const FloorCompareChart = lazy(() =>
  import('./components/floorCompare/FloorCompareChart').then((m) => ({ default: m.FloorCompareChart })),
);
const MonthlySummaryChart = lazy(() =>
  import('./components/season/MonthlySummaryChart').then((m) => ({ default: m.MonthlySummaryChart })),
);

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
  const { scene, selectedBuildingId, selectedUnitId } = useSceneData();

  // [요구사항: 상태관리] useState — 현재 건물 데이터 요청 (검색·샘플 선택·재시도마다 새 객체)
  const [request, setRequest] = useState<BuildingsRequest | null>(null);
  const requestIdRef = useRef(0);
  const nextId = () => ++requestIdRef.current;
  const { notice, dismissNotice } = useBuildings(request, health.keys);
  const { addRecent } = useFavoritesActions();

  // [요구사항: 상태관리] useState — 도움말 대화상자 열림
  const [dialog, setDialog] = useState<'shortcuts' | 'limitations' | null>(null);
  const closeDialog = useCallback(() => setDialog(null), []);
  const openShortcuts = useCallback(() => setDialog('shortcuts'), []);
  const tour = useOnboarding(scene !== null);

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

  // 첫 화면이 뜬 뒤 나머지 샘플을 미리 받아 둔다 → 이후 네트워크가 끊겨도 샘플 지역 전환이 동작
  useEffect(() => {
    const timer = window.setTimeout(() => void prefetchSamples().catch(() => undefined), 3000);
    return () => window.clearTimeout(timer);
  }, []);

  // [요구사항: Hooks] useCallback — 자식에게 넘기는 이벤트 핸들러 참조 고정
  // 검색 결과를 고르면(검색 성공) 최근 검색에 쌓는다
  const handlePickPlace = useCallback(
    (result: GeoResult, query: string, provider: 'kakao' | 'vworld') => {
      setRequest({
        type: 'live',
        place: { name: result.label, address: result.address, lat: result.lat, lng: result.lng },
        requestId: nextId(),
      });
      addRecent({ query, label: result.label, lat: result.lat, lng: result.lng, provider });
    },
    [addRecent],
  );

  const handlePickSample = useCallback(
    (sample: SampleIndexEntry, query?: string) => {
      setRequest({ type: 'sample', sample, requestId: nextId() });
      if (query) {
        const { lat, lng } = sample.center;
        addRecent({ query, label: sample.name, lat, lng, provider: 'sample', sampleId: sample.id });
      }
    },
    [addRecent],
  );

  // 즐겨찾기·최근 검색 클릭 → 샘플이면 샘플 파일, 아니면 실데이터로 이동
  const handleNavigate = useCallback((target: NavigateTarget) => {
    if (target.sampleId) {
      const sampleId = target.sampleId;
      void loadSampleIndex().then((index) => {
        const entry = index.find((e) => e.id === sampleId);
        if (entry) setRequest({ type: 'sample', sample: entry, requestId: nextId() });
      });
      return;
    }
    const { name, address, lat, lng } = target;
    setRequest({ type: 'live', place: { name, ...(address ? { address } : {}), lat, lng }, requestId: nextId() });
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
  const currentPlace: NavigateTarget | null = scene
    ? { ...scene.place, ...(activeSampleId ? { sampleId: activeSampleId } : {}) }
    : null;

  return (
    <>
      <AppLayout
        detailFocusKey={selectedUnitId ?? selectedBuildingId}
        forcedMobileTab={tour.active ? (tour.step.mobileTab ?? null) : null}
        header={
          <AppHeader
            health={health}
            {...(FEATURES.onboarding ? { onShowTour: tour.restart } : {})}
            onShowShortcuts={openShortcuts}
            onShowLimitations={() => setDialog('limitations')}
          />
        }
        search={<SearchBar mode={health.mode} onPickPlace={handlePickPlace} onPickSample={handlePickSample} />}
        scene={
          <>
            <ErrorBoundary
              scope="3D 장면"
              resetKey={scene}
              fallback={(error, reset) => <SceneFallback error={error} reset={reset} />}
            >
              <Suspense fallback={<p className={styles.placeholder}>3D 장면을 불러오는 중…</p>}>
                <SceneCanvas />
              </Suspense>
            </ErrorBoundary>
            <StatusBanner
              notice={notice}
              onDismissNotice={dismissNotice}
              onRetry={handleRetry}
              onShowSample={handleShowSample}
            />
            <DataSourceBadge />
            <CalculationStatus />
            {FEATURES.windowView && <WindowViewControls />}
          </>
        }
        primary={
          <>
            {/* 가장 자주 쓰는 날짜·시각을 먼저 (모바일 시트에서 스크롤 없이 보이도록) */}
            <Panel title="날짜·시각" tourId="time">
              <TimeControls />
            </Panel>
            {FEATURES.dongHoSearch && (
              <Panel title="동·호수 찾기" tourId="dongho">
                {/* 지역이 바뀌면 입력·메시지를 비운다 */}
                <DongHoSearch key={scene ? `${scene.place.lat},${scene.place.lng}` : 'none'} />
              </Panel>
            )}
            <Panel title="샘플 지역" tourId="samples">
              <SampleChips activeId={activeSampleId} onPick={handlePickSample} />
            </Panel>
          </>
        }
        analysis={
          <>
            <Panel title="분석 레이어" tourId="layers">
              <LayerSelector />
            </Panel>
            {FEATURES.sunPath && (
              <Panel title="태양 정보" tourId="sun">
                <SunInfoCard />
              </Panel>
            )}
            {FEATURES.seasonTimelapse && (
              <Panel title="계절 타임랩스" tourId="season">
                <SeasonTimelapseControls />
              </Panel>
            )}
          </>
        }
        secondary={
          FEATURES.favorites && (
            <Panel title="즐겨찾기·최근 검색" tourId="favorites">
              <FavoritesPanel current={currentPlace} onNavigate={handleNavigate} />
              <RecentSearches onNavigate={handleNavigate} />
            </Panel>
          )
        }
        detail={
          <Panel title="세대·건물 정보" tourId="detail">
            {/* 상세 패널 오류가 3D 장면·컨트롤까지 멈추지 않도록 따로 감싼다. 선택이 바뀌면 다시 그린다 */}
            <ErrorBoundary scope="세대 정보" resetKey={selectedUnitId ?? selectedBuildingId}>
              <UnitDetailPanel />
              <Suspense fallback={null}>
                {FEATURES.floorCompare && <FloorCompareChart />}
                {FEATURES.seasonTimelapse && <MonthlySummaryChart />}
              </Suspense>
              <BuildingInfo />
              {FEATURES.irradiance && <SolarPotentialCard />}
            </ErrorBoundary>
          </Panel>
        }
      />
      <GlobalShortcuts onOpenHelp={openShortcuts} enabled={!tour.active} />
      {FEATURES.onboarding && <OnboardingTour tour={tour} />}
      <ShortcutsDialog open={dialog === 'shortcuts'} onClose={closeDialog} />
      <LimitationsDialog open={dialog === 'limitations'} onClose={closeDialog} />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary scope="앱">
      <AppProviders>
        <ThemeSync />
        <Shell />
      </AppProviders>
    </ErrorBoundary>
  );
}
