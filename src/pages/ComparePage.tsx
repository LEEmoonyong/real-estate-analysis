// [요구사항: 컴포넌트] 단지 비교 화면 (/compare) — 비교에 담은 단지(최대 3곳)를 나란히:
//   평당가·매매 중앙값·전세가율(위험 단계)·동 평균 대비·준공·세대수·가까운 역·초등학교·일조 기준 충족 비율
// [요구사항: 상태관리] Context(CompareContext) — 담은 목록 / 각 열은 단지마다 따로 불러온다(useComplexMarket·useComplexInfo)
// [요구사항: 이벤트 처리] onClick(한 곳 빼기·모두 비우기), 링크(단지 상세·지도)
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useComplexInfo } from '../components/complex/useComplexInfo';
import { useComplexMarket } from '../components/complex/useComplexMarket';
import { JeonseRatio } from '../components/complex/InsightCards';
import { useCompare } from '../contexts/CompareContext';
import type { CompareEntry } from '../data/storage/compare';
import { getNearby } from '../data/realestate/realestateClient';
import { findSummary, readSunSummaries } from '../data/storage/sunSummary';
import { median } from '../domain/realestate/aggregate';
import { formatManwon, formatManwonShort, perPyeong } from '../domain/realestate/format';
import { diffFromAverage, jeonsePerM2Median, monthSet, perM2Median } from '../domain/realestate/insight';
import { groupSchools, groupStations, walkMinutes, type NearbyResponse } from '../domain/realestate/nearby';
import { complexPath, parseComplexKey, type ComplexTarget } from '../routes/complexKey';
import styles from './ComparePage.module.css';

/** 비교 항목 이름 (모든 열이 같은 순서로 그린다) */
const ROWS = [
  '평당가',
  '매매 중앙값',
  '전세가율',
  '같은 동 평균 대비',
  '준공',
  '세대수',
  '가까운 지하철역',
  '가까운 초등학교',
  '일조 기준 충족',
] as const;

/** 저장해 둔 단지 주소 → 대상 */
function targetOf(path: string): ComplexTarget | null {
  const url = new URL(path, 'https://local.invalid');
  return parseComplexKey(url.pathname.split('/')[2], url.searchParams);
}

export function ComparePage() {
  const { list, remove, clear } = useCompare();
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.back}>
          ← 지도
        </Link>
        <h1 className={styles.title}>단지 비교</h1>
        {list.length > 0 && (
          <button type="button" className={styles.clear} onClick={clear}>
            모두 비우기
          </button>
        )}
      </header>
      <main className={styles.main}>
        {list.length === 0 ? (
          <section className={styles.empty}>
            <p>비교할 단지가 없습니다.</p>
            <p className={styles.muted}>
              단지 상세의 <strong>시세·실거래</strong> 탭에서 <strong>+ 비교에 담기</strong>를 누르면 최대 3곳까지 담겨
              여기서 나란히 볼 수 있습니다.
            </p>
            <Link to="/" className={styles.button}>
              지도에서 단지 찾기
            </Link>
          </section>
        ) : (
          <div className={styles.grid} style={{ ['--cols' as string]: String(list.length) }}>
            <dl className={`${styles.column} ${styles.labels}`} aria-hidden="true">
              <dt className={styles.head}>&nbsp;</dt>
              {ROWS.map((r) => (
                <dd key={r}>{r}</dd>
              ))}
            </dl>
            {list.map((e) => (
              <CompareColumn key={e.id} entry={e} onRemove={() => remove(e.id)} />
            ))}
          </div>
        )}
        <p className={styles.muted}>
          가격은 국토교통부 실거래가 최근 3달(없으면 12달) 중앙값, 세대수는 공동주택 기본정보, 역·학교는 단지 대표
          위치에서 잰 직선거리입니다. 일조는 이 기기에서 그 단지를 동지 날짜로 분석한 경우에만 나옵니다.
        </p>
      </main>
    </div>
  );
}

function CompareColumn({ entry, onRemove }: { entry: CompareEntry; onRemove: () => void }) {
  const target = useMemo(() => targetOf(entry.path), [entry.path]);
  if (!target) {
    return (
      <section className={styles.column}>
        <p className={styles.head}>{entry.name}</p>
        <p className={styles.muted}>저장된 주소를 읽지 못했습니다.</p>
        <button type="button" className={styles.remove} onClick={onRemove}>
          빼기
        </button>
      </section>
    );
  }
  return <LoadedColumn entry={entry} target={target} onRemove={onRemove} />;
}

function LoadedColumn({
  entry,
  target,
  onRemove,
}: {
  entry: CompareEntry;
  target: ComplexTarget;
  onRemove: () => void;
}) {
  const market = useComplexMarket(target, entry.path);
  const ready = market.status === 'ready' ? market : null;
  const complex = ready?.complex ?? null;
  const info = useComplexInfo(
    ready?.region.lawdCode ?? '',
    ready && complex ? complex.aptName : '',
    complex?.umdName ?? '',
    complex?.jibun ?? '',
  );
  const point = useMemo(() => (target.kind === 'geo' ? { lat: target.lat, lng: target.lng } : null), [target]);
  // 단지를 확정한 뒤 그 대표 위치로 한 번만 찾는다
  const nearby = useNearby(
    ready ? (complex?.lat ?? point?.lat ?? null) : null,
    ready ? (complex?.lng ?? point?.lng ?? null) : null,
  );

  const price = useMemo(() => {
    if (!ready) return null;
    // 최근 3달에 거래가 없으면 12달로
    const pick = (n: number) => {
      const set = monthSet(ready.months.slice(-n));
      const tr = ready.trades.filter((t) => !t.cancelled && set.has(t.date.slice(0, 7)));
      const perM2 = perM2Median(ready.trades, set).perM2;
      const jPerM2 = jeonsePerM2Median(ready.rents, set);
      return {
        months: n,
        tm: median(tr.map((t) => t.price)),
        perM2,
        ratio: perM2 && jPerM2 ? jPerM2 / perM2 : null,
      };
    };
    const r = pick(3);
    return r.tm !== null ? r : pick(ready.months.length);
  }, [ready]);

  const sun = useMemo(() => {
    const at = complex?.lat != null && complex.lng != null ? { lat: complex.lat, lng: complex.lng } : point;
    return at ? findSummary(readSunSummaries(), at) : null;
  }, [complex, point]);

  const dongDiff = ready?.comparison ? diffFromAverage(ready.comparison.complex, ready.comparison.dong.perM2) : null;
  const loading = <span className={styles.muted}>불러오는 중…</span>;
  const none = <span className={styles.muted}>—</span>;

  const cells: Record<(typeof ROWS)[number], ReactNode> = {
    평당가: !ready ? loading : price?.perM2 ? `평당 ${formatManwonShort(perPyeong(price.perM2))}` : none,
    '매매 중앙값': !ready ? (
      loading
    ) : price?.tm ? (
      <>
        {formatManwon(price.tm)}
        {price.months > 3 && <small className={styles.muted}> ({price.months}달)</small>}
      </>
    ) : (
      none
    ),
    전세가율: !ready ? loading : <JeonseRatio ratio={price?.ratio ?? null} />,
    '같은 동 평균 대비':
      !ready || !ready.comparison ? (
        ready ? (
          none
        ) : (
          loading
        )
      ) : dongDiff === null ? (
        none
      ) : (
        <span data-sign={Math.abs(dongDiff) < 0.03 ? 'same' : dongDiff > 0 ? 'up' : 'down'} className={styles.diff}>
          {Math.abs(dongDiff) < 0.03
            ? '비슷'
            : `${Math.round(Math.abs(dongDiff) * 100)}% ${dongDiff > 0 ? '비쌈' : '저렴'}`}{' '}
          <small className={styles.muted}>({ready.comparison.dong.name})</small>
        </span>
      ),
    준공: !ready ? loading : complex?.buildYear ? `${complex.buildYear}년` : none,
    세대수:
      info.status === 'ready' ? (
        <>
          {info.info.households?.toLocaleString() ?? '—'}세대
          {info.info.dongCount ? <small className={styles.muted}> · {info.info.dongCount}개 동</small> : null}
        </>
      ) : info.status === 'loading' && ready && complex ? (
        loading
      ) : (
        none
      ),
    '가까운 지하철역': nearby === null ? loading : (nearby.station ?? none),
    '가까운 초등학교': nearby === null ? loading : (nearby.school ?? none),
    '일조 기준 충족': sun ? (
      `${sun.meetsPct}% 세대`
    ) : (
      <Link to={complexPath(target, 'sun')} className={styles.link}>
        분석하기
      </Link>
    ),
  };

  return (
    <dl className={styles.column}>
      <dt className={styles.head}>
        <Link to={complexPath(target, 'price')} className={styles.name}>
          {complex?.aptName ?? entry.name}
        </Link>
        <button type="button" className={styles.remove} onClick={onRemove} aria-label={`${entry.name} 비교에서 빼기`}>
          ×
        </button>
        {ready && <small className={styles.muted}>{`${ready.region.sigungu} ${complex?.umdName ?? ''}`}</small>}
        {market.status === 'error' && <small className={styles.error}>불러오지 못함: {market.message}</small>}
      </dt>
      {ROWS.map((r) => (
        <dd key={r}>
          <span className={styles.rowLabel}>{r}</span>
          <span>{cells[r]}</span>
        </dd>
      ))}
    </dl>
  );
}

const distText = (m: number) =>
  `${m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`} (도보 ${walkMinutes(m)}분)`;

/** 가까운 지하철역·초등학교 한 곳씩 (null = 불러오는 중) */
function useNearby(lat: number | null, lng: number | null): { station: string | null; school: string | null } | null {
  const [state, setState] = useState<{ key: string; value: NearbyResponse | 'error' } | null>(null);
  const key = lat === null || lng === null ? '' : `${lat.toFixed(5)},${lng.toFixed(5)}`;
  useEffect(() => {
    if (!key || lat === null || lng === null) return;
    const controller = new AbortController();
    getNearby(lat, lng, controller.signal)
      .then((value) => setState({ key, value }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ key, value: 'error' });
      });
    return () => controller.abort();
  }, [key, lat, lng]);
  if (!state || state.key !== key) return null;
  if (state.value === 'error') return { station: null, school: null };
  const station = groupStations(state.value.subway)[0];
  const school = groupSchools(state.value.school).elementary[0];
  return {
    station: station ? `${station.station} ${distText(station.distanceM)}` : null,
    school: school ? `${school.name} ${distText(school.distanceM)}` : null,
  };
}
