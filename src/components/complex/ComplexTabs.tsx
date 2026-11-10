// [요구사항: 컴포넌트] 단지 상세 탭 이동 — 주소(/complex/:key/:tab)를 바꾸는 링크 묶음
import { Link } from 'react-router-dom';
import { COMPLEX_TABS, complexPath, type ComplexTab, type ComplexTarget } from '../../routes/complexKey';
import styles from './Complex.module.css';

const TAB_LABELS: Record<ComplexTab, string> = {
  price: '시세·실거래',
  sun: '일조·조망',
  info: '단지 정보',
  area: '학군·교통',
  loan: '대출 계산',
};

export function ComplexTabs({ target, active }: { target: ComplexTarget; active: ComplexTab }) {
  return (
    <nav className={styles.tabs} aria-label="단지 상세 탭">
      {COMPLEX_TABS.map((tab) => (
        <Link
          key={tab}
          to={complexPath(target, tab)}
          className={styles.tab}
          aria-current={tab === active ? 'page' : undefined}
          replace
        >
          {TAB_LABELS[tab]}
        </Link>
      ))}
    </nav>
  );
}

export function BackToMap() {
  return (
    <Link to="/" className={styles.back} aria-label="지도로 돌아가기" title="지도로 돌아가기">
      ←<span className={styles.backText}> 지도</span>
    </Link>
  );
}
