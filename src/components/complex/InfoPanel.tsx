// [요구사항: 컴포넌트] 단지 정보 탭 — 실거래 단지를 공동주택 단지 목록과 연결해 기본정보(세대수·준공·난방 등)를 보여 준다
// [요구사항: Hooks] useEffect(AbortController) + useState — 단지 목록 → 매칭 → 기본정보 한 곳만 호출
// (공공데이터포털 개발 계정은 기본정보 API 하루 한도가 작아, 여기서 한 단지씩만 부른다)
import { useEffect, useState } from 'react';
import { getComplexes, getComplexInfo } from '../../data/realestate/realestateClient';
import { formatArea } from '../../domain/realestate/format';
import { matchComplex, type MatchResult } from '../../domain/realestate/match';
import type { AptComplexInfo } from '../../domain/realestate/types';
import type { ComplexTarget } from '../../routes/complexKey';
import type { ComplexMarket } from './useComplexMarket';
import styles from './Complex.module.css';

type Ready = Extract<ComplexMarket, { status: 'ready' }>;

type InfoState =
  | { status: 'loading' }
  | { status: 'not-found'; searched: string }
  | { status: 'error'; message: string }
  | { status: 'ready'; info: AptComplexInfo; match: MatchResult };

const AREA_LABELS = ['전용 60㎡ 이하', '60~85㎡', '85~135㎡', '135㎡ 초과'];

export function InfoPanel({ market, target }: { market: Ready; target: ComplexTarget }) {
  const { region, complex } = market;
  const name = complex?.aptName ?? (target.kind === 'geo' ? target.name : '');
  const umdName = complex?.umdName ?? region.dong;
  const jibun = complex?.jibun ?? '';
  const [state, setState] = useState<InfoState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    void (async () => {
      try {
        const list = await getComplexes(region.lawdCode, controller.signal);
        const refs = list.map((c) => ({
          kaptCode: c.kaptCode,
          name: c.name,
          dong: c.dong,
          jibun: '',
          sigungu: c.sigungu,
        }));
        const match = name ? matchComplex({ aptName: name, umdName, jibun }, refs) : null;
        if (!match) {
          setState({ status: 'not-found', searched: name });
          return;
        }
        const info = await getComplexInfo(match.kaptCode, controller.signal);
        setState({ status: 'ready', info, match });
      } catch (e) {
        if (controller.signal.aborted) return;
        setState({ status: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => controller.abort();
  }, [region.lawdCode, name, umdName, jibun]);

  if (state.status === 'loading') return <p className={styles.loading}>단지 정보를 불러오는 중…</p>;
  if (state.status === 'error')
    return (
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>단지 정보</h2>
        <p className={styles.muted} role="alert">
          단지 정보를 불러오지 못했습니다: {state.message}
          {/429|한도/.test(state.message) &&
            ' — 공공데이터포털 하루 호출 한도에 걸렸을 수 있습니다. 내일 다시 시도하세요.'}
        </p>
      </section>
    );
  if (state.status === 'not-found')
    return (
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>단지 정보</h2>
        <p className={styles.muted}>
          {state.searched
            ? `공동주택 단지 목록에서 "${state.searched}"을(를) 찾지 못했습니다. 의무관리 대상(대략 150세대 이상 등)이 아닌 소규모 단지는 목록에 없습니다.`
            : '이 위치 가까이에서 최근 거래된 단지를 찾지 못해 단지 정보를 연결할 수 없습니다. 지도에서 단지 가격 표시를 눌러 여세요.'}
        </p>
      </section>
    );

  const { info, match } = state;
  const rows: [string, string][] = [
    ['단지명', info.name],
    ['주소', info.roadAddress || info.address],
    ['지번 주소', info.address],
    ['세대수', info.households ? `${info.households.toLocaleString()}세대` : '—'],
    ['동 수', info.dongCount ? `${info.dongCount}개 동` : '—'],
    ['층수', info.topFloor ? `최고 ${info.topFloor}층${info.baseFloor ? ` · 지하 ${info.baseFloor}층` : ''}` : '—'],
    ['사용승인일', info.approvedAt ?? '—'],
    ['난방', info.heating || '—'],
    ['복도 형식', info.hallway || '—'],
    ['분양 형태', info.saleType || '—'],
    ['시공사', info.builder || '—'],
    ['시행사', info.developer || '—'],
    ['연면적', info.totalArea ? formatArea(info.totalArea).replace(/ \(.*\)/, '') : '—'],
  ];
  const byArea = info.householdsByArea;
  const totalByArea = byArea.reduce<number>((s, v) => s + (v ?? 0), 0);

  return (
    <section className={styles.card} aria-label="단지 기본정보">
      <h2 className={styles.cardTitle}>{info.name}</h2>
      <dl className={styles.info}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: 'contents' }}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {totalByArea > 0 && (
        <>
          <h3 className={styles.muted}>전용면적별 세대수</h3>
          <dl className={styles.stats}>
            {byArea.map((v, i) => (
              <div key={AREA_LABELS[i]}>
                <dt>{AREA_LABELS[i]}</dt>
                <dd>{v ? `${v.toLocaleString()}세대` : '—'}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
      <p className={styles.muted}>
        출처: 국토교통부 공동주택 기본정보(K-apt). 실거래 단지 "{name}"과(와){' '}
        {match.method === 'jibun'
          ? '지번이 같아'
          : `이름이 비슷해(유사도 ${Math.round(Math.min(1, match.score) * 100)}%)`}{' '}
        연결했습니다. 다른 단지라면 지도에서 단지를 다시 골라 주세요.
      </p>
    </section>
  );
}
