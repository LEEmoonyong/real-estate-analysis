// 단지 연결 점검 — `npx tsx scripts/audit-complex-match.ts` (키가 있는 개발 서버가 켜져 있어야 함)
// 여러 시·군·구의 최근 6달 실거래 단지를 공동주택 단지 목록과 앱과 같은 규칙(matchComplex)으로 맞춰 보고,
// 연결되지 않은 단지와 같은 법정동의 목록 이름을 출력한다. 규칙을 바꾼 뒤 연결률이 떨어지지 않았는지 확인하는 용도.
import { matchComplex } from '../src/domain/realestate/match';

const BASE = process.env.AUDIT_BASE ?? 'http://localhost:5173';
const REGIONS: [string, string][] = [
  ['11710', '서울특별시 송파구'],
  ['11680', '서울특별시 강남구'],
  ['11650', '서울특별시 서초구'],
  ['11350', '서울특별시 노원구'],
  ['11440', '서울특별시 마포구'],
  ['41135', '경기도 성남시 분당구'],
  ['41450', '경기도 하남시'],
  ['26350', '부산광역시 해운대구'],
  ['36110', '세종특별자치시 '],
];

interface TradeComplex {
  aptName: string;
  umdName: string;
  jibun: string;
  count: number;
}
interface Kapt {
  kaptCode: string;
  name: string;
  dong: string;
  sigungu: string;
}

const get = async <T>(path: string): Promise<T> => {
  const r = await fetch(BASE + path);
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return (await r.json()) as T;
};

let totalAll = 0;
let matchedAll = 0;
for (const [lawd, area] of REGIONS) {
  const trades = (
    await get<{ items: TradeComplex[] }>(
      `/api/realestate/trade-complexes?lawd=${lawd}&ym=202610&months=6&area=${encodeURIComponent(area.trim())}`,
    )
  ).items;
  const kapt = (await get<{ items: Kapt[] }>(`/api/realestate/complexes?sigungu=${lawd}`)).items;
  const refs = kapt.map((c) => ({ kaptCode: c.kaptCode, name: c.name, dong: c.dong, jibun: '', sigungu: c.sigungu }));
  const misses: TradeComplex[] = [];
  for (const t of trades) {
    const m = matchComplex({ aptName: t.aptName, umdName: t.umdName, jibun: t.jibun }, refs);
    if (!m) misses.push(t);
    else if (process.env.AUDIT_SHOW_WEAK && m.score < 0.9)
      console.log(`  ~ ${t.aptName} → ${kapt.find((c) => c.kaptCode === m.kaptCode)?.name} (${m.score.toFixed(2)})`);
  }
  totalAll += trades.length;
  matchedAll += trades.length - misses.length;
  console.log(
    `\n## ${area.trim()} — 거래 단지 ${trades.length}곳 중 연결 ${trades.length - misses.length}곳 (목록 ${kapt.length}곳)`,
  );
  for (const t of misses.sort((a, b) => b.count - a.count)) {
    const sameDong = kapt.filter((c) => c.dong === t.umdName).map((c) => c.name);
    console.log(
      `  ✗ ${t.aptName} (${t.umdName} ${t.jibun}, ${t.count}건) | 같은 동 목록: ${sameDong.join(' / ') || '없음'}`,
    );
  }
}
console.log(`\n전체: ${matchedAll}/${totalAll} 연결 (${((matchedAll / totalAll) * 100).toFixed(1)}%)`);
