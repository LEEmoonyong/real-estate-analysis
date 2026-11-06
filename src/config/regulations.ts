// 대출·세금 규칙 (확장 X4) — 규칙이 자주 바뀌므로 숫자를 코드 곳곳에 두지 않고 여기 한곳에 모은다.
// 기준: 2026-11 확인 (10·15 대책(2025-10-15) 반영, 2026-08 종부세 개편안은 국회 확정 전이라 미반영).
// 실제 한도·세액은 금융기관·세무 당국 확인이 필요하다 — 화면에 "참고용 추정"과 기준일을 항상 표시한다.

export const REGULATION_BASIS_DATE = '2026-11';

export const REGULATION_SOURCES = [
  {
    label: '정책브리핑 — 서울 전역·경기 12곳 투기과열지구·토지거래허가구역 지정 (2025-10-15)',
    url: 'https://www.korea.kr/news/policyNewsView.do?newsId=148950973',
  },
  {
    label: '10·15 대책 주담대 한도·스트레스 금리 (디지털데일리)',
    url: 'https://www.ddaily.co.kr/page/view/2025101510433284356',
  },
  { label: '지방세법 제11조(취득세율)·제13조의2(중과)', url: 'https://www.law.go.kr/법령/지방세법' },
  { label: '종합부동산세법', url: 'https://www.law.go.kr/법령/종합부동산세법' },
] as const;

/** 규제지역(조정대상지역·투기과열지구) — 시·도 이름 → 시·군·구 이름 목록. '*'는 전 지역 */
export const REGULATED_AREAS: Record<string, readonly string[]> = {
  서울특별시: ['*'],
  경기도: [
    '과천시',
    '광명시',
    '성남시 분당구',
    '성남시 수정구',
    '성남시 중원구',
    '수원시 영통구',
    '수원시 장안구',
    '수원시 팔달구',
    '안양시 동안구',
    '용인시 수지구',
    '의왕시',
    '하남시',
  ],
};

/** 수도권 시·도 (6억 한도·스트레스 금리 구분) */
export const CAPITAL_AREA_SIDO = ['서울특별시', '경기도', '인천광역시'] as const;

export type BuyerType = 'none' | 'firstTime' | 'oneHome' | 'multi';

export const BUYER_LABELS: Record<BuyerType, string> = {
  none: '무주택',
  firstTime: '생애최초 (무주택)',
  oneHome: '1주택 (기존 집 처분 조건)',
  multi: '다주택 (2주택 이상)',
};

/** LTV [비율] — 지역 구분 × 구입자 유형 */
export const LTV: Record<'regulated' | 'capital' | 'other', Record<BuyerType, number>> = {
  // 규제지역: 무주택·처분조건부 1주택 40%, 생애최초 70%, 다주택 주담대 금지
  regulated: { none: 0.4, firstTime: 0.7, oneHome: 0.4, multi: 0 },
  // 수도권 비규제: 70%, 생애최초 70%(6·27 대책 하향), 다주택 수도권 주담대 금지
  capital: { none: 0.7, firstTime: 0.7, oneHome: 0.7, multi: 0 },
  // 지방 비규제: 70%, 생애최초 80%, 다주택 60%
  other: { none: 0.7, firstTime: 0.8, oneHome: 0.7, multi: 0.6 },
};

/** 수도권·규제지역 주택 구입 주담대 총액 한도 [만원] — 시가 구간별 */
export const PRICE_CAPS: readonly { upTo: number; cap: number }[] = [
  { upTo: 150_000, cap: 60_000 }, // 15억 이하 → 6억
  { upTo: 250_000, cap: 40_000 }, // 25억 이하 → 4억
  { upTo: Infinity, cap: 20_000 }, // 25억 초과 → 2억
];

/** 차주 단위 DSR 한도 */
export const DSR_LIMIT = { bank: 0.4, nonBank: 0.5 } as const;
/** 스트레스 금리 가산 [%p] — 수도권·규제지역 3.0, 지방 0.75 */
export const STRESS_RATE = { capitalOrRegulated: 3.0, other: 0.75 } as const;
/** 수도권·규제지역 주담대 최대 만기 [년] */
export const MAX_TERM_YEARS_CAPITAL = 30;

// ── 취득세 (지방세법) ────────────────────────────────────
/** 1주택(또는 일시적 2주택) 표준세율: 6억 이하 1%, 6~9억 (가액×2/3억 − 3)/100, 9억 초과 3% */
export const ACQ_STD = { low: 60_000, high: 90_000 } as const;
/** 다주택 중과 [본세율, 지방교육세, 농특세(85㎡ 초과)] */
export const ACQ_HEAVY = {
  rate8: { base: 0.08, edu: 0.004, rural: 0.006 },
  rate12: { base: 0.12, edu: 0.004, rural: 0.01 },
} as const;
/** 생애최초 취득세 감면: 12억 이하, 최대 200만원 */
export const FIRST_HOME_RELIEF = { maxPrice: 120_000, maxManwon: 200 } as const;

// ── 보유세 ──────────────────────────────────────────────
/** 공시가격 시세 반영률(현실화율) 추정 — 공시가격을 모를 때 시세 × 이 값 */
export const PUBLIC_PRICE_RATIO = 0.69;

/** 재산세 공정시장가액비율 — 1세대1주택 특례(공시가 구간별), 그 밖 60% */
export const PROPERTY_FAIR_RATIO = {
  oneHome: [
    { upTo: 30_000, ratio: 0.43 },
    { upTo: 60_000, ratio: 0.44 },
    { upTo: Infinity, ratio: 0.45 },
  ],
  other: 0.6,
} as const;

/** 재산세 주택 세율 [과표 상한(만원), 세율, 누진공제(만원)] — 일반 / 1세대1주택 특례(공시가 9억 이하) */
export const PROPERTY_RATES = {
  standard: [
    { upTo: 6_000, rate: 0.001, deduct: 0 },
    { upTo: 15_000, rate: 0.0015, deduct: 3 },
    { upTo: 30_000, rate: 0.0025, deduct: 18 },
    { upTo: Infinity, rate: 0.004, deduct: 63 },
  ],
  oneHomeSpecial: [
    { upTo: 6_000, rate: 0.0005, deduct: 0 },
    { upTo: 15_000, rate: 0.001, deduct: 3 },
    { upTo: 30_000, rate: 0.002, deduct: 18 },
    { upTo: Infinity, rate: 0.0035, deduct: 63 },
  ],
  specialMaxPublicPrice: 90_000,
} as const;
/** 재산세 도시지역분(과표의 0.14%)·지방교육세(재산세의 20%) */
export const PROPERTY_EXTRA = { urban: 0.0014, eduOfTax: 0.2 } as const;

/** 종합부동산세 — 공제(1세대1주택 12억, 그 밖 9억), 공정시장가액비율 60% */
export const COMPREHENSIVE = {
  deduction: { oneHome: 120_000, other: 90_000 },
  fairRatio: 0.6,
  /** 2주택 이하 세율 [과표 상한(만원), 세율, 누진공제(만원)] */
  rates: [
    { upTo: 30_000, rate: 0.005, deduct: 0 },
    { upTo: 60_000, rate: 0.007, deduct: 60 },
    { upTo: 120_000, rate: 0.01, deduct: 240 },
    { upTo: 250_000, rate: 0.013, deduct: 600 },
    { upTo: 500_000, rate: 0.015, deduct: 1_100 },
    { upTo: 940_000, rate: 0.02, deduct: 3_600 },
    { upTo: Infinity, rate: 0.027, deduct: 10_180 },
  ],
  /** 3주택 이상: 과표 12억 초과 구간 중과 */
  ratesMulti: [
    { upTo: 30_000, rate: 0.005, deduct: 0 },
    { upTo: 60_000, rate: 0.007, deduct: 60 },
    { upTo: 120_000, rate: 0.01, deduct: 240 },
    { upTo: 250_000, rate: 0.02, deduct: 1_080 },
    { upTo: 500_000, rate: 0.03, deduct: 3_580 },
    { upTo: 940_000, rate: 0.04, deduct: 8_580 },
    { upTo: Infinity, rate: 0.05, deduct: 17_980 },
  ],
  ruralOfTax: 0.2,
} as const;
