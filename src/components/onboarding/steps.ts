// 온보딩 가이드 단계 (PLAN.md 단계 B6)
// target은 data-tour 속성 값. 모바일에서는 mobileTab으로 하단 시트 탭을 먼저 전환한다.
import type { MobileTab } from '../layout/MobileLayout';

export interface TourStep {
  id: string;
  target: string;
  /** target이 보이지 않을 때(태블릿에서 접힌 메뉴 안) 대신 가리킬 요소 */
  fallbackTarget?: string;
  title: string;
  body: string;
  mobileTab?: MobileTab;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'search',
    target: 'search',
    title: '1. 단지 찾기',
    body: '아파트 단지명이나 주소를 검색하세요. API 키가 없어도 샘플 지역(잠실·마린시티·세종) 버튼으로 바로 볼 수 있습니다.',
  },
  {
    id: 'time',
    target: 'time',
    title: '2. 날짜·시각',
    body: '절기 버튼으로 날짜를 고르고 슬라이더나 ▶ 재생으로 하루 동안 그림자가 움직이는 모습을 보세요. 일조 기준은 동지가 기준입니다.',
    mobileTab: 'controls',
  },
  {
    id: 'scene',
    target: 'scene',
    title: '3. 세대 선택',
    body: '건물 벽을 클릭(터치)하면 그 위치 세대의 일조 시간·기준 충족 여부·하루 타임라인이 상세 패널에 나옵니다. 색이 밝을수록 해가 오래 듭니다.',
  },
  {
    id: 'analysis',
    target: 'layers',
    fallbackTarget: 'menu',
    title: '4. 분석 도구',
    body: '분석 패널에서 히트맵과 3D 태양 경로를 켜고 끌 수 있고, 세대를 고르면 층별 비교 그래프로 "몇 층부터 기준을 충족하는지" 볼 수 있습니다. 태블릿에서는 ☰ 메뉴에 있습니다.',
    mobileTab: 'analysis',
  },
];
