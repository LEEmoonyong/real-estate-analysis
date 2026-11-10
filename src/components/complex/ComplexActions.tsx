// [요구사항: 컴포넌트] 단지 머리글의 동작 버튼 — ☆ 관심 단지 · + 비교에 담기 · 비교 보기 (모든 탭 공통)
// [요구사항: Hooks] useComplexMarket — 이 위치의 실거래 단지를 확인해야 관심 단지·비교에 담을 수 있다.
//   같은 요청은 클라이언트가 한 번만 보내므로(메모리 캐시) 시세 탭과 같이 써도 서버를 더 부르지 않는다.
import { Link } from 'react-router-dom';
import { useCompare } from '../../contexts/CompareContext';
import { complexPath, type ComplexTarget } from '../../routes/complexKey';
import { CompareButton } from './CompareButton';
import { useComplexMarket } from './useComplexMarket';
import { WatchButton } from './WatchButton';
import styles from './Complex.module.css';

export function ComplexActions({ target }: { target: ComplexTarget }) {
  const market = useComplexMarket(target, complexPath(target, 'sun'));
  const { list } = useCompare();
  const complex = market.status === 'ready' ? market.complex : null;

  return (
    <div className={styles.headActions} data-actions-status={market.status}>
      {market.status === 'ready' && complex ? (
        <>
          <WatchButton complex={complex} region={market.region} trades={market.trades} />
          <CompareButton
            target={
              target.kind === 'geo' ? { ...target, aptSeq: complex.aptSeq, lawd: market.region.lawdCode } : target
            }
            name={complex.aptName}
            id={complex.aptSeq}
          />
        </>
      ) : (
        market.status === 'loading' && (
          // 단지를 확인하는 동안 자리만 잡아 둔다 (머리글이 덜컹거리지 않게)
          <>
            <button type="button" className={styles.watchButton} disabled>
              ☆ 관심 단지
            </button>
            <button type="button" className={styles.watchButton} disabled>
              + 비교에 담기
            </button>
          </>
        )
      )}
      {list.length > 0 && (
        <Link to="/compare" className={styles.watchButton}>
          비교 보기 ({list.length})
        </Link>
      )}
    </div>
  );
}
