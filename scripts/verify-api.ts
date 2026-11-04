// 외부 API 실측 검증 스크립트 — 프록시 router를 그대로 호출해 응답 형식을 확인한다.
// 실행: npm run verify:api   (.env.local의 키를 사용, 키가 없으면 해당 항목 건너뜀)
// 원시 응답은 scripts/.cache/ 에 저장된다(커밋 제외). 요약은 docs/api-verification.md 에 옮겨 적는다.
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadEnv } from 'vite';
import { routeApi } from '../server/router';
import type { ServerEnv } from '../server/http';

const raw = loadEnv('development', process.cwd(), '');
const env: ServerEnv = {
  KAKAO_REST_API_KEY: raw.KAKAO_REST_API_KEY || undefined,
  VWORLD_API_KEY: raw.VWORLD_API_KEY || undefined,
  VWORLD_DOMAIN: raw.VWORLD_DOMAIN || undefined,
};

const SITES = [
  { id: 'seoul-jamsil', lat: 37.5115, lng: 127.083, query: '잠실엘스' },
  { id: 'busan-marine-city', lat: 35.1567, lng: 129.145, query: '해운대 마린시티' },
  { id: 'sejong-hansol', lat: 36.4795, lng: 127.256, query: '세종 한솔동 첫마을' },
] as const;

/** Overpass는 응답이 수십 초 걸릴 수 있어 키 검증만 할 때는 건너뛴다 */
const SKIP_OSM = process.argv.includes('--skip-osm');

mkdirSync('scripts/.cache', { recursive: true });

async function call(path: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await routeApi(new Request(`http://localhost${path}`), env);
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

function save(name: string, body: unknown) {
  writeFileSync(`scripts/.cache/${name}.json`, JSON.stringify(body, null, 2));
}

interface OsmElement {
  type: string;
  tags?: Record<string, string>;
}

function summarizeOsm(elements: OsmElement[]) {
  const tagged = (k: string) => elements.filter((e) => e.tags?.[k] !== undefined).length;
  const apartments = elements.filter((e) => e.tags?.building === 'apartments');
  const dongLike = elements.filter((e) => /\d{2,4}\s*동/.test(`${e.tags?.name ?? ''} ${e.tags?.['addr:housenumber'] ?? ''}`));
  return {
    total: elements.length,
    ways: elements.filter((e) => e.type === 'way').length,
    relations: elements.filter((e) => e.type === 'relation').length,
    apartments: apartments.length,
    withLevels: tagged('building:levels'),
    withHeight: tagged('height'),
    apartmentsWithLevels: apartments.filter((e) => e.tags?.['building:levels']).length,
    withDongInNameOrHousenumber: dongLike.length,
    nameExamples: dongLike.slice(0, 5).map((e) => e.tags?.name ?? e.tags?.['addr:housenumber']),
  };
}

async function main() {
  console.log('# /api/health');
  console.log((await call('/api/health')).body);

  for (const site of SITES) {
    console.log(`\n# ${site.id}`);
    if (SKIP_OSM) {
      console.log('OSM 건너뜀 (--skip-osm)');
    } else {
      const t0 = Date.now();
      const osm = await call(`/api/buildings/osm?lat=${site.lat}&lng=${site.lng}&r=400`);
      save(`osm-${site.id}`, osm.body);
      if (osm.status === 200) {
        console.log(`OSM (${Date.now() - t0}ms, ${String(osm.body.endpoint)})`, summarizeOsm(osm.body.elements as OsmElement[]));
      } else {
        console.log('OSM 실패', osm.status, osm.body);
      }
    }

    if (env.KAKAO_REST_API_KEY || env.VWORLD_API_KEY) {
      const geo = await call(`/api/geocode?q=${encodeURIComponent(site.query)}`);
      save(`geocode-${site.id}`, geo.body);
      console.log('geocode', geo.status, JSON.stringify(geo.body).slice(0, 400));
    } else {
      console.log('geocode 건너뜀 (키 없음)');
    }

    if (env.VWORLD_API_KEY) {
      const vw = await call(`/api/buildings/vworld?lat=${site.lat}&lng=${site.lng}&r=400`);
      save(`vworld-${site.id}`, vw.body);
      const features = (vw.body.features as unknown[] | undefined) ?? [];
      console.log('vworld', vw.status, `features=${features.length}`, JSON.stringify(features[0] ?? vw.body).slice(0, 600));
    } else {
      console.log('V-World 건물 건너뜀 (키 없음)');
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
