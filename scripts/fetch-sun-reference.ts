// 태양 위치 단위 테스트용 기준값 수집 스크립트 (1회 실행, 결과는 커밋)
// 출처: NASA/JPL Horizons API (DE441 천체력), 대기 굴절 미적용(AIRLESS) 겉보기 방위각·고도
// 실행: npx tsx scripts/fetch-sun-reference.ts
import { writeFileSync } from 'node:fs';

const API = 'https://ssd.jpl.nasa.gov/api/horizons.api';

const SITES = [
  { id: 'seoul', name: '서울', lat: 37.5665, lng: 126.978 },
  { id: 'busan', name: '부산', lat: 35.1796, lng: 129.0756 },
  { id: 'jeju', name: '제주', lat: 33.4996, lng: 126.5312 },
] as const;

// KST 날짜 (춘분·하지·추분·동지 근처)
const DATES = ['2026-03-20', '2026-06-21', '2026-09-23', '2026-12-22'] as const;

interface Row {
  utc: string; // ISO
  azimuthDeg: number;
  altitudeDeg: number;
}

/** KST 날짜·시각 → Horizons UTC 문자열 'YYYY-MM-DD HH:MM' */
function kstToUtcString(date: string, kstMinute: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const ms = Date.UTC(y, m - 1, d, 0, kstMinute - 9 * 60);
  return new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
}

async function query(lat: number, lng: number, startUtc: string, stopUtc: string, step: string): Promise<Row[]> {
  const params = new URLSearchParams({
    format: 'json',
    COMMAND: "'10'",
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'OBSERVER'",
    CENTER: "'coord@399'",
    COORD_TYPE: "'GEODETIC'",
    SITE_COORD: `'${lng},${lat},0'`,
    START_TIME: `'${startUtc}'`,
    STOP_TIME: `'${stopUtc}'`,
    STEP_SIZE: `'${step}'`,
    QUANTITIES: "'4'",
    APPARENT: "'AIRLESS'",
    ANG_FORMAT: "'DEG'",
    TIME_ZONE: "'+00:00'",
  });
  const res = await fetch(`${API}?${params.toString()}`);
  if (!res.ok) throw new Error(`Horizons ${res.status}`);
  const body = (await res.json()) as { result: string };
  const text = body.result;
  const block = text.slice(text.indexOf('$$SOE') + 5, text.indexOf('$$EOE'));
  const months: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
  };
  return block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      // 예: "2026-Dec-21 03:00 *   172.168945  28.590122"
      const m = /^(\d{4})-(\w{3})-(\d{2}) (\d{2}):(\d{2})\s+\S*\s+([-\d.]+)\s+([-\d.]+)$/.exec(line);
      if (!m) throw new Error(`해석 불가 행: ${line}`);
      const [, y, mon, d, hh, mm, az, el] = m as unknown as string[];
      return {
        utc: `${y}-${months[mon!]}-${d}T${hh}:${mm}:00Z`,
        azimuthDeg: Number(az),
        altitudeDeg: Number(el),
      };
    });
}

/** 1분 간격 고도에서 기하 고도 -0.833° 교차 시각(선형 보간) → 일출·일몰 [KST 분] */
function crossing(rows: Row[], rising: boolean): number | null {
  const H = -0.833;
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1]!;
    const b = rows[i]!;
    const crosses = rising ? a.altitudeDeg < H && b.altitudeDeg >= H : a.altitudeDeg >= H && b.altitudeDeg < H;
    if (crosses) {
      const f = (H - a.altitudeDeg) / (b.altitudeDeg - a.altitudeDeg);
      const ms = Date.parse(a.utc) + f * 60_000;
      const kst = new Date(ms + 9 * 3600_000);
      return kst.getUTCHours() * 60 + kst.getUTCMinutes() + kst.getUTCSeconds() / 60;
    }
  }
  return null;
}

async function main() {
  const out: unknown[] = [];
  for (const site of SITES) {
    for (const date of DATES) {
      const hourly = await query(site.lat, site.lng, kstToUtcString(date, 6 * 60), kstToUtcString(date, 18 * 60), '1h');
      const morning = await query(site.lat, site.lng, kstToUtcString(date, 4 * 60 + 30), kstToUtcString(date, 8 * 60 + 30), '1m');
      const evening = await query(site.lat, site.lng, kstToUtcString(date, 16 * 60 + 30), kstToUtcString(date, 20 * 60 + 30), '1m');
      out.push({
        site: site.id,
        lat: site.lat,
        lng: site.lng,
        date,
        samples: hourly.map((r) => {
          const kst = new Date(Date.parse(r.utc) + 9 * 3600_000);
          return {
            kstMinute: kst.getUTCHours() * 60 + kst.getUTCMinutes(),
            azimuthDeg: r.azimuthDeg,
            altitudeDeg: r.altitudeDeg,
          };
        }),
        sunriseKstMinute: crossing(morning, true),
        sunsetKstMinute: crossing(evening, false),
      });
      console.log(`${site.name} ${date} 완료`);
    }
  }
  const fixture = {
    source: 'NASA/JPL Horizons API (DE441), Sun (10), APPARENT=AIRLESS, geodetic site, elevation 0 m',
    note: '일출·일몰은 기하 고도 -0.833° 교차(1분 간격 선형 보간)로 정의 — NOAA 관례와 동일',
    fetchedAt: new Date().toISOString().slice(0, 10),
    cases: out,
  };
  writeFileSync('src/test/fixtures/sun-reference.json', JSON.stringify(fixture, null, 2) + '\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
