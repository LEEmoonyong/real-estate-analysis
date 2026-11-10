// [요구사항: 컴포넌트] 학군·교통 탭 — 시세 데이터 없이 단지 위치만으로 주변 시설을 보여 준다
import { useEffect, useState } from 'react';
import { loadSampleIndex } from '../../data/samples/sampleClient';
import type { ComplexTarget } from '../../routes/complexKey';
import { ComplexShell } from './ComplexShell';
import { NearbyPanel } from './NearbyPanel';
import styles from './Complex.module.css';

export function AreaTab({ target }: { target: ComplexTarget }) {
  // 샘플 지역은 샘플 중심점, 좌표 장소는 그 좌표
  const [point, setPoint] = useState<{ lat: number; lng: number; name: string } | null>(
    target.kind === 'geo' ? { lat: target.lat, lng: target.lng, name: target.name } : null,
  );
  useEffect(() => {
    if (target.kind === 'geo') {
      setPoint({ lat: target.lat, lng: target.lng, name: target.name });
      return;
    }
    let cancelled = false;
    void loadSampleIndex().then((index) => {
      const s = index.find((e) => e.id === target.sampleId);
      if (!cancelled && s) setPoint({ ...s.center, name: s.name });
    });
    return () => {
      cancelled = true;
    };
  }, [target]);

  return (
    <ComplexShell target={target} tab="area">
      {point ? <NearbyPanel lat={point.lat} lng={point.lng} /> : <p className={styles.loading}>위치 확인 중…</p>}
    </ComplexShell>
  );
}
