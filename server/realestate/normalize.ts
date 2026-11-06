// 국토교통부 공공데이터 응답 정규화 (실거래가 XML, 단지 목록·기본정보 JSON)
// [요구사항: 데이터 처리] 외부 API 응답 검증·정규화 → 앱이 쓰는 작은 JSON
// 서버 전용 코드(Vercel Node ESM)라 src/와 따로 둔다 — 상대 경로 import에 .js 확장자.

/** 평평한 <item> 목록 XML → 태그별 문자열 객체 (중첩 없는 공공데이터 응답 전용 단순 파서) */
export function parseXmlItems(xml: string): Record<string, string>[] {
  const items: Record<string, string>[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const item: Record<string, string> = {};
    for (const f of m[1]!.matchAll(/<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g)) item[f[1]!] = decodeXml(f[2]!).trim();
    items.push(item);
  }
  return items;
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** 응답 머리말 결과 코드 — 정상: '000'(실거래) / '00'(그 밖). 인증 오류는 OpenAPI_ServiceResponse 형식 */
export function dataGoKrError(body: string): { code: 'NO_KEY' | 'UPSTREAM' | 'NOT_FOUND'; message: string } | null {
  const auth = /<returnAuthMsg>([^<]*)<\/returnAuthMsg>/.exec(body) ?? /"returnAuthMsg"\s*:\s*"([^"]*)"/.exec(body);
  if (auth) {
    const msg = auth[1]!;
    if (/KEY|등록되지|인증/.test(msg)) return { code: 'NO_KEY', message: `공공데이터포털 인증 오류: ${msg}` };
    if (/NO_OPENAPI|없거나/.test(msg)) return { code: 'NOT_FOUND', message: `공공데이터포털 서비스 없음: ${msg}` };
    return { code: 'UPSTREAM', message: `공공데이터포털 오류: ${msg}` };
  }
  const code = /<resultCode>([^<]*)<\/resultCode>/.exec(body)?.[1] ?? /"resultCode"\s*:\s*"([^"]*)"/.exec(body)?.[1];
  if (code && code !== '000' && code !== '00') {
    const msg =
      /<resultMsg>([^<]*)<\/resultMsg>/.exec(body)?.[1] ?? /"resultMsg"\s*:\s*"([^"]*)"/.exec(body)?.[1] ?? '';
    return { code: 'UPSTREAM', message: `공공데이터포털 오류 ${code}: ${msg}` };
  }
  return null;
}

const num = (s: string | undefined): number | null => {
  if (s === undefined) return null;
  const v = Number(s.replace(/,/g, '').trim());
  return s.trim() === '' || !Number.isFinite(v) ? null : v;
};
const text = (s: string | undefined) => (s ?? '').trim();
const ymd = (y: string | undefined, m: string | undefined, d: string | undefined) =>
  `${text(y)}-${text(m).padStart(2, '0')}-${text(d).padStart(2, '0')}`;

/** 매매 실거래 한 건 */
export interface AptTrade {
  /** 실거래 단지 식별자 (예: 11710-6465) — 같은 단지 거래를 묶는 열쇠 */
  aptSeq: string;
  aptName: string;
  umdName: string;
  jibun: string;
  /** 'YYYY-MM-DD' */
  date: string;
  /** 거래금액 [만원] */
  price: number;
  /** 전용면적 [㎡] */
  area: number;
  floor: number | null;
  buildYear: number | null;
  /** 해제(취소)된 거래 — 집계에서 뺀다 */
  cancelled: boolean;
  dealType: string;
}

/** 전월세 실거래 한 건 */
export interface AptRent {
  aptSeq: string;
  aptName: string;
  umdName: string;
  jibun: string;
  date: string;
  /** 보증금 [만원] */
  deposit: number;
  /** 월세 [만원] (0이면 전세) */
  monthlyRent: number;
  area: number;
  floor: number | null;
  buildYear: number | null;
  /** 신규 / 갱신 (빈 값이면 미표기) */
  contractType: string;
}

export function normalizeTrade(it: Record<string, string>): AptTrade | null {
  const price = num(it.dealAmount);
  const area = num(it.excluUseAr);
  if (price === null || area === null || !it.aptNm) return null;
  return {
    aptSeq: text(it.aptSeq) || `${text(it.sggCd)}-${text(it.umdNm)}-${text(it.jibun)}`,
    aptName: text(it.aptNm),
    umdName: text(it.umdNm),
    jibun: text(it.jibun),
    date: ymd(it.dealYear, it.dealMonth, it.dealDay),
    price,
    area,
    floor: num(it.floor),
    buildYear: num(it.buildYear),
    cancelled: text(it.cdealType) !== '' || text(it.cdealDay) !== '',
    dealType: text(it.dealingGbn),
  };
}

export function normalizeRent(it: Record<string, string>): AptRent | null {
  const deposit = num(it.deposit);
  const area = num(it.excluUseAr);
  if (deposit === null || area === null || !it.aptNm) return null;
  return {
    aptSeq: text(it.aptSeq) || `${text(it.sggCd)}-${text(it.umdNm)}-${text(it.jibun)}`,
    aptName: text(it.aptNm),
    umdName: text(it.umdNm),
    jibun: text(it.jibun),
    date: ymd(it.dealYear, it.dealMonth, it.dealDay),
    deposit,
    monthlyRent: num(it.monthlyRent) ?? 0,
    area,
    floor: num(it.floor),
    buildYear: num(it.buildYear),
    contractType: text(it.contractType),
  };
}

/** 공동주택 단지 목록 한 건 */
export interface AptComplex {
  kaptCode: string;
  name: string;
  /** 법정동 코드 10자리 */
  bjdCode: string;
  sido: string;
  sigungu: string;
  dong: string;
}

export function normalizeComplex(it: Record<string, unknown>): AptComplex | null {
  const s = (k: string) => (typeof it[k] === 'string' ? (it[k] as string).trim() : '');
  if (!s('kaptCode') || !s('kaptName')) return null;
  return {
    kaptCode: s('kaptCode'),
    name: s('kaptName'),
    bjdCode: s('bjdCode'),
    sido: s('as1'),
    sigungu: s('as2'),
    dong: s('as3'),
  };
}

/** 공동주택 기본정보 (화면에 쓰는 항목만) */
export interface AptComplexInfo {
  kaptCode: string;
  name: string;
  address: string;
  roadAddress: string;
  households: number | null;
  dongCount: number | null;
  topFloor: number | null;
  baseFloor: number | null;
  /** 사용승인일 'YYYY-MM-DD' */
  approvedAt: string | null;
  heating: string;
  saleType: string;
  hallway: string;
  builder: string;
  developer: string;
  /** 연면적 [㎡] */
  totalArea: number | null;
  /** 전용면적별 세대수 (60㎡ 이하, 60~85, 85~135, 135 초과) */
  householdsByArea: [number | null, number | null, number | null, number | null];
}

export function normalizeComplexInfo(it: Record<string, unknown>): AptComplexInfo | null {
  const s = (k: string) => (typeof it[k] === 'string' ? (it[k] as string).trim() : '');
  const n = (k: string) => {
    const v = it[k];
    const x = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/,/g, '')) : NaN;
    return Number.isFinite(x) && !(typeof v === 'string' && v.trim() === '') ? x : null;
  };
  if (!s('kaptCode')) return null;
  const used = s('kaptUsedate');
  return {
    kaptCode: s('kaptCode'),
    name: s('kaptName'),
    address: s('kaptAddr'),
    roadAddress: s('doroJuso'),
    households: n('kaptdaCnt'),
    dongCount: n('kaptDongCnt'),
    topFloor: n('kaptTopFloor'),
    baseFloor: n('kaptBaseFloor'),
    approvedAt: /^\d{8}$/.test(used) ? `${used.slice(0, 4)}-${used.slice(4, 6)}-${used.slice(6, 8)}` : null,
    heating: s('codeHeatNm'),
    saleType: s('codeSaleNm'),
    hallway: s('codeHallNm'),
    builder: s('kaptBcompany'),
    developer: s('kaptAcompany'),
    totalArea: n('kaptTarea'),
    householdsByArea: [n('kaptMparea60'), n('kaptMparea85'), n('kaptMparea135'), n('kaptMparea136')],
  };
}
