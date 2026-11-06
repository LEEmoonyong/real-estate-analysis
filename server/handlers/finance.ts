// 금감원 금융상품한눈에 — 주택담보대출 금리 프록시 (확장 X4)
//   GET /api/finance/mortgage-rates   은행(020000) 아파트 담보·분할상환 상품의 금리 (최저·최고·전월 평균)
// 주의: finlife 오픈API는 https 연결이 끊겨 http로만 동작한다(2026-11 확인). 서버 간 호출이라 브라우저에는 키가 가지 않지만,
// 키가 평문 구간을 지나는 한계가 있다(README 한계 항목에 기록).
import { ApiError, fetchWithRetry, json, type ServerEnv } from '../http.js';

export interface MortgageRate {
  bank: string;
  product: string;
  rateType: '고정' | '변동';
  min: number | null;
  max: number | null;
  /** 전월 취급 평균 [%] */
  avg: number | null;
  /** 공시 월 'YYYYMM' */
  month: string;
}

interface FinlifeOption {
  fin_co_no: string;
  fin_prdt_cd: string;
  mrtg_type: string;
  rpay_type: string;
  lend_rate_type: string;
  lend_rate_min: number | null;
  lend_rate_max: number | null;
  lend_rate_avg: number | null;
  dcls_month: string;
}
interface FinlifeBase {
  fin_co_no: string;
  fin_prdt_cd: string;
  kor_co_nm: string;
  fin_prdt_nm: string;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** 아파트 담보(A)·분할상환(D) 옵션만, 은행·상품 이름 붙여 정리 */
export function normalizeMortgageRates(base: FinlifeBase[], options: FinlifeOption[]): MortgageRate[] {
  const names = new Map(base.map((b) => [`${b.fin_co_no}:${b.fin_prdt_cd}`, b]));
  const out: MortgageRate[] = [];
  for (const o of options) {
    if (o.mrtg_type !== 'A' || o.rpay_type !== 'D') continue;
    const b = names.get(`${o.fin_co_no}:${o.fin_prdt_cd}`);
    if (!b) continue;
    out.push({
      bank: b.kor_co_nm,
      product: b.fin_prdt_nm,
      rateType: o.lend_rate_type === 'F' ? '고정' : '변동',
      min: num(o.lend_rate_min),
      max: num(o.lend_rate_max),
      avg: num(o.lend_rate_avg),
      month: o.dcls_month,
    });
  }
  return out.sort((a, b) => (a.avg ?? a.min ?? 99) - (b.avg ?? b.min ?? 99));
}

export async function handleMortgageRates(env: ServerEnv): Promise<Response> {
  const key = env.FSS_FINLIFE_API_KEY;
  if (!key) throw new ApiError('NO_KEY', '금감원 금융상품한눈에 키가 설정되지 않았습니다.', 503);
  const res = await fetchWithRetry(
    `http://finlife.fss.or.kr/finlifeapi/mortgageLoanProductsSearch.json?auth=${encodeURIComponent(key)}&topFinGrpNo=020000&pageNo=1`,
    {},
    { timeoutMs: 10_000, retries: 1 },
  );
  if (!res.ok) throw new ApiError('UPSTREAM', `금감원 응답 ${res.status}`);
  const body = (await res.json()) as {
    result?: { err_cd?: string; err_msg?: string; baseList?: FinlifeBase[]; optionList?: FinlifeOption[] };
  };
  const r = body.result;
  if (!r || r.err_cd !== '000') {
    const msg = r?.err_msg ?? '알 수 없는 오류';
    throw new ApiError(/인증|키/.test(msg) ? 'NO_KEY' : 'UPSTREAM', `금감원 오류: ${msg}`);
  }
  // 공시가 월 단위라 하루 캐시
  return json({ ok: true, items: normalizeMortgageRates(r.baseList ?? [], r.optionList ?? []) }, 200, 86_400);
}
