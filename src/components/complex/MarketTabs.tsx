// [요구사항: 컴포넌트] 단지 상세의 시세·실거래 / 단지 정보 탭 화면 (일조·조망 탭은 SunlightWorkspace)
// 그래프 라이브러리를 쓰는 패널은 지연 로딩한다.
import { lazy, Suspense } from 'react';
import { complexPath, type ComplexTab, type ComplexTarget } from '../../routes/complexKey';
import { BackToMap, ComplexTabs } from './ComplexTabs';
import { InfoPanel } from './InfoPanel';
import { useComplexMarket } from './useComplexMarket';
import styles from './Complex.module.css';

const PricePanel = lazy(() => import('./PricePanel').then((m) => ({ default: m.PricePanel })));

export function MarketTabs({ target, tab }: { target: ComplexTarget; tab: Exclude<ComplexTab, 'sun'> }) {
  const market = useComplexMarket(target, complexPath(target, 'sun'));
  const title =
    market.status === 'ready' && market.complex
      ? market.complex.aptName
      : target.kind === 'geo'
        ? target.name
        : '샘플 지역';

  return (
    <div className={styles.shell}>
      <header className={styles.shellHeader}>
        <BackToMap />
        <h1 className={styles.shellTitle}>{title}</h1>
        <ComplexTabs target={target} active={tab} />
      </header>
      <main className={styles.shellBody}>
        <div className={styles.content} data-market-status={market.status}>
          {market.status === 'loading' && (
            <p className={styles.loading} role="status">
              {market.step}…
            </p>
          )}
          {market.status === 'error' && (
            <section className={styles.card}>
              <p role="alert">시세 정보를 불러오지 못했습니다: {market.message}</p>
              <p className={styles.muted}>
                실거래가는 공공데이터포털 키가 있는 서버(또는 배포 서버)가 필요합니다. 일조·조망 탭은 그대로 쓸 수
                있습니다.
              </p>
            </section>
          )}
          {market.status === 'ready' &&
            (tab === 'price' ? (
              <Suspense fallback={<p className={styles.loading}>그래프를 불러오는 중…</p>}>
                <PricePanel market={market} />
              </Suspense>
            ) : (
              <InfoPanel market={market} target={target} />
            ))}
        </div>
      </main>
    </div>
  );
}
