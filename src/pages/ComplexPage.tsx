// [요구사항: 컴포넌트] 단지 상세 — 주소(/complex/:key/:tab)에서 대상을 읽어 탭 화면을 보여 준다
//   sun   일조·조망 (기존 일조 시뮬레이터 전체)
//   price 시세·실거래 (최근 12달 매매·전세 추이, 거래 목록)
//   info  단지 정보 (공동주택 기본정보)
//   area  학군·교통 (주변 학교·지하철·생활 편의)
//   loan  대출 계산 (이 단지 최근 매매가로 시작하는 대출·세금 계산기)
// [요구사항: Hooks] useEffect + useLocalStorage — 연 단지를 "최근 본 단지"에 남긴다 (지도 패널에서 다시 열기)
import { useEffect, useMemo } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { BackToMap, ComplexTabs } from '../components/complex/ComplexTabs';
import { AreaTab } from '../components/complex/AreaTab';
import { LoanTab } from '../components/complex/LoanTab';
import { MarketTabs } from '../components/complex/MarketTabs';
import { addRecentComplex, isRecentComplexList, type RecentComplex } from '../data/storage/complexNotes';
import { STORAGE_KEYS } from '../data/storage/schema';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { complexPath, isComplexTab, parseComplexKey } from '../routes/complexKey';
import { SunlightWorkspace } from './SunlightWorkspace';
import styles from './ComplexPage.module.css';

const NO_RECENT: RecentComplex[] = [];

export function ComplexPage() {
  const { key, tab } = useParams();
  const [search] = useSearchParams();
  const target = useMemo(() => parseComplexKey(key, search), [key, search]);

  // 마지막으로 본 탭 주소로 기억한다 (샘플 지역은 지도에서 바로 열 수 있어 남기지 않는다)
  const [, setRecent] = useLocalStorage(STORAGE_KEYS.recentComplexes, NO_RECENT, {
    version: 1,
    validate: isRecentComplexList,
  });
  const recentPath = target?.kind === 'geo' && isComplexTab(tab) ? complexPath(target, tab) : null;
  useEffect(() => {
    if (!recentPath || target?.kind !== 'geo') return;
    const entry: RecentComplex = {
      id: `${target.lat.toFixed(5)},${target.lng.toFixed(5)}`,
      name: target.name,
      path: recentPath,
      at: Date.now(),
    };
    setRecent((prev) => addRecentComplex(prev, entry));
    // target은 recentPath가 같으면 같은 대상
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentPath, setRecent]);

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
