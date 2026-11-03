// 1일차 골격: 프록시 상태 확인만 표시한다. 2일차에 AppProviders·AppLayout으로 교체.
import { useEffect, useState } from 'react';
import { FORCE_SAMPLE_MODE } from './config/constants';
import styles from './App.module.css';

type Health = { kakao: boolean; vworld: boolean } | 'unavailable' | null;

export default function App() {
  const [health, setHealth] = useState<Health>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/health', { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<{ kakao: boolean; vworld: boolean }>) : Promise.reject()))
      .then((body) => setHealth({ kakao: body.kakao, vworld: body.vworld }))
      .catch(() => {
        if (!controller.signal.aborted) setHealth('unavailable');
      });
    return () => controller.abort();
  }, []);

  const isSample = FORCE_SAMPLE_MODE || health === 'unavailable' || (health !== null && !health.kakao && !health.vworld);

  return (
    <main className={styles.shell}>
      <h1>☀ 일조 시뮬레이터</h1>
      <p>프로젝트 골격 (1일차)</p>
      <p role="status">
        {health === null ? 'API 상태 확인 중…' : isSample ? '샘플 모드 (API 키 없음 또는 프록시 미동작)' : '실데이터 모드'}
      </p>
      {health !== null && health !== 'unavailable' && (
        <ul>
          <li>카카오 키: {health.kakao ? '설정됨' : '없음'}</li>
          <li>V-World 키: {health.vworld ? '설정됨' : '없음'}</li>
        </ul>
      )}
    </main>
  );
}
