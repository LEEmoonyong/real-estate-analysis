// [요구사항: 컴포넌트] 최상위 조립 — Context 계층 + 화면 이동(주소 기반)
//   /                         지도 홈 (단지 찾기)
//   /complex/:key/:tab        단지 상세 (일조·조망 / 시세·실거래 / 단지 정보 / 학군·교통 / 대출 계산 탭)
//   /calc                     대출·세금 계산기
// 상태 관리는 여전히 useState·useReducer·Context만 쓴다. React Router는 화면 이동(주소)만 담당한다.
import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AppProviders } from './contexts/AppProviders';
import { useSettings } from './contexts/SettingsContext';
import { ComplexPage } from './pages/ComplexPage';
import { MapPage } from './pages/MapPage';

// 계산기는 단지에서 넘어올 때만 쓰므로 따로 받는다
const CalculatorPage = lazy(() => import('./pages/CalculatorPage').then((m) => ({ default: m.CalculatorPage })));

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

export default function App() {
  return (
    <ErrorBoundary scope="앱">
      <AppProviders>
        <ThemeSync />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<MapPage />} />
            <Route path="/complex/:key/:tab?" element={<ComplexPage />} />
            <Route
              path="/calc"
              element={
                <Suspense fallback={null}>
                  <CalculatorPage />
                </Suspense>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AppProviders>
    </ErrorBoundary>
  );
}
