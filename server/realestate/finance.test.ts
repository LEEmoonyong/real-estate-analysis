import { describe, expect, it } from 'vitest';
import { normalizeMortgageRates } from '../handlers/finance';
import { routeApi } from '../router';

describe('주담대 금리 정리', () => {
  it('아파트·분할상환만, 은행 이름 붙이고 평균 금리 낮은 순', () => {
    const base = [
      { fin_co_no: '1', fin_prdt_cd: 'a', kor_co_nm: '우리은행', fin_prdt_nm: '우리아파트론' },
      { fin_co_no: '2', fin_prdt_cd: 'b', kor_co_nm: '국민은행', fin_prdt_nm: 'KB주택담보' },
    ];
    const opt = (no: string, cd: string, mrtg: string, rpay: string, type: string, avg: number | null) => ({
      fin_co_no: no,
      fin_prdt_cd: cd,
      mrtg_type: mrtg,
      rpay_type: rpay,
      lend_rate_type: type,
      lend_rate_min: 4,
      lend_rate_max: 6,
      lend_rate_avg: avg,
      dcls_month: '202610',
    });
    const r = normalizeMortgageRates(base, [
      opt('1', 'a', 'A', 'D', 'F', 6.03),
      opt('1', 'a', 'A', 'S', 'C', 4.2), // 만기일시 제외
      opt('2', 'b', 'A', 'D', 'C', 4.5),
      opt('2', 'b', 'E', 'D', 'C', 3.9), // 아파트 외 제외
    ]);
    expect(r.map((x) => [x.bank, x.rateType, x.avg])).toEqual([
      ['국민은행', '변동', 4.5],
      ['우리은행', '고정', 6.03],
    ]);
  });

  it('키가 없으면 503', async () => {
    const res = await routeApi(new Request('http://localhost/api/finance/mortgage-rates'), {});
    expect(res.status).toBe(503);
  });
});
