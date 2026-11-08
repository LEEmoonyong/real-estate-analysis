// 주택 유형·거래 종류 (확장 X8) — 지도에서 고르는 아파트·오피스텔·빌라·단독·상가 × 매매·전세·월세 × 원룸·투룸
// 서버(server/realestate/property.ts)와 같은 값을 쓰는 화면용 이름·표시 규칙. React와 무관한 순수 함수.
import { formatManwon, formatManwonShort, perPyeong } from './format';

export type PropertyType = 'apt' | 'offi' | 'rh' | 'sh' | 'nrg';
export type DealKind = 'trade' | 'jeonse' | 'wolse';
export type RoomFilter = 'all' | 'one' | 'two';

export interface PropertyDeal {
  type: PropertyType;
  key: string;
  name: string;
  subType: string;
  umdName: string;
  jibun: string;
  masked: boolean;
  date: string;
  price: number;
  deposit: number;
  monthlyRent: number;
  area: number;
  floor: number | null;
  buildYear: number | null;
  cancelled: boolean;
}

/** 지도 표시 한 곳 — 건물(지번을 앎) 또는 법정동(지번 비공개) */
export interface DealPlace {
  key: string;
  type: PropertyType;
  level: 'building' | 'dong';
  name: string;
  subType: string;
  umdName: string;
  jibun: string;
  count: number;
  /** 매매: ㎡당 중앙값 [만원/㎡] / 전세: 보증금 중앙값 / 월세: 월세 중앙값 [만원] */
  value: number;
  depositMedian: number;
  areaMedian: number;
  buildYear: number | null;
  lastDate: string;
  recent: PropertyDeal[];
  lat: number | null;
  lng: number | null;
}

/** 지도 시세 조건 — 유형은 여러 개(체크), 거래 종류·방 구조는 하나 */
export interface MarketQuery {
  types: PropertyType[];
  kind: DealKind;
  room: RoomFilter;
}

export const DEFAULT_MARKET_QUERY: MarketQuery = { types: ['apt'], kind: 'trade', room: 'all' };

export const PROPERTY_TYPE_OPTIONS: readonly { id: PropertyType; label: string; hint: string }[] = [
  { id: 'apt', label: '아파트', hint: '아파트 실거래' },
  { id: 'offi', label: '오피스텔', hint: '오피스텔 실거래' },
  { id: 'rh', label: '빌라', hint: '연립·다세대 실거래' },
  { id: 'sh', label: '단독·다가구', hint: '단독·다가구 주택 실거래 (지번 비공개라 동 단위)' },
  { id: 'nrg', label: '상가', hint: '상업업무용 부동산 매매 (지번 비공개라 동 단위, 전월세 자료 없음)' },
];

export const DEAL_KIND_OPTIONS: readonly { id: DealKind; label: string }[] = [
  { id: 'trade', label: '매매' },
  { id: 'jeonse', label: '전세' },
  { id: 'wolse', label: '월세' },
];

export const ROOM_OPTIONS: readonly { id: RoomFilter; label: string; hint: string }[] = [
  { id: 'all', label: '전체', hint: '모든 면적' },
  { id: 'one', label: '원룸', hint: '전용 33㎡(10평) 이하로 추정' },
  { id: 'two', label: '투룸', hint: '전용 33~60㎡로 추정' },
];

/** 상가는 매매 자료만 공개된다 */
export function kindsFor(type: PropertyType): DealKind[] {
  return type === 'nrg' ? ['trade'] : ['trade', 'jeonse', 'wolse'];
}

/** 원룸·투룸은 오피스텔·빌라·단독/다가구에서만 고른다 (아파트·상가에는 맞지 않는 구분) */
export function roomApplies(type: PropertyType): boolean {
  return type === 'offi' || type === 'rh' || type === 'sh';
}

const TYPE_ORDER: readonly PropertyType[] = ['apt', 'offi', 'rh', 'sh', 'nrg'];

/**
 * 조건을 앞뒤가 맞게 고친다.
 * - 유형은 하나 이상, 정해진 순서로 (중복 없음)
 * - 고른 유형 중 그 거래 종류를 지원하는 것이 하나도 없으면 매매로 (예: 상가만 고르고 월세)
 * - 방 구조는 원룸·투룸이 의미 있는 유형이 하나라도 있을 때만
 */
export function normalizeQuery(q: MarketQuery): MarketQuery {
  const picked = TYPE_ORDER.filter((t) => q.types.includes(t));
  const types = picked.length > 0 ? picked : (['apt'] as PropertyType[]);
  const kind = types.some((t) => kindsFor(t).includes(q.kind)) ? q.kind : 'trade';
  const room = types.some(roomApplies) ? q.room : 'all';
  return { types, kind, room };
}

/** 실제로 불러올 유형 — 고른 유형 중 이 거래 종류 자료가 있는 것 (상가는 매매만) */
export function activeTypes(q: MarketQuery): PropertyType[] {
  return q.types.filter((t) => kindsFor(t).includes(q.kind));
}

/** 유형 체크를 켜고 끈다 (마지막 하나는 끌 수 없다) */
export function toggleType(q: MarketQuery, type: PropertyType): MarketQuery {
  const on = q.types.includes(type);
  if (on && q.types.length === 1) return q;
  return normalizeQuery({ ...q, types: on ? q.types.filter((t) => t !== type) : [...q.types, type] });
}

/** 지도 표시에 붙이는 짧은 유형 이름 (여러 유형을 함께 볼 때) */
export function typeShort(type: PropertyType): string {
  return { apt: '아파트', offi: '오피', rh: '빌라', sh: '단독', nrg: '상가' }[type];
}

export function typesLabel(types: readonly PropertyType[]): string {
  return types.map(typeLabel).join('·');
}

export function typeLabel(type: PropertyType): string {
  return PROPERTY_TYPE_OPTIONS.find((o) => o.id === type)?.label ?? type;
}

export function kindLabel(kind: DealKind): string {
  return DEAL_KIND_OPTIONS.find((o) => o.id === kind)?.label ?? kind;
}

/** 면적의 뜻 — 단독은 연면적, 상가는 건물면적 */
export function areaLabel(type: PropertyType): string {
  return type === 'sh' ? '연면적' : type === 'nrg' ? '건물면적' : '전용';
}

/** 필터·색 구분에 쓰는 값: 매매 = 평당가, 전세 = 보증금, 월세 = 월세 [만원] */
export function filterValue(place: Pick<DealPlace, 'value'>, kind: DealKind): number {
  return kind === 'trade' ? perPyeong(place.value) : place.value;
}

/** 지도 표시 글자 (굵게 한 줄 + 작게 한 줄) */
export function markerText(
  place: Pick<DealPlace, 'value' | 'depositMedian'>,
  kind: DealKind,
): { main: string; sub?: string } {
  if (kind === 'trade') return { main: `평당 ${formatManwonShort(perPyeong(place.value))}` };
  if (kind === 'jeonse') return { main: `전세 ${formatManwonShort(place.value)}` };
  return { main: `월 ${Math.round(place.value)}만`, sub: `보증 ${formatManwonShort(place.depositMedian)}` };
}

/** 거래 한 건 금액 글자 */
export function dealAmountText(deal: Pick<PropertyDeal, 'price' | 'deposit' | 'monthlyRent'>, kind: DealKind): string {
  if (kind === 'trade') return formatManwon(deal.price);
  if (kind === 'jeonse') return `전세 ${formatManwon(deal.deposit)}`;
  return `${formatManwon(deal.deposit)} / 월 ${Math.round(deal.monthlyRent)}만`;
}

/** 거래 종류별 필터 단계 [만원] */
export const FILTER_STEPS: Record<DealKind, readonly number[]> = {
  trade: [2_000, 3_000, 4_000, 5_000, 6_000, 8_000, 10_000, 15_000],
  jeonse: [10_000, 20_000, 30_000, 50_000, 70_000, 100_000, 150_000],
  wolse: [30, 50, 70, 100, 150, 200, 300],
};

export function stepLabel(kind: DealKind, v: number): string {
  return kind === 'trade'
    ? `평당 ${formatManwonShort(v)}`
    : kind === 'jeonse'
      ? `전세 ${formatManwonShort(v)}`
      : `월 ${v}만`;
}

/** 지도 범례·안내 문구에 쓰는 기준 설명 */
export function valueDescription(kind: DealKind, types: readonly PropertyType[]): string {
  if (kind === 'trade') {
    const only = types.length === 1 ? types[0] : null;
    return `${only === 'sh' ? '연면적' : only === 'nrg' ? '건물면적' : only ? '전용면적' : '면적'} 기준 평당가 중앙값`;
  }
  if (kind === 'jeonse') return '전세 보증금 중앙값';
  return '월세 중앙값 (보증금 중앙값 함께)';
}
