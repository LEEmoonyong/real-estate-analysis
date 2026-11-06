// [요구사항: 컴포넌트] 단지 상세 — 주소(/complex/:key/:tab)에서 대상을 읽어 탭 화면을 보여 준다
// 지금은 "일조·조망" 탭(기존 시뮬레이터). 시세·단지 정보 등은 확장 일정(PLAN_EXPANSION.md)에 따라 탭으로 추가된다.
import { useMemo } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
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

  const nav = (
    <Link to="/" className={styles.back} aria-label="지도로 돌아가기" title="지도로 돌아가기">
      ←<span className={styles.backText}> 지도</span>
    </Link>
  );
  return <SunlightWorkspace target={target} nav={nav} />;
}
