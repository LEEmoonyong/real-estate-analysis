// [요구사항: 컴포넌트] 최상위 조립 — Context 계층 + 반응형 레이아웃
// 2일차 골격: 각 슬롯은 자리표시. 4일차부터 검색·3D 씬·컨트롤로 교체한다.
import { useEffect } from 'react';
import { AppHeader } from './components/common/AppHeader';
import { AppLayout } from './components/layout/AppLayout';
import { Panel } from './components/layout/Panel';
import { AppProviders } from './contexts/AppProviders';
import { useSettings } from './contexts/SettingsContext';
import { useTime } from './contexts/TimeContext';
import { useApiHealth } from './hooks/useApiHealth';
import { useBreakpoint } from './hooks/useBreakpoint';
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

function ScenePlaceholder() {
  const breakpoint = useBreakpoint();
  return (
    <div className={styles.scenePlaceholder}>
      <p>3D 캔버스 영역 (4일차)</p>
      <p className={styles.muted}>현재 레이아웃: {breakpoint}</p>
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return <p className={styles.placeholder}>{text}</p>;
}

function Shell() {
  const health = useApiHealth();
  const { date } = useTime();

  return (
    <AppLayout
      header={<AppHeader health={health} />}
      scene={<ScenePlaceholder />}
      primary={
        <>
          <Panel title="검색" tourId="search">
            <Placeholder text={health.mode === 'sample' ? '샘플 지역 선택 (4일차)' : '주소·단지명 검색 (4일차)'} />
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
        <Panel title="세대 정보" tourId="detail">
          <Placeholder text="세대를 클릭하면 일조 정보가 표시됩니다 (7일차)" />
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
