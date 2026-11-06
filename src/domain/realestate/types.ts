// 부동산 데이터 타입 (서버 프록시 응답과 같은 모양 — server/realestate/normalize.ts, server/handlers/realestate.ts)

export interface Region {
  /** 법정동 코드 10자리 */
  bjdCode: string;
  /** 시군구 코드 5자리 (실거래 조회 LAWD_CD) */
  lawdCode: string;
  sido: string;
  sigungu: string;
  dong: string;
}

export interface AptTrade {
  aptSeq: string;
  aptName: string;
  umdName: string;
  jibun: string;
  date: string;
  /** [만원] */
  price: number;
  /** 전용면적 [㎡] */
  area: number;
  floor: number | null;
  buildYear: number | null;
  cancelled: boolean;
  dealType: string;
}

export interface AptRent {
  aptSeq: string;
  aptName: string;
  umdName: string;
  jibun: string;
  date: string;
  /** [만원] */
  deposit: number;
  /** [만원] 0이면 전세 */
  monthlyRent: number;
  area: number;
  floor: number | null;
  buildYear: number | null;
  contractType: string;
}

/** 지도 표시용 거래된 단지 요약 */
export interface TradeComplex {
  aptSeq: string;
  aptName: string;
  umdName: string;
  jibun: string;
  buildYear: number | null;
  count: number;
  /** [만원/㎡] */
  medianPricePerM2: number;
  lastDate: string;
  lastPrice: number;
  lastArea: number;
  lat: number | null;
  lng: number | null;
}

export interface AptComplex {
  kaptCode: string;
  name: string;
  bjdCode: string;
  sido: string;
  sigungu: string;
  dong: string;
}

export interface AptComplexInfo {
  kaptCode: string;
  name: string;
  address: string;
  roadAddress: string;
  households: number | null;
  dongCount: number | null;
  topFloor: number | null;
  baseFloor: number | null;
  approvedAt: string | null;
  heating: string;
  saleType: string;
  hallway: string;
  builder: string;
  developer: string;
  totalArea: number | null;
  householdsByArea: [number | null, number | null, number | null, number | null];
}

/** 1평 = 3.305785㎡ */
export const M2_PER_PYEONG = 3.305785;
