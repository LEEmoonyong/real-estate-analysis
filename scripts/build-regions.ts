// 시·도 / 시·군·구 목록 만들기 (지역 선택 패널용) — `npm run build:regions` (.env.local에 KAKAO_REST_API_KEY 필요)
//
// 2026-07 인천 개편(제물포구·영종구·서해구·검단구), 부천·화성 일반구 반영. 실거래 자료도 새 코드로 나온다(옛 코드는 0건).
// 아래 이름 목록을 카카오 주소 검색으로 하나씩 확인해, 실거래 조회 코드(LAWD_CD = 법정동 코드 앞 5자리)와
// 대표 좌표를 붙여 src/data/regions/regions.json에 저장한다. 주소 검색 결과의 지역 이름이 정확히 같을 때만 쓰고,
// 없는 이름(행정구역 개편으로 사라진 곳 등)은 건너뛰고 알려 준다. 개편이 있으면 목록을 고치고 다시 실행한다.
// 키 값은 출력하지 않는다.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const OUT = 'src/data/regions/regions.json';

/** 시·도 → 시·군·구 (일반구가 있는 시는 구 단위 — 실거래 자료가 구 단위로 나온다) */
const NAMES: Record<string, string[]> = {
  서울특별시:
    '종로구 중구 용산구 성동구 광진구 동대문구 중랑구 성북구 강북구 도봉구 노원구 은평구 서대문구 마포구 양천구 강서구 구로구 금천구 영등포구 동작구 관악구 서초구 강남구 송파구 강동구'.split(
      ' ',
    ),
  부산광역시:
    '중구 서구 동구 영도구 부산진구 동래구 남구 북구 해운대구 사하구 금정구 강서구 연제구 수영구 사상구 기장군'.split(
      ' ',
    ),
  대구광역시: '중구 동구 서구 남구 북구 수성구 달서구 달성군 군위군'.split(' '),
  인천광역시: '제물포구 영종구 미추홀구 연수구 남동구 부평구 계양구 서해구 검단구 강화군 옹진군'.split(' '),
  광주광역시: '동구 서구 남구 북구 광산구'.split(' '),
  대전광역시: '동구 중구 서구 유성구 대덕구'.split(' '),
  울산광역시: '중구 남구 동구 북구 울주군'.split(' '),
  세종특별자치시: [''],
  경기도: [
    '수원시 장안구',
    '수원시 권선구',
    '수원시 팔달구',
    '수원시 영통구',
    '성남시 수정구',
    '성남시 중원구',
    '성남시 분당구',
    '의정부시',
    '안양시 만안구',
    '안양시 동안구',
    '부천시 원미구',
    '부천시 소사구',
    '부천시 오정구',
    '광명시',
    '평택시',
    '동두천시',
    '안산시 상록구',
    '안산시 단원구',
    '고양시 덕양구',
    '고양시 일산동구',
    '고양시 일산서구',
    '과천시',
    '구리시',
    '남양주시',
    '오산시',
    '시흥시',
    '군포시',
    '의왕시',
    '하남시',
    '용인시 처인구',
    '용인시 기흥구',
    '용인시 수지구',
    '파주시',
    '이천시',
    '안성시',
    '김포시',
    '화성시 만세구',
    '화성시 효행구',
    '화성시 병점구',
    '화성시 동탄구',
    '광주시',
    '양주시',
    '포천시',
    '여주시',
    '연천군',
    '가평군',
    '양평군',
  ],
  강원특별자치도:
    '춘천시 원주시 강릉시 동해시 태백시 속초시 삼척시 홍천군 횡성군 영월군 평창군 정선군 철원군 화천군 양구군 인제군 고성군 양양군'.split(
      ' ',
    ),
  충청북도: [
    '청주시 상당구',
    '청주시 서원구',
    '청주시 흥덕구',
    '청주시 청원구',
    ...'충주시 제천시 보은군 옥천군 영동군 증평군 진천군 괴산군 음성군 단양군'.split(' '),
  ],
  충청남도: [
    '천안시 동남구',
    '천안시 서북구',
    ...'공주시 보령시 아산시 서산시 논산시 계룡시 당진시 금산군 부여군 서천군 청양군 홍성군 예산군 태안군'.split(' '),
  ],
  전북특별자치도: [
    '전주시 완산구',
    '전주시 덕진구',
    ...'군산시 익산시 정읍시 남원시 김제시 완주군 진안군 무주군 장수군 임실군 순창군 고창군 부안군'.split(' '),
  ],
  전라남도:
    '목포시 여수시 순천시 나주시 광양시 담양군 곡성군 구례군 고흥군 보성군 화순군 장흥군 강진군 해남군 영암군 무안군 함평군 영광군 장성군 완도군 진도군 신안군'.split(
      ' ',
    ),
  경상북도: [
    '포항시 남구',
    '포항시 북구',
    ...'경주시 김천시 안동시 구미시 영주시 영천시 상주시 문경시 경산시 의성군 청송군 영양군 영덕군 청도군 고령군 성주군 칠곡군 예천군 봉화군 울진군 울릉군'.split(
      ' ',
    ),
  ],
  경상남도: [
    '창원시 의창구',
    '창원시 성산구',
    '창원시 마산합포구',
    '창원시 마산회원구',
    '창원시 진해구',
    ...'진주시 통영시 사천시 김해시 밀양시 거제시 양산시 의령군 함안군 창녕군 고성군 남해군 하동군 산청군 함양군 거창군 합천군'.split(
      ' ',
    ),
  ],
  제주특별자치도: ['제주시', '서귀포시'],
};

interface KakaoDoc {
  address_name: string;
  address_type: string;
  x: string;
  y: string;
  address?: { b_code?: string; region_1depth_name?: string; region_2depth_name?: string } | null;
}

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => [m[1]!, m[2]!.trim()]),
);
const KEY = env.KAKAO_REST_API_KEY;
if (!KEY) throw new Error('.env.local에 KAKAO_REST_API_KEY가 없습니다.');

async function lookup(query: string, sigungu: string): Promise<KakaoDoc | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}&size=5`,
      { headers: { Authorization: `KakaoAK ${KEY}` } },
    );
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`카카오 주소 검색 실패 ${res.status}`);
    const docs = ((await res.json()) as { documents?: KakaoDoc[] }).documents ?? [];
    // 시·군·구 단위 지역 결과이고 이름이 정확히 같은 것만 (비슷한 이름으로 바꿔 찾아 준 결과는 버린다)
    // 카카오는 시·도를 '서울'처럼 줄여 쓰므로 시·군·구 이름(region_2depth_name)으로 비교한다
    return (
      docs.find(
        (d) =>
          d.address_type === 'REGION' &&
          (d.address?.region_2depth_name ?? '') === sigungu &&
          /^\d{5}0{5}$/.test(d.address?.b_code ?? ''),
      ) ?? null
    );
  }
  return null;
}

interface RegionEntry {
  sido: string;
  sigungu: string;
  lawdCode: string;
  lat: number;
  lng: number;
}

const out: RegionEntry[] = [];
const missing: string[] = [];
for (const [sido, list] of Object.entries(NAMES)) {
  for (const sigungu of list) {
    const query = sigungu ? `${sido} ${sigungu}` : sido;
    const doc = await lookup(query, sigungu);
    if (!doc) {
      missing.push(query);
      continue;
    }
    // 세종은 법정동 코드가 36000…이지만 실거래 자료는 36110(세종시)으로 조회한다
    const lawdCode = sido === '세종특별자치시' ? '36110' : doc.address!.b_code!.slice(0, 5);
    // 일반구가 생긴 시는 시 전체 이름이 구와 같은 코드로 겹칠 수 있다 → 먼저 넣은 구 단위만 남긴다
    if (out.some((e) => e.lawdCode === lawdCode)) {
      missing.push(`${query} (코드 ${lawdCode} 중복)`);
      continue;
    }
    out.push({ sido, sigungu, lawdCode, lat: Number(Number(doc.y).toFixed(5)), lng: Number(Number(doc.x).toFixed(5)) });
  }
}

mkdirSync('src/data/regions', { recursive: true });
writeFileSync(OUT, `${JSON.stringify(out, null, 0).replace(/},{/g, '},\n{')}\n`);
console.log(`시·군·구 ${out.length}곳 → ${OUT}`);
if (missing.length) console.log(`건너뜀 ${missing.length}곳:\n  ${missing.join('\n  ')}`);
