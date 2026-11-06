import { describe, expect, it } from 'vitest';
import {
  dataGoKrError,
  normalizeComplex,
  normalizeComplexInfo,
  normalizeRent,
  normalizeTrade,
  parseXmlItems,
} from './normalize';

// 2026-11 실제 응답에서 잘라 온 형태 (값 일부 변경)
const TRADE_XML = `<?xml version="1.0" encoding="utf-8" standalone="yes"?><response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header><body><items>
<item><aptDong> </aptDong><aptNm>팰리스힐</aptNm><aptSeq>11710-6465</aptSeq><buildYear>2009</buildYear><cdealDay> </cdealDay><cdealType> </cdealType><dealAmount>80,000</dealAmount><dealDay>8</dealDay><dealMonth>9</dealMonth><dealYear>2026</dealYear><dealingGbn>중개거래</dealingGbn><excluUseAr>84.29</excluUseAr><floor>6</floor><jibun>127-1</jibun><sggCd>11710</sggCd><umdCd>11300</umdCd><umdNm>거여동</umdNm></item>
<item><aptNm>A&amp;B 타워</aptNm><aptSeq>11710-1</aptSeq><buildYear>2010</buildYear><cdealDay>26.09.20</cdealDay><cdealType>O</cdealType><dealAmount>120,500</dealAmount><dealDay>1</dealDay><dealMonth>10</dealMonth><dealYear>2026</dealYear><excluUseAr>59.9</excluUseAr><floor>-1</floor><jibun>1</jibun><umdNm>잠실동</umdNm></item>
</items><numOfRows>10</numOfRows><pageNo>1</pageNo><totalCount>2</totalCount></body></response>`;

describe('공공데이터 실거래 XML', () => {
  it('item 목록을 태그별로 읽고 엔티티를 푼다', () => {
    const items = parseXmlItems(TRADE_XML);
    expect(items).toHaveLength(2);
    expect(items[1]!.aptNm).toBe('A&B 타워');
    expect(items[0]!.aptDong).toBe('');
  });

  it('매매: 금액 쉼표 제거(만원), 날짜, 해제 거래 표시', () => {
    const [a, b] = parseXmlItems(TRADE_XML).map(normalizeTrade);
    expect(a).toEqual({
      aptSeq: '11710-6465',
      aptName: '팰리스힐',
      umdName: '거여동',
      jibun: '127-1',
      date: '2026-09-08',
      price: 80000,
      area: 84.29,
      floor: 6,
      buildYear: 2009,
      cancelled: false,
      dealType: '중개거래',
    });
    expect(b).toMatchObject({ price: 120500, date: '2026-10-01', floor: -1, cancelled: true });
  });

  it('전월세: 월세 0이면 전세', () => {
    const r = normalizeRent({
      aptNm: '거여6단지',
      aptSeq: '11710-5897',
      buildYear: '1997',
      dealDay: '7',
      dealMonth: '9',
      dealYear: '2026',
      deposit: '1,192',
      excluUseAr: '39.15',
      floor: '9',
      jibun: '295',
      monthlyRent: '0',
      umdNm: '거여동',
      contractType: '',
    });
    expect(r).toMatchObject({ deposit: 1192, monthlyRent: 0, area: 39.15, date: '2026-09-07' });
  });

  it('필수 값이 없으면 버린다', () => {
    expect(normalizeTrade({ aptNm: 'x', dealAmount: '', excluUseAr: '84' })).toBeNull();
    expect(normalizeRent({ deposit: '100', excluUseAr: '84' })).toBeNull();
  });

  it('오류 응답 판별', () => {
    expect(dataGoKrError(TRADE_XML)).toBeNull();
    expect(
      dataGoKrError(
        '<OpenAPI_ServiceResponse><cmmMsgHeader><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg></cmmMsgHeader></OpenAPI_ServiceResponse>',
      ),
    ).toMatchObject({ code: 'NO_KEY' });
    expect(
      dataGoKrError(
        '{"OpenAPI_ServiceResponse":{"cmmMsgHeader":{"returnAuthMsg":"해당 오픈API 서비스가 없거나 폐기됨"}}}',
      ),
    ).toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(
      dataGoKrError('<response><header><resultCode>03</resultCode><resultMsg>NO DATA</resultMsg></header></response>'),
    ).toMatchObject({
      code: 'UPSTREAM',
    });
  });
});

describe('단지 목록·기본정보', () => {
  it('단지 목록', () => {
    expect(
      normalizeComplex({
        kaptCode: 'A10023070',
        kaptName: '잠실 센트럴파크',
        bjdCode: '1171010100',
        as1: '서울특별시',
        as2: '송파구',
        as3: '잠실동',
        as4: null,
      }),
    ).toEqual({
      kaptCode: 'A10023070',
      name: '잠실 센트럴파크',
      bjdCode: '1171010100',
      sido: '서울특별시',
      sigungu: '송파구',
      dong: '잠실동',
    });
    expect(normalizeComplex({ kaptName: 'x' })).toBeNull();
  });

  it('기본정보: 사용승인일·숫자·없는 값', () => {
    const info = normalizeComplexInfo({
      kaptCode: 'A1',
      kaptName: '단지',
      kaptUsedate: '20080915',
      kaptdaCnt: 5678,
      kaptDongCnt: '72',
      kaptTopFloor: 33,
      kaptMparea60: 1000,
      kaptMparea85: null,
      codeHeatNm: '지역난방',
    });
    expect(info).toMatchObject({
      approvedAt: '2008-09-15',
      households: 5678,
      dongCount: 72,
      topFloor: 33,
      heating: '지역난방',
    });
    expect(info!.householdsByArea).toEqual([1000, null, null, null]);
    expect(normalizeComplexInfo({ kaptCode: null })).toBeNull(); // 없는 단지 코드는 모든 값이 null로 온다
  });
});
