// 주변 시설 정리 (확장 X5 학군·교통) — 카카오 카테고리 검색 결과를 학교급·노선별로 나누고 도보 시간을 붙인다

export interface NearbyPlace {
  name: string;
  category: string;
  distanceM: number;
  lat: number;
  lng: number;
  address: string;
}

export interface NearbyResponse {
  school: NearbyPlace[];
  subway: NearbyPlace[];
  mart: NearbyPlace[];
  hospital: NearbyPlace[];
  kindergarten: NearbyPlace[];
}

/** 도보 속도 [m/분] — 성인 평균 약 4.5km/h. 직선거리 기준이라 실제 길은 더 걸린다 */
export const WALK_M_PER_MIN = 75;

export function walkMinutes(distanceM: number): number {
  return Math.max(1, Math.round(distanceM / WALK_M_PER_MIN));
}

export type SchoolLevel = 'elementary' | 'middle' | 'high' | 'other';

export function schoolLevel(p: Pick<NearbyPlace, 'name' | 'category'>): SchoolLevel {
  const s = `${p.category} ${p.name}`;
  if (/초등학교/.test(s)) return 'elementary';
  if (/중학교/.test(s)) return 'middle';
  if (/고등학교/.test(s)) return 'high';
  return 'other';
}

export function groupSchools(schools: readonly NearbyPlace[]): Record<SchoolLevel, NearbyPlace[]> {
  const out: Record<SchoolLevel, NearbyPlace[]> = { elementary: [], middle: [], high: [], other: [] };
  for (const s of schools) out[schoolLevel(s)].push(s);
  return out;
}

/** 지하철역 노선: 카테고리 마지막 단계 ('교통,수송 > 지하철,전철 > 수도권9호선' → '수도권9호선' → '9호선') */
export function subwayLine(category: string): string {
  const last = category.split('>').at(-1)?.trim() ?? '';
  return last.replace(/^수도권/, '').replace(/^(부산|대구|대전|광주)/, '$1 ');
}

/** 같은 역(이름의 '역'까지)이 노선별로 여러 번 나오면 묶는다 */
export function groupStations(
  stations: readonly NearbyPlace[],
): { station: string; lines: string[]; distanceM: number }[] {
  const map = new Map<string, { station: string; lines: string[]; distanceM: number }>();
  for (const s of stations) {
    const station = s.name.replace(/역.*$/, '역');
    const line = subwayLine(s.category);
    const cur = map.get(station);
    if (cur) {
      if (!cur.lines.includes(line)) cur.lines.push(line);
      cur.distanceM = Math.min(cur.distanceM, s.distanceM);
    } else map.set(station, { station, lines: [line], distanceM: s.distanceM });
  }
  return [...map.values()].sort((a, b) => a.distanceM - b.distanceM);
}

/** 세대 점수표용 요약 — 가장 가까운 초등학교·지하철역 거리 (없으면 null) */
export function nearbySummary(n: NearbyResponse): { elementaryM: number | null; subwayM: number | null } {
  const g = groupSchools(n.school);
  return { elementaryM: g.elementary[0]?.distanceM ?? null, subwayM: n.subway[0]?.distanceM ?? null };
}
