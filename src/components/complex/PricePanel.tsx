// [요구사항: 컴포넌트] 시세·실거래 탭 — 최근 12달 매매·전세 중앙값 추이(평형대별), 요약, 거래 목록, 주변 단지
// [요구사항: 상태관리] useState — 평형대·매매/전월세 목록 선택
// [요구사항: 이벤트 처리] onClick(평형대·목록 전환), 주변 단지 링크(주소 이동)
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  bandsWithTrades,
  jeonseRatio,
  median,
  monthlyJeonseMedians,
  monthlyTradeMedians,
} from '../../domain/realestate/aggregate';
import {
  AREA_BANDS,
  areaBandOf,
  formatArea,
  formatManwon,
  formatManwonShort,
  perPyeong,
  type AreaBandId,
} from '../../domain/realestate/format';
import { complexPath } from '../../routes/complexKey';
import type { ComplexMarket } from './useComplexMarket';
import styles from './Complex.module.css';

type Ready = Extract<ComplexMarket, { status: 'ready' }>;

const LIST_LIMIT = 30;

export function PricePanel({ market }: { market: Ready }) {
  const { trades, rents, months, complex, nearby, region } = market;
  const bands = useMemo(() => bandsWithTrades(trades), [trades]);
  // [요구사항: 상태관리] useState — 기본 평형대는 거래가 가장 많은 구간
  const [band, setBand] = useState<AreaBandId | 'all'>(bands[0]?.band ?? 'all');
  const [list, setList] = useState<'trade' | 'rent'>('trade');
  const b = band === 'all' ? undefined : band;

  const series = useMemo(() => {
    const t = monthlyTradeMedians(trades, months, b);
    const j = monthlyJeonseMedians(rents, months, b);
    return t.map((p, i) => ({
      month: p.month.slice(2).replace('-', '.'),
      trade: p.median,
      jeonse: j[i]!.median,
      count: p.count,
    }));
  }, [trades, rents, months, b]);

  // 최근 3달 요약 (같은 평형대)
  const summary = useMemo(() => {
    const recent = new Set(months.slice(-3).map((m) => `${m.slice(0, 4)}-${m.slice(4)}`));
    const inBand = <T extends { area: number; date: string }>(x: T) =>
      recent.has(x.date.slice(0, 7)) && (!b || areaBandOf(x.area) === b);
    const tr = trades.filter((t) => !t.cancelled && inBand(t));
    const js = rents.filter((r) => r.monthlyRent === 0 && inBand(r));
    const tm = median(tr.map((t) => t.price));
    const jm = median(js.map((r) => r.deposit));
    const perM2 = median(tr.map((t) => t.price / t.area));
    return { count: tr.length, tm, jm, ratio: jeonseRatio(tm, jm), perM2 };
  }, [trades, rents, months, b]);

  const rows = (list === 'trade' ? trades : rents).filter((x) => !b || areaBandOf(x.area) === b).slice(0, LIST_LIMIT);

  if (!complex) {
    return (
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>시세·실거래</h2>
        <p className={styles.muted}>
          이 위치 250m 안에서 최근 3달 매매된 아파트 단지를 찾지 못했습니다. 아래 주변 단지를 고르거나 지도에서 가격
          표시를 눌러 단지를 여세요.
        </p>
        <NearbyList nearby={nearby} lawd={region.lawdCode} area={`${region.sido} ${region.sigungu}`} />
      </section>
    );
  }

  return (
    <>
      <section className={styles.card} aria-label="시세 요약">
        <h2 className={styles.cardTitle}>
          {complex.aptName}{' '}
          <small className={styles.muted}>{complex.buildYear ? `${complex.buildYear}년 준공` : ''}</small>
        </h2>
        <div className={styles.chips} role="group" aria-label="평형대">
          <button type="button" className={styles.chip} aria-pressed={band === 'all'} onClick={() => setBand('all')}>
            전체
          </button>
          {AREA_BANDS.filter((x) => bands.some((y) => y.band === x.id)).map((x) => (
            <button
              key={x.id}
              type="button"
              className={styles.chip}
              aria-pressed={band === x.id}
              onClick={() => setBand(x.id)}
            >
              {x.label} ({bands.find((y) => y.band === x.id)?.count ?? 0})
            </button>
          ))}
        </div>
        <dl className={styles.stats}>
          <div>
            <dt>최근 3달 매매 중앙값</dt>
            <dd>{summary.tm ? formatManwon(summary.tm) : '거래 없음'}</dd>
          </div>
          <div>
            <dt>평당가 (전용)</dt>
            <dd>{summary.perM2 ? formatManwon(perPyeong(summary.perM2)) : '—'}</dd>
          </div>
          <div>
            <dt>최근 3달 전세 중앙값</dt>
            <dd>{summary.jm ? formatManwon(summary.jm) : '계약 없음'}</dd>
          </div>
          <div>
            <dt>전세가율</dt>
            <dd>{summary.ratio ? `${Math.round(summary.ratio * 100)}%` : '—'}</dd>
          </div>
        </dl>
        <div
          role="img"
          aria-label={`최근 ${months.length}달 달별 매매·전세 중앙값 선 그래프 (${band === 'all' ? '전체' : AREA_BANDS.find((x) => x.id === band)?.label})`}
        >
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatManwonShort(v)} width={48} />
              <Tooltip
                formatter={(v, name) => [
                  typeof v === 'number' ? formatManwon(v) : '—',
                  name === 'trade' ? '매매' : '전세',
                ]}
              />
              <Legend
                formatter={(v) => (v === 'trade' ? '매매 중앙값' : '전세 중앙값')}
                wrapperStyle={{ fontSize: 12 }}
              />
              <Line
                dataKey="trade"
                stroke="#d9512b"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
                isAnimationActive={false}
              />
              <Line
                dataKey="jeonse"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className={styles.muted}>
          국토교통부 실거래가 (계약일 기준, 신고 30일 지연으로 최근 달은 적을 수 있음). 해제된 거래는 그래프에서
          뺐습니다.
        </p>
      </section>

      <section className={styles.card} aria-label="거래 목록">
        <div className={styles.chips} role="group" aria-label="목록 종류">
          <button
            type="button"
            className={styles.chip}
            aria-pressed={list === 'trade'}
            onClick={() => setList('trade')}
          >
            매매 {trades.length}건
          </button>
          <button type="button" className={styles.chip} aria-pressed={list === 'rent'} onClick={() => setList('rent')}>
            전월세 {rents.length}건
          </button>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>계약일</th>
                <th>전용면적</th>
                <th>층</th>
                <th>{list === 'trade' ? '거래금액' : '보증금 / 월세'}</th>
                <th>{list === 'trade' ? '비고' : '계약'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x, i) => (
                <tr key={`${x.date}-${i}`}>
                  <td>{x.date}</td>
                  <td>{formatArea(x.area)}</td>
                  <td>{x.floor ?? '—'}</td>
                  {'price' in x ? (
                    <>
                      <td>{x.cancelled ? <s>{formatManwon(x.price)}</s> : formatManwon(x.price)}</td>
                      <td>{x.cancelled ? '해제' : x.dealType}</td>
                    </>
                  ) : (
                    <>
                      <td>
                        {formatManwon(x.deposit)}
                        {x.monthlyRent > 0 ? ` / ${x.monthlyRent}만` : ' (전세)'}
                      </td>
                      <td>{x.contractType || '—'}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <p className={styles.muted}>이 평형대에는 최근 {months.length}달 기록이 없습니다.</p>}
      </section>

      {nearby.length > 0 && (
        <section className={styles.card} aria-label="주변 단지">
          <h2 className={styles.cardTitle}>주변 거래 단지</h2>
          <NearbyList nearby={nearby} lawd={region.lawdCode} area={`${region.sido} ${region.sigungu}`} />
        </section>
      )}
    </>
  );
}

function NearbyList({ nearby, lawd, area }: { nearby: Ready['nearby']; lawd: string; area: string }) {
  return (
    <div className={styles.chips}>
      {nearby.slice(0, 12).map((c) => (
        <Link
          key={c.aptSeq}
          className={styles.chip}
          to={complexPath(
            {
              kind: 'geo',
              lat: c.lat!,
              lng: c.lng!,
              name: c.aptName,
              address: `${area} ${c.umdName} ${c.jibun}`,
              aptSeq: c.aptSeq,
              lawd,
            },
            'price',
          )}
        >
          {c.aptName} · {Math.round(c.distanceM)}m · 평당 {formatManwonShort(perPyeong(c.medianPricePerM2))}
        </Link>
      ))}
    </div>
  );
}
