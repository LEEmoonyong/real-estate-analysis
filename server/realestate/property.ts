// 주택 유형별 실거래 정규화·묶기 (확장 X8) — 아파트·오피스텔·연립다세대(빌라)·단독/다가구·상업업무용(상가)
// [요구사항: 데이터 처리] 유형마다 다른 XML 필드를 하나의 거래 형식으로 맞춘다.
// 서버 전용 코드(Vercel Node ESM) — 상대 경로 import에 .js 확장자.
//
// 주의: 단독/다가구 매매는 지번이 가려져(예: 3*) 나오고 전월세는 지번 항목이 아예 없다. 상업업무용도 일반 건물은 가려지고
// 집합 건물(상가·오피스 호실)은 지번이 나온다(2026-11 실측). 지번을 모르는 거래는 건물이 아니라 법정동 단위로 묶는다.
// 원룸·투룸은 실거래 자료에 방 수가 없어 전용(계약)면적으로 추정한다.

export const PROPERTY_TYPES = ['apt', 'offi', 'rh', 'sh', 'nrg'] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const DEAL_KINDS = ['trade', 'jeonse', 'wolse'] as const;
export type DealKind = (typeof DEAL_KINDS)[number];

export const ROOM_FILTERS = ['all', 'one', 'two'] as const;
export type RoomFilter = (typeof ROOM_FILTERS)[number];

/** 국토교통부 실거래 서비스 이름 (매매 / 전월세). 상업업무용은 전월세 자료가 없다 */
export const RTMS_SERVICES: Record<PropertyType, { trade: string; rent: string | null }> = {
  apt: { trade: 'RTMSDataSvcAptTradeDev', rent: 'RTMSDataSvcAptRent' },
  offi: { trade: 'RTMSDataSvcOffiTrade', rent: 'RTMSDataSvcOffiRent' },
  rh: { trade: 'RTMSDataSvcRHTrade', rent: 'RTMSDataSvcRHRent' },
  sh: { trade: 'RTMSDataSvcSHTrade', rent: 'RTMSDataSvcSHRent' },
  nrg: { trade: 'RTMSDataSvcNrgTrade', rent: null },
};

/** 원룸·투룸 면적 추정 [㎡] — 원룸: 33㎡(10평) 이하, 투룸: 33㎡ 초과 60㎡ 이하 */
export const ROOM_AREA: Record<Exclude<RoomFilter, 'all'>, { min: number; max: number }> = {
  one: { min: 0, max: 33 },
  two: { min: 33.0001, max: 60 },
};

export interface PropertyDeal {
  type: PropertyType;
  /** 같은 건물(또는 같은 동)을 묶는 열쇠 */
  key: string;
  /** 건물 이름 (단독·상가처럼 없으면 유형 이름, 예: 다가구·근린생활) */
  name: string;
  /** 연립·다세대, 단독·다가구, 집합·일반 등 세부 유형 (없으면 '') */
  subType: string;
  umdName: string;
  jibun: string;
  /** 지번이 가려져 동 단위로만 위치를 알 수 있음 */
  masked: boolean;
  date: string;
  /** 매매 금액 [만원] (전월세는 0) */
  price: number;
  /** 보증금·월세 [만원] (매매는 0) */
  deposit: number;
  monthlyRent: number;
  /** 면적 [㎡] — 전용면적(아파트·오피스텔·빌라), 연면적(단독), 건물면적(상가) */
  area: number;
  floor: number | null;
  buildYear: number | null;
  cancelled: boolean;
}

const num = (s: string | undefined): number | null => {
  if (s === undefined) return null;
  const v = Number(s.replace(/,/g, '').trim());
  return s.trim() === '' || !Number.isFinite(v) ? null : v;
};
const text = (s: string | undefined) => (s ?? '').trim();
const first = (it: Record<string, string>, keys: readonly string[]) => {
  for (const k of keys) if (text(it[k])) return text(it[k]);
  return '';
};
const firstNum = (it: Record<string, string>, keys: readonly string[]) => {
  for (const k of keys) {
    const v = num(it[k]);
    if (v !== null && v > 0) return v;
  }
  return null;
};
const ymd = (it: Record<string, string>) =>
  `${text(it.dealYear)}-${text(it.dealMonth).padStart(2, '0')}-${text(it.dealDay).padStart(2, '0')}`;

const NAME_FIELDS: Record<PropertyType, readonly string[]> = {
  apt: ['aptNm'],
  offi: ['offiNm'],
  rh: ['mhouseNm'],
  sh: [],
  nrg: [],
};
const SUBTYPE_FIELDS = ['houseType', 'buildingType', 'buildingUse'] as const;
const AREA_FIELDS = ['excluUseAr', 'totalFloorAr', 'buildingAr', 'contractArea', 'plottageAr'] as const;
const TYPE_LABEL: Record<PropertyType, string> = {
  apt: '아파트',
  offi: '오피스텔',
  rh: '연립·다세대',
  sh: '단독·다가구',
  nrg: '상업업무용',
};

export const isMaskedJibun = (jibun: string) => jibun === '' || jibun.includes('*');

/** XML <item> 한 건 → 거래 (필수 값이 없으면 null) */
export function normalizeDeal(type: PropertyType, rent: boolean, it: Record<string, string>): PropertyDeal | null {
  const area = firstNum(it, AREA_FIELDS);
  if (area === null) return null;
  const price = rent ? 0 : num(it.dealAmount);
  const deposit = rent ? num(it.deposit) : 0;
  if (price === null || deposit === null) return null;
  const subType = first(it, SUBTYPE_FIELDS);
  const umdName = text(it.umdNm);
  const jibun = text(it.jibun);
  const masked = isMaskedJibun(jibun);
  let name = first(it, NAME_FIELDS[type]);
  // 빌라는 이름이 없으면 '(127-25)'처럼 지번이 이름 자리에 온다 → '다세대 127-25'
  if (!name || /^\(.*\)$/.test(name)) name = '';
  if (!name) {
    if (type === 'nrg') name = [text(it.buildingType), text(it.buildingUse)].filter(Boolean).join(' ');
    else if (!masked) name = `${subType || TYPE_LABEL[type]} ${jibun}`;
    name ||= subType || TYPE_LABEL[type];
  }
  // 같은 지번은 같은 건물로 본다 (아파트는 실거래 단지 식별자)
  const key =
    type === 'apt' && text(it.aptSeq) ? text(it.aptSeq) : masked ? `${type}|${umdName}` : `${type}|${umdName}|${jibun}`;
  return {
    type,
    key,
    name,
    subType,
    umdName,
    jibun: masked ? '' : jibun,
    masked,
    date: ymd(it),
    price,
    deposit,
    monthlyRent: rent ? (num(it.monthlyRent) ?? 0) : 0,
    area,
    floor: num(it.floor),
    buildYear: num(it.buildYear),
    cancelled: text(it.cdealType) !== '' || text(it.cdealDay) !== '',
  };
}

/** 거래 종류(매매·전세·월세)와 방 구조(면적 추정)로 거르기 */
export function filterDeals(deals: readonly PropertyDeal[], kind: DealKind, room: RoomFilter): PropertyDeal[] {
  const range = room === 'all' ? null : ROOM_AREA[room];
  return deals.filter((d) => {
    if (d.cancelled) return false;
    if (kind === 'jeonse' && d.monthlyRent !== 0) return false;
    if (kind === 'wolse' && d.monthlyRent === 0) return false;
    if (range && (d.area < range.min || d.area > range.max)) return false;
    return true;
  });
}

/** 지도 표시 한 곳 (건물 또는 법정동) */
export interface DealPlace {
  key: string;
  type: PropertyType;
  /** 'building' = 지번까지 아는 건물, 'dong' = 지번이 가려져 법정동 중심에 표시 */
  level: 'building' | 'dong';
  name: string;
  subType: string;
  umdName: string;
  jibun: string;
  count: number;
  /** 매매: ㎡당 중앙값 [만원/㎡] / 전세: 보증금 중앙값 / 월세: 월세 중앙값 [만원] */
  value: number;
  /** 월세일 때 보증금 중앙값 [만원] (그 밖에는 0) */
  depositMedian: number;
  areaMedian: number;
  buildYear: number | null;
  lastDate: string;
  /** 최근 거래 몇 건 (최신순) — 지도 카드에 바로 보여 준다 */
  recent: PropertyDeal[];
  lat: number | null;
  lng: number | null;
}

const RECENT_LIMIT = 8;

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** 걸러 낸 거래를 건물(또는 동)별로 묶어 요약 — 거래가 많은 곳부터 */
export function groupDeals(deals: readonly PropertyDeal[], kind: DealKind): Omit<DealPlace, 'lat' | 'lng'>[] {
  const groups = new Map<string, PropertyDeal[]>();
  for (const d of deals) {
    const list = groups.get(d.key);
    if (list) list.push(d);
    else groups.set(d.key, [d]);
  }
  return [...groups.values()]
    .map((list) => {
      const sorted = [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
      const last = sorted[0]!;
      const value =
        kind === 'trade'
          ? median(list.map((d) => d.price / d.area))
          : kind === 'jeonse'
            ? median(list.map((d) => d.deposit))
            : median(list.map((d) => d.monthlyRent));
      return {
        key: last.key,
        type: last.type,
        level: last.masked ? ('dong' as const) : ('building' as const),
        name: last.masked ? `${last.umdName} ${TYPE_LABEL[last.type]}` : last.name,
        subType: last.subType,
        umdName: last.umdName,
        jibun: last.jibun,
        count: list.length,
        value: Math.round(value * 10) / 10,
        depositMedian: kind === 'wolse' ? Math.round(median(list.map((d) => d.deposit))) : 0,
        areaMedian: Math.round(median(list.map((d) => d.area)) * 10) / 10,
        buildYear: last.buildYear,
        lastDate: last.date,
        recent: sorted.slice(0, RECENT_LIMIT),
      };
    })
    .sort((a, b) => b.count - a.count);
}
