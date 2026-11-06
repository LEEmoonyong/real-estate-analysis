// 샘플 시세 스냅샷 만들기 (확장 X7) — `npm run snapshot:market` (키가 있는 개발 서버가 켜져 있어야 함)
//
// 샘플 3곳의 시세·단지 정보·학군 탭과 계산기가 부르는 /api 주소를 앱과 똑같이 만들어 받아 두고,
// public/samples/market-snapshot.json에 { capturedAt, baseMonth, responses } 로 저장한다.
// 샘플 모드(키도 배포 서버도 없음)에서 앱은 이 파일의 응답을 같은 주소로 찾아 쓴다(src/data/marketSnapshot.ts).
//
// - 크기를 줄이려고 매매·전월세 목록은 샘플 중심 600m 안 거래 단지 것만 남긴다(시세 탭은 대표 단지 것만 쓴다).
// - 단지 기본정보(kaptCode)는 앱의 단지 정보 탭이 이름·지번으로 연결한 코드다. 대표 단지가 바뀌면 고친다.
// - 주소 형식이 바뀌면 realestateClient.ts와 맞춘다.
import { readFileSync, writeFileSync } from 'node:fs';
import { distanceM, recentMonths } from '../src/domain/realestate/aggregate';

const BASE = process.env.SNAPSHOT_BASE ?? 'http://localhost:5173';
const OUT = 'public/samples/market-snapshot.json';
const KEEP_RADIUS_M = 600; // 시세 탭의 주변 단지 반경과 같게
const MONTHS = 12;

/** 샘플 id → 단지 정보 탭이 연결한 공동주택 단지 코드 */
const KAPT_CODES: Record<string, string> = {
  'seoul-jamsil': 'A13822003', // 잠실리센츠
  'busan-marine-city': 'A61202007', // 해운대두산위브더제니스
  'sejong-hansol': 'A33982101', // 첫마을1단지
};

interface SampleEntry {
  id: string;
  center: { lat: number; lng: number };
}
interface Region {
  lawdCode: string;
  sido: string;
  sigungu: string;
}
interface TradeComplexLite {
  aptSeq: string;
  lat: number | null;
  lng: number | null;
}

const q = (params: Record<string, string | number>) =>
  new URLSearchParams(Object.entries(params).map(([k, v]): [string, string] => [k, String(v)])).toString();

/** realestateClient.latestDealMonth와 같은 규칙 (지난달, KST) — 브라우저 코드를 node에서 끌어오지 않으려고 따로 둔다 */
function latestDealMonth(now: Date): string {
  const kst = new Date(now.getTime() + 9 * 3600_000);
  const t = kst.getUTCFullYear() * 12 + kst.getUTCMonth() - 1;
  return `${Math.floor(t / 12)}${String((t % 12) + 1).padStart(2, '0')}`;
}

async function get(url: string): Promise<unknown> {
  const res = await fetch(BASE + url);
  const body = (await res.json()) as { ok?: boolean; message?: string };
  if (!res.ok || body.ok === false) throw new Error(`${url} → ${res.status} ${body.message ?? ''}`);
  return body;
}

async function main() {
  const baseMonth = latestDealMonth(new Date());
  const months = recentMonths(baseMonth, MONTHS);
  const samples = JSON.parse(readFileSync('public/samples/index.json', 'utf8')) as SampleEntry[];
  const responses: Record<string, unknown> = {};
  const put = async (url: string) => (responses[url] = await get(url));

  await put('/api/finance/mortgage-rates');
  for (const s of samples) {
    const { lat, lng } = s.center;
    const regionUrl = `/api/region?${q({ lat: lat.toFixed(6), lng: lng.toFixed(6) })}`;
    const region = (await put(regionUrl)) as Region;
    const tc = (await put(
      `/api/realestate/trade-complexes?${q({
        lawd: region.lawdCode,
        ym: baseMonth,
        months: 3,
        area: `${region.sido} ${region.sigungu}`,
      })}`,
    )) as { items: TradeComplexLite[] };
    const keep = new Set(
      tc.items
        .filter(
          (c) => c.lat !== null && c.lng !== null && distanceM(s.center, { lat: c.lat, lng: c.lng }) <= KEEP_RADIUS_M,
        )
        .map((c) => c.aptSeq),
    );
    for (const kind of ['trades', 'rents'] as const) {
      for (const ym of months) {
        const url = `/api/realestate/${kind}?${q({ lawd: region.lawdCode, ym })}`;
        const body = (await get(url)) as { items: { aptSeq: string }[] };
        responses[url] = { ...body, items: body.items.filter((t) => keep.has(t.aptSeq)) };
      }
    }
    await put(`/api/realestate/complexes?${q({ sigungu: region.lawdCode })}`);
    const kapt = KAPT_CODES[s.id];
    if (kapt) await put(`/api/realestate/complex?${q({ kaptCode: kapt })}`);
    await put(`/api/nearby?${q({ lat: lat.toFixed(5), lng: lng.toFixed(5) })}`);
    console.log(`${s.id}: 거래 단지 ${tc.items.length}곳 중 ${keep.size}곳 거래 목록 보관`);
  }

  const snapshot = { capturedAt: new Date().toISOString().slice(0, 10), baseMonth, responses };
  writeFileSync(OUT, JSON.stringify(snapshot));
  console.log(
    `${OUT}: 응답 ${Object.keys(responses).length}개, ${(JSON.stringify(snapshot).length / 1024).toFixed(0)}KB`,
  );
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
