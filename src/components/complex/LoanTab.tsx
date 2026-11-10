// [요구사항: 컴포넌트] 단지 상세 › 대출 계산 탭 — 이 단지의 최근 매매가·면적·지역으로 시작하는 대출·세금 계산기
// [요구사항: Hooks] useMemo — 최근 매매 중앙값·대표 면적 계산
// 시세를 불러오지 못하거나 거래가 없으면 기본값(10억·84㎡)으로 시작하고, 값은 계산기에서 바꿀 수 있다.
import { useMemo } from 'react';
import { median } from '../../domain/realestate/aggregate';
import { formatManwon } from '../../domain/realestate/format';
import { LoanCalculator } from '../../pages/CalculatorPage';
import { complexPath, type ComplexTarget } from '../../routes/complexKey';
import { ComplexShell } from './ComplexShell';
import { useComplexMarket } from './useComplexMarket';
import styles from './Complex.module.css';

const DEFAULT_PRICE = 100_000;
const DEFAULT_AREA = 84;

export function LoanTab({ target }: { target: ComplexTarget }) {
  const market = useComplexMarket(target, complexPath(target, 'sun'));

  // 이 단지의 최근 3달(없으면 12달) 매매 중앙값과 그 거래들의 대표 면적
  const start = useMemo(() => {
    if (market.status !== 'ready') return null;
    const recent = new Set(market.months.slice(-3).map((m) => `${m.slice(0, 4)}-${m.slice(4)}`));
    const valid = market.trades.filter((t) => !t.cancelled);
    const pool = valid.filter((t) => recent.has(t.date.slice(0, 7)));
    const used = pool.length > 0 ? pool : valid;
    const price = median(used.map((t) => t.price));
    const area = median(used.map((t) => t.area));
    return {
      price: price ? Math.round(price) : DEFAULT_PRICE,
      area: area ? Math.round(area * 10) / 10 : DEFAULT_AREA,
      count: used.length,
      recentOnly: pool.length > 0,
      sido: market.region.sido,
      sigungu: market.region.sigungu,
    };
  }, [market]);

  return (
    <ComplexShell target={target} tab="loan" status={market.status} wide>
      {market.status === 'loading' && (
        <p className={styles.loading} role="status">
          {market.step}…
        </p>
      )}
      {market.status === 'error' && (
        <p className={styles.muted} role="status">
          시세를 불러오지 못해 기본값으로 계산합니다: {market.message}
        </p>
      )}
      {start && (
        <p className={styles.muted}>
          {start.count > 0
            ? `이 단지 ${start.recentOnly ? '최근 3달' : '최근 12달'} 매매 ${start.count}건의 중앙값 ${formatManwon(start.price)}(전용 ${start.area}㎡)으로 시작합니다.`
            : '이 단지의 최근 매매가 없어 기본값으로 시작합니다.'}{' '}
          값은 아래에서 바꿀 수 있습니다.
        </p>
      )}
      {market.status !== 'loading' && (
        // 시작 값이 정해진 뒤에 한 번 만든다 (key로 단지가 바뀌면 새로)
        <LoanCalculator
          key={`${complexPath(target)}|${start?.price ?? 0}`}
          price={start?.price ?? DEFAULT_PRICE}
          area={start?.area ?? DEFAULT_AREA}
          sido={start?.sido ?? ''}
          sigungu={start?.sigungu ?? ''}
        />
      )}
    </ComplexShell>
  );
}
