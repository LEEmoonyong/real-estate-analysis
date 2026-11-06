// [요구사항: 컴포넌트] 학군·교통 탭 — 단지 주변 초·중·고, 지하철역(노선 묶음), 대형마트·병원·어린이집 (직선거리·도보 시간)
// [요구사항: Hooks] useEffect(AbortController) + useState
import { useEffect, useState } from 'react';
import { getNearby } from '../../data/realestate/realestateClient';
import {
  groupSchools,
  groupStations,
  walkMinutes,
  type NearbyPlace,
  type NearbyResponse,
} from '../../domain/realestate/nearby';
import styles from './Complex.module.css';

type State = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: NearbyResponse };

const dist = (m: number) =>
  `${m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`} · 도보 ${walkMinutes(m)}분`;

export function NearbyPanel({ lat, lng }: { lat: number; lng: number }) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    getNearby(lat, lng, controller.signal)
      .then((data) => setState({ status: 'ready', data }))
      .catch((e: unknown) => {
        if (!controller.signal.aborted)
          setState({ status: 'error', message: e instanceof Error ? e.message : String(e) });
      });
    return () => controller.abort();
  }, [lat, lng]);

  if (state.status === 'loading') return <p className={styles.loading}>주변 시설을 찾는 중…</p>;
  if (state.status === 'error')
    return (
      <section className={styles.card}>
        <p role="alert">주변 시설을 불러오지 못했습니다: {state.message}</p>
      </section>
    );

  const { data } = state;
  const schools = groupSchools(data.school);
  const stations = groupStations(data.subway);
  return (
    <>
      <section className={styles.card} aria-label="학군">
        <h2 className={styles.cardTitle}>학군 (1.5km 안)</h2>
        <SchoolList title="초등학교" items={schools.elementary} />
        <SchoolList title="중학교" items={schools.middle} />
        <SchoolList title="고등학교" items={schools.high} />
        <p className={styles.muted}>
          배정 학교는 교육청 학구도로 정해지며 가장 가까운 학교와 다를 수 있습니다. 거리는 단지 대표 위치에서 잰
          직선거리입니다.
        </p>
      </section>
      <section className={styles.card} aria-label="교통">
        <h2 className={styles.cardTitle}>지하철 (2km 안)</h2>
        {stations.length === 0 ? (
          <p className={styles.muted}>2km 안에 지하철역이 없습니다.</p>
        ) : (
          <ul className={styles.placeList}>
            {stations.slice(0, 6).map((s) => (
              <li key={s.station}>
                <strong>{s.station}</strong> <span className={styles.lineTags}>{s.lines.join(' · ')}</span>
                <span className={styles.muted}>{dist(s.distanceM)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={styles.card} aria-label="생활 편의">
        <h2 className={styles.cardTitle}>생활 편의</h2>
        <PlaceList title="대형마트·슈퍼 (2km)" items={data.mart} />
        <PlaceList title="병원 (1km)" items={data.hospital} />
        <PlaceList title="어린이집·유치원 (1km)" items={data.kindergarten} />
        <p className={styles.muted}>출처: 카카오 로컬 카테고리 검색</p>
      </section>
    </>
  );
}

function SchoolList({ title, items }: { title: string; items: NearbyPlace[] }) {
  return (
    <div>
      <h3 className={styles.subTitle}>
        {title} {items.length > 0 && <span className={styles.muted}>{items.length}곳</span>}
      </h3>
      {items.length === 0 ? (
        <p className={styles.muted}>범위 안에 없음</p>
      ) : (
        <ul className={styles.placeList}>
          {items.slice(0, 3).map((s) => (
            <li key={s.name}>
              <strong>{s.name}</strong>
              <span className={styles.muted}>{dist(s.distanceM)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PlaceList({ title, items }: { title: string; items: NearbyPlace[] }) {
  return (
    <div>
      <h3 className={styles.subTitle}>
        {title} <span className={styles.muted}>{items.length}곳</span>
      </h3>
      <ul className={styles.placeList}>
        {items.slice(0, 3).map((s) => (
          <li key={`${s.name}-${s.distanceM}`}>
            {s.name} <span className={styles.muted}>{dist(s.distanceM)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
