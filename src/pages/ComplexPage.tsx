// [요구사항: 컴포넌트] 단지 상세 — 주소(/complex/:key/:tab)에서 대상을 읽어 탭 화면을 보여 준다
//   sun   일조·조망 (기존 일조 시뮬레이터 전체)
//   price 시세·실거래 (최근 12달 매매·전세 추이, 거래 목록)
//   info  단지 정보 (공동주택 기본정보)
//   area  학군·교통 (주변 학교·지하철·생활 편의)
//   loan  대출 계산 (이 단지 최근 매매가로 시작하는 대출·세금 계산기)
import { useMemo } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { BackToMap, ComplexTabs } from '../components/complex/ComplexTabs';
import { AreaTab } from '../components/complex/AreaTab';
import { LoanTab } from '../components/complex/LoanTab';
import { MarketTabs } from '../components/complex/MarketTabs';
import { complexPath, isComplexTab, parseComplexKey } from '../routes/complexKey';
import { SunlightWorkspace } from './SunlightWorkspace';
import styles from './ComplexPage.module.css';

export function ComplexPage() {
  const { key, tab } = useParams();
  const [search] = useSearchParams();
  const target = useMemo(() => parseComplexKey(key, search), [key, search]);

  if (!target) {
    return (
      <main className={styles.invalid}>
        <p>단지 주소가 올바르지 않습니다.</p>
        <Link to="/">지도로 돌아가기</Link>
      </main>
    );
  }
  // 탭이 없거나 모르는 탭이면 기본 탭(일조·조망)으로
  if (!isComplexTab(tab)) return <Navigate to={complexPath(target)} replace />;
  if (tab === 'area') return <AreaTab target={target} />;
  if (tab === 'loan') return <LoanTab target={target} />;
  if (tab !== 'sun') return <MarketTabs target={target} tab={tab} />;

  return <SunlightWorkspace target={target} nav={<BackToMap />} tabs={<ComplexTabs target={target} active="sun" />} />;
}
