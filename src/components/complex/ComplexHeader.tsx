// [요구사항: 컴포넌트] 단지 상세 머리글 — 모든 탭(일조·조망 / 시세·실거래 / 단지 정보 / 학군·교통 / 대출 계산)이 같이 쓴다.
//   윗줄: ← 지도 · 단지 이름 · 배지 · 관심 단지 · 비교에 담기 · 비교 보기 · 도움말(?, ⌨, ⓘ)
//   아랫줄: 탭
// 한 컴포넌트라 탭을 옮겨도 이름·버튼 크기·글자 크기가 달라지지 않는다.
import type { ReactNode } from 'react';
import { useComplexTitle } from '../../hooks/useComplexTitle';
import type { ComplexTab, ComplexTarget } from '../../routes/complexKey';
import { HelpButtons, type HelpActions } from '../common/AppHeader';
import { ComplexActions } from './ComplexActions';
import { BackToMap, ComplexTabs } from './ComplexTabs';
import styles from './Complex.module.css';

interface ComplexHeaderProps extends HelpActions {
  target: ComplexTarget;
  tab: ComplexTab;
  /** 이름 뒤 배지 (샘플 모드·배포 서버 경유 등) */
  badges?: ReactNode;
}

export function ComplexHeader({ target, tab, badges, ...help }: ComplexHeaderProps) {
  const title = useComplexTitle(target);
  return (
    <div className={styles.head}>
      <div className={styles.headTop}>
        <BackToMap />
        <h1 className={styles.shellTitle}>{title}</h1>
        {badges}
        <ComplexActions target={target} />
        <HelpButtons {...help} />
      </div>
      <ComplexTabs target={target} active={tab} />
    </div>
  );
}
