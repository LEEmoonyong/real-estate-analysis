// [요구사항: 컴포넌트] 지도에서 고른 건물(또는 동)의 요약과 최근 거래 목록 (확장 X8)
// [요구사항: 이벤트 처리] onClick(단지 분석 열기·일조 분석·닫기)
import { formatArea, formatManwon } from '../../domain/realestate/format';
import { jeonseRisk } from '../../domain/realestate/insight';
import {
  areaLabel,
  dealAmountText,
  kindLabel,
  typeLabel,
  type DealKind,
  type DealPlace,
} from '../../domain/realestate/property';
import styles from './PlaceCard.module.css';

interface PlaceCardProps {
  place: DealPlace;
  kind: DealKind;
  /** 예: 서울특별시 송파구 */
  area: string;
  /** 열 화면이 있으면 버튼 이름과 동작 (동 단위 표시는 없음) */
  /** 매매일 때 같은 건물 전세가율 (모르면 null) */
  jeonseRatio?: number | null;
  open: { label: string; onOpen: () => void } | null;
  onClose: () => void;
}

export function PlaceCard({ place, kind, area, jeonseRatio = null, open, onClose }: PlaceCardProps) {
  const risk = jeonseRatio === null ? null : jeonseRisk(jeonseRatio);
  const summary =
    kind === 'trade'
      ? `㎡당 중앙값 ${formatManwon(place.value)}`
      : kind === 'jeonse'
        ? `전세 보증금 중앙값 ${formatManwon(place.value)}`
        : `월세 중앙값 ${Math.round(place.value)}만 · 보증금 중앙값 ${formatManwon(place.depositMedian)}`;
  return (
    <div className={styles.root} data-place-level={place.level}>
      <p className={styles.title}>
        {place.name}
        <span className={styles.tag}>
          {typeLabel(place.type)}
          {place.subType && place.subType !== place.name.split(' ').pop() ? ` · ${place.subType}` : ''}
        </span>
      </p>
      <p className={styles.muted}>
        {place.level === 'building'
          ? `${area} ${place.umdName} ${place.jibun}`
          : `${area} ${place.umdName} (지번 비공개 — 동 위치에 표시)`}
        {place.buildYear ? ` · ${place.buildYear}년 준공` : ''}
      </p>
      <p className={styles.summary}>
        최근 3달 {kindLabel(kind)} {place.count}건 · {summary} · {areaLabel(place.type)} 중앙값{' '}
        {formatArea(place.areaMedian)}
      </p>
      {jeonseRatio !== null && risk && (
        <p className={styles.summary}>
          전세가율 약 {Math.round(jeonseRatio * 100)}%{' '}
          <span className={styles.risk} data-level={risk.level} title={risk.note}>
            {risk.label}
          </span>
        </p>
      )}
      <table className={styles.table}>
        <caption className={styles.caption}>최근 거래 (최신순)</caption>
        <thead>
          <tr>
            <th scope="col">계약일</th>
            <th scope="col">{areaLabel(place.type)}</th>
            <th scope="col">층</th>
            <th scope="col">금액</th>
          </tr>
        </thead>
        <tbody>
          {place.recent.map((d, i) => (
            <tr key={`${d.date}-${i}`}>
              <td>{d.date.slice(5)}</td>
              <td>{formatArea(d.area)}</td>
              <td>{d.floor ?? '—'}</td>
              <td>{dealAmountText(d, kind)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.actions}>
        {open && (
          <button type="button" className={styles.primary} onClick={open.onOpen}>
            {open.label}
          </button>
        )}
        <button type="button" className={styles.secondary} onClick={onClose}>
          닫기
        </button>
      </div>
      <p className={styles.muted}>출처: 국토교통부 실거래가 공개 자료 (신고 기준, 해제 거래 제외)</p>
    </div>
  );
}
