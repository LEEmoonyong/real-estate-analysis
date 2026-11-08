// [요구사항: 데이터 처리] 로컬 데이터 — 전국 시·도 / 시·군·구 목록 (지역 선택 패널)
// regions.json은 scripts/build-regions.ts가 카카오 주소 검색으로 확인해 만든다(실거래 조회 코드 LAWD_CD + 대표 좌표).
// 2026-07 인천 개편(제물포구·영종구·서해구·검단구), 부천·화성 일반구까지 반영돼 있다.
import raw from './regions.json';

export interface RegionEntry {
  sido: string;
  /** 시·군·구 (일반구가 있는 시는 '수원시 장안구'처럼 구까지, 세종은 '') */
  sigungu: string;
  /** 실거래 조회 코드 5자리 */
  lawdCode: string;
  lat: number;
  lng: number;
}

export const REGIONS: readonly RegionEntry[] = raw as RegionEntry[];

/** 시·도 목록 (파일 순서 = 행정 순서) */
export const SIDO_LIST: readonly string[] = [...new Set(REGIONS.map((r) => r.sido))];

export function sigunguOf(sido: string): RegionEntry[] {
  return REGIONS.filter((r) => r.sido === sido);
}

export function findRegion(lawdCode: string): RegionEntry | undefined {
  return REGIONS.find((r) => r.lawdCode === lawdCode);
}

/** 화면에 쓰는 이름 — 세종은 시 이름만 */
export function regionLabel(r: Pick<RegionEntry, 'sido' | 'sigungu'>): string {
  return r.sigungu ? `${shortSido(r.sido)} ${r.sigungu}` : r.sido;
}

/** '서울특별시' → '서울', '경기도' → '경기', '전북특별자치도' → '전북' */
export function shortSido(sido: string): string {
  const special: Record<string, string> = {
    충청북도: '충북',
    충청남도: '충남',
    전라남도: '전남',
    경상북도: '경북',
    경상남도: '경남',
    전북특별자치도: '전북',
    강원특별자치도: '강원',
    제주특별자치도: '제주',
    세종특별자치시: '세종',
  };
  return special[sido] ?? sido.replace(/(특별시|광역시|도)$/, '');
}

/** 시·도 전체가 보이는 대략의 중심 (시·군·구 대표 좌표 평균) */
export function sidoCenter(sido: string): { lat: number; lng: number } | null {
  const list = sigunguOf(sido);
  if (list.length === 0) return null;
  return {
    lat: list.reduce((s, r) => s + r.lat, 0) / list.length,
    lng: list.reduce((s, r) => s + r.lng, 0) / list.length,
  };
}
