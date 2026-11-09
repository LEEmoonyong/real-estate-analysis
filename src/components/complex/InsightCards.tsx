// [요구사항: 컴포넌트] 시세 탭의 해석 카드 — 전세가율 위험 배지, 같은 동·시군구 평균과 비교, 비슷한 단지
import { Link } from 'react-router-dom';
import { diffFromAverage, jeonseRisk, type AreaComparison, type SimilarComplex } from '../../domain/realestate/insight';
import { formatManwonShort, perPyeong } from '../../domain/realestate/format';
import { M2_PER_PYEONG, type Region } from '../../domain/realestate/types';
import { complexPath } from '../../routes/complexKey';
import styles from './Complex.module.css';

/** 전세가율 + 위험 단계 배지 (글자와 색 모두로 구분) */
export function JeonseRatio({ ratio }: { ratio: number | null }) {
  if (ratio === null) return <>—</>;
  const risk = jeonseRisk(ratio);
  return (
    <>
      {Math.round(ratio * 100)}%{' '}
      <span className={styles.riskBadge} data-level={risk.level} title={risk.note}>
        {risk.label}
      </span>
    </>
  );
}

/** +12% 비쌈 / −8% 저렴 / 비슷 */
function diffText(d: number | null): string {
  if (d === null) return '';
  const pct = Math.round(d * 100);
  if (Math.abs(pct) < 3) return '비슷';
  return pct > 0 ? `${pct}% 비쌈` : `${-pct}% 저렴`;
}

export function AreaCompareCard({ comparison, name }: { comparison: AreaComparison; name: string }) {
  const { complex, dong, sigungu, months, dongJeonseRatio } = comparison;
  const rows = [
    { label: `${dong.name} 아파트`, perM2: dong.perM2, count: dong.count },
    { label: `${sigungu.name} 아파트`, perM2: sigungu.perM2, count: sigungu.count },
  ];
  const max = Math.max(complex ?? 0, ...rows.map((r) => r.perM2 ?? 0));
  const bar = (v: number | null) => `${v && max ? Math.max(4, (v / max) * 100) : 0}%`;
  return (
    <section className={styles.card} aria-label="주변 시세와 비교">
      <h2 className={styles.cardTitle}>주변 시세와 비교</h2>
      <ul className={styles.compareBars}>
        <li>
          <span className={styles.compareLabel}>{name}</span>
          <span className={styles.compareTrack}>
            <i className={styles.compareBarSelf} style={{ width: bar(complex) }} />
          </span>
          <strong>{complex ? `평당 ${formatManwonShort(perPyeong(complex))}` : '—'}</strong>
        </li>
        {rows.map((r) => {
          const d = diffFromAverage(complex, r.perM2);
          return (
            <li key={r.label}>
              <span className={styles.compareLabel}>
                {r.label} <small>({r.count}건)</small>
              </span>
              <span className={styles.compareTrack}>
                <i style={{ width: bar(r.perM2) }} />
              </span>
              <span>
                {r.perM2 ? `평당 ${formatManwonShort(perPyeong(r.perM2))}` : '—'}
                {d !== null && (
                  <small className={styles.compareDiff} data-sign={Math.abs(d) < 0.03 ? 'same' : d > 0 ? 'up' : 'down'}>
                    {' '}
                    이 단지가 {diffText(d)}
                  </small>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <p className={styles.muted}>
        최근 {months}달 아파트 매매의 전용 ㎡당 가격 중앙값을 평당가로 바꿔 비교했습니다(평형 구성이 달라도 비교되도록).
        {dongJeonseRatio !== null && (
          <>
            {' '}
            {dong.name} 아파트 전세가율은 약 {Math.round(dongJeonseRatio * 100)}%입니다.
          </>
        )}
      </p>
    </section>
  );
}

export function SimilarCard({ similar, region }: { similar: readonly SimilarComplex[]; region: Region }) {
  if (similar.length === 0) return null;
  const area = `${region.sido} ${region.sigungu}`;
  return (
    <section className={styles.card} aria-label="비슷한 단지">
      <h2 className={styles.cardTitle}>비슷한 단지 (1km 안)</h2>
      <ul className={styles.similarList}>
        {similar.map((c) => (
          <li key={c.aptSeq}>
            <Link
              className={styles.similarItem}
              to={complexPath(
                {
                  kind: 'geo',
                  lat: c.lat!,
                  lng: c.lng!,
                  name: c.aptName,
                  address: `${area} ${c.umdName} ${c.jibun}`,
                  aptSeq: c.aptSeq,
                  lawd: region.lawdCode,
                },
                'price',
              )}
            >
              <strong>{c.aptName}</strong>
              <span>평당 {formatManwonShort(perPyeong(c.medianPricePerM2))}</span>
              <small>
                {c.umdName} · {Math.round(c.distanceM)}m
                {c.area !== null && ` · ${Math.round(c.area / M2_PER_PYEONG)}평`}
                {c.buildYear !== null && ` · ${c.buildYear}년`}
              </small>
            </Link>
          </li>
        ))}
      </ul>
      <p className={styles.muted}>평당가·평수·준공 연도가 비슷하고 가까운 순서입니다 (최근 6달 매매 기준).</p>
    </section>
  );
}
