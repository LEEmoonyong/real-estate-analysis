// 샘플 데이터 생성 스크립트 (PLAN.md 6.4)
// OSM Overpass 원시 응답 → normalizeOsm(앱과 같은 정규화) → public/samples/<id>.json + index.json
// 실행: npx tsx scripts/build-sample.ts
// 원시 응답은 scripts/.cache/osm-<id>-raw.json 에 캐시한다. 없으면 Overpass에서 받아 온다(수십 초 걸릴 수 있음).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { normalizeOsm, type OverpassElement } from '../src/data/normalize/osm';
import {
  SAMPLE_SCHEMA_VERSION,
  isSampleFile,
  type SampleFile,
  type SampleIndexEntry,
} from '../src/data/samples/sampleSchema';
import { OVERPASS_ENDPOINTS, buildOverpassQuery } from '../server/handlers/overpassBuildings';
import { USER_AGENT } from '../server/http';

interface SampleConfig {
  id: string;
  name: string;
  center: { lat: number; lng: number };
  radiusM: number;
  aliases: string[];
  /** 이전 실행에서 받아 둔 원시 응답 파일들 (첫 번째로 존재하는 파일 사용) */
  cacheFiles: string[];
}

const SAMPLES: SampleConfig[] = [
  {
    id: 'seoul-jamsil',
    name: '서울 송파 잠실 (엘스·리센츠·트리지움)',
    center: { lat: 37.5115, lng: 127.083 },
    radiusM: 400,
    aliases: ['잠실', '송파', '잠실엘스', '엘스', '리센츠', '트리지움', '서울'],
    cacheFiles: ['osm-seoul-jamsil-raw.json'],
  },
  {
    id: 'busan-marine-city',
    name: '부산 해운대 마린시티',
    center: { lat: 35.1567, lng: 129.145 },
    radiusM: 400,
    aliases: ['마린시티', '해운대', '부산', '우동'],
    cacheFiles: ['osm-busan-marine-city-raw.json', 'osm-busan-marine-city.json'],
  },
  {
    id: 'sejong-hansol',
    name: '세종 한솔동 첫마을',
    center: { lat: 36.4795, lng: 127.256 },
    radiusM: 400,
    aliases: ['세종', '한솔동', '첫마을', '세종시'],
    cacheFiles: ['osm-sejong-hansol-raw.json'],
  },
];

const CACHE_DIR = 'scripts/.cache';
const OUT_DIR = 'public/samples';

async function loadElements(cfg: SampleConfig): Promise<OverpassElement[]> {
  for (const name of cfg.cacheFiles) {
    const path = `${CACHE_DIR}/${name}`;
    if (!existsSync(path)) continue;
    try {
      const body = JSON.parse(readFileSync(path, 'utf8')) as { elements?: OverpassElement[] };
      if (Array.isArray(body.elements) && body.elements.length > 0) return body.elements;
    } catch {
      /* 손상된 캐시(예: 502 HTML) → 다음 후보 */
    }
  }
  const query = buildOverpassQuery(cfg.center.lat, cfg.center.lng, cfg.radiusM).replace('timeout:25', 'timeout:90');
  for (const endpoint of OVERPASS_ENDPOINTS) {
    console.log(`  Overpass 요청: ${endpoint}`);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
        body: new URLSearchParams({ data: query }).toString(),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) continue;
      const text = await res.text();
      const body = JSON.parse(text) as { elements?: OverpassElement[] };
      if (!body.elements?.length) continue;
      mkdirSync(CACHE_DIR, { recursive: true });
      writeFileSync(`${CACHE_DIR}/${cfg.cacheFiles[0]}`, text);
      return body.elements;
    } catch (err) {
      console.log(`  실패: ${String(err)}`);
    }
  }
  throw new Error(`${cfg.id}: Overpass 응답을 받지 못했습니다.`);
}

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

async function build(cfg: SampleConfig): Promise<SampleIndexEntry> {
  console.log(`\n# ${cfg.id}`);
  const elements = await loadElements(cfg);

  // 층수가 없는 아파트는 같은 지역의 층수 태그가 있는 아파트 중앙값으로 채운다 (시연용 추정, heightSource='default')
  const taggedApartmentFloors = elements
    .filter((e) => e.tags?.building === 'apartments')
    .map((e) => Number(e.tags?.['building:levels']))
    .filter((n) => Number.isInteger(n) && n > 0);
  const apartmentFallbackFloors = median(taggedApartmentFloors);

  const { buildings, report } = normalizeOsm(elements, { apartmentFallbackFloors });
  const apartments = buildings.filter((b) => b.usage === 'apartments');
  const estimatedApartments = apartments.filter((b) => b.heightSource === 'default').length;
  const withDong = apartments.filter((b) => b.dongNumber).length;

  const notes: string[] = [];
  if (estimatedApartments > 0) {
    notes.push(
      `아파트 ${apartments.length}개 동 중 ${estimatedApartments}개 동은 OSM에 층수 정보가 없어 ` +
        `이 지역 아파트 층수 중앙값(${apartmentFallbackFloors}층)으로 추정했습니다.`,
    );
  }
  notes.push(`동 번호는 OSM 이름 태그에서 추출했습니다(아파트 ${withDong}/${apartments.length}개 동). 나머지는 앱에서 직접 지정할 수 있습니다.`);

  const sample: SampleFile = {
    schemaVersion: SAMPLE_SCHEMA_VERSION,
    id: cfg.id,
    name: cfg.name,
    center: cfg.center,
    radiusM: cfg.radiusM,
    source: {
      provider: 'osm',
      license: 'ODbL 1.0',
      attribution: '© OpenStreetMap contributors',
      fetchedAt: new Date().toISOString().slice(0, 10),
    },
    searchAliases: cfg.aliases,
    notes,
    buildings: buildings.map((b) => ({ ...b, source: 'sample' as const })),
  };
  if (!isSampleFile(sample)) throw new Error(`${cfg.id}: 생성한 샘플이 스키마 검증을 통과하지 못했습니다.`);

  writeFileSync(`${OUT_DIR}/${cfg.id}.json`, JSON.stringify(sample) + '\n');
  console.log('  정규화:', report);
  console.log(`  아파트 ${apartments.length}동 (층수 추정 ${estimatedApartments}, 동 번호 ${withDong})`);
  notes.forEach((n) => console.log(`  - ${n}`));

  return {
    id: cfg.id,
    name: cfg.name,
    center: cfg.center,
    file: `${cfg.id}.json`,
    aliases: cfg.aliases,
    buildingCount: buildings.length,
  };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const index: SampleIndexEntry[] = [];
  for (const cfg of SAMPLES) index.push(await build(cfg));
  writeFileSync(`${OUT_DIR}/index.json`, JSON.stringify(index, null, 2) + '\n');
  console.log(`\n${OUT_DIR}/index.json 저장 (${index.length}개)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
