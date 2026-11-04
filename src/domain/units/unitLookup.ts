// 동·호수 → 세대 찾기 (PLAN.md 단계 B1)
// React와 무관한 순수 함수 — useUnitLookup이 useMemo로 동 색인을 만들어 이 함수에 넘긴다.
//
// 한 장면에 단지가 여러 개면 같은 동 번호가 여러 건물에 있을 수 있다(잠실: 엘스·리센츠·트리지움 모두 101동).
// 이때는 호수가 성립하는 건물만 후보로 남기고, 그래도 둘 이상이면 사용자에게 고르게 한다.
import type { Building } from '../types';
import type { UnitSet } from './generateUnits';
import { hoMultiplier } from './hoNumber';
import { parseDongHo } from './parseDongHo';

/** 동 번호 → buildings 배열 인덱스 목록 */
export type DongIndex = ReadonlyMap<string, readonly number[]>;

export function buildDongIndex(buildings: readonly Building[]): DongIndex {
  const index = new Map<string, number[]>();
  buildings.forEach((b, i) => {
    if (!b.dongNumber) return;
    const list = index.get(b.dongNumber);
    if (list) list.push(i);
    else index.set(b.dongNumber, [i]);
  });
  return index;
}

export type LookupFailure =
  | { ok: false; reason: 'EMPTY' | 'FORMAT' }
  | { ok: false; reason: 'NO_DONG'; dong: string }
  | { ok: false; reason: 'AMBIGUOUS'; dong: string; ho: string | null; candidates: number[] }
  | { ok: false; reason: 'NO_UNITS'; dong: string }
  | { ok: false; reason: 'NO_FLOOR'; dong: string; floor: number; maxFloor: number }
  | { ok: false; reason: 'NO_LINE'; dong: string; line: number; lineCount: number };

export type LookupResult =
  { ok: true; buildingIndex: number; unitIndex: number | null; dong: string; ho: string | null } | LookupFailure;

type CandidateResult =
  { ok: true; unitIndex: number } | Extract<LookupFailure, { reason: 'NO_UNITS' | 'NO_FLOOR' | 'NO_LINE' }>;

/** 한 건물에서 호수에 해당하는 주향 면 세대 */
export function findUnitByHo(units: UnitSet, buildingIndex: number, building: Building, ho: string): CandidateResult {
  const dong = building.dongNumber ?? '';
  const lineCount = units.mainLineCount[buildingIndex] ?? 0;
  if (lineCount === 0) return { ok: false, reason: 'NO_UNITS', dong };
  const m = hoMultiplier(lineCount);
  const value = Number(ho);
  const floor = Math.floor(value / m);
  const line = value % m;
  if (floor < 1 || floor > building.floors)
    return { ok: false, reason: 'NO_FLOOR', dong, floor, maxFloor: building.floors };
  if (line < 1 || line > lineCount) return { ok: false, reason: 'NO_LINE', dong, line, lineCount };
  const end = units.buildingStart[buildingIndex + 1]!;
  for (let i = units.buildingStart[buildingIndex]!; i < end; i++) {
    if (units.isMainFace[i] === 1 && units.hoLine[i] === line && units.floor[i] === floor) {
      return { ok: true, unitIndex: i };
    }
  }
  // 층·라인이 범위 안이면 세대가 반드시 있다 (generateUnits가 모든 층·라인을 만든다)
  return { ok: false, reason: 'NO_LINE', dong, line, lineCount };
}

/**
 * 입력 문자열로 세대(또는 동만 입력하면 건물)를 찾는다.
 * @param onlyBuilding 후보 중 사용자가 고른 건물 인덱스 (AMBIGUOUS 다음 단계)
 */
export function lookupDongHo(
  input: string,
  buildings: readonly Building[],
  units: UnitSet,
  dongIndex: DongIndex,
  onlyBuilding?: number,
): LookupResult {
  const parsed = parseDongHo(input);
  if (!parsed.ok) return parsed;
  const { dong, ho } = parsed;

  const all = dongIndex.get(dong) ?? [];
  const candidates = onlyBuilding !== undefined ? all.filter((i) => i === onlyBuilding) : all;
  if (candidates.length === 0) return { ok: false, reason: 'NO_DONG', dong };

  if (ho === null) {
    if (candidates.length > 1) return { ok: false, reason: 'AMBIGUOUS', dong, ho, candidates: [...candidates] };
    return { ok: true, buildingIndex: candidates[0]!, unitIndex: null, dong, ho };
  }

  const results = candidates.map((bi) => ({ bi, r: findUnitByHo(units, bi, buildings[bi]!, ho) }));
  const hits = results.filter((x) => x.r.ok);
  if (hits.length === 1) {
    const hit = hits[0]!;
    return { ok: true, buildingIndex: hit.bi, unitIndex: (hit.r as { unitIndex: number }).unitIndex, dong, ho };
  }
  if (hits.length > 1) return { ok: false, reason: 'AMBIGUOUS', dong, ho, candidates: hits.map((x) => x.bi) };

  // 모든 후보에서 실패 — 층이 부족한 경우가 가장 흔하므로 가장 높은 건물 기준으로 알려 준다
  const failures = results.map((x) => x.r as Exclude<CandidateResult, { ok: true }>);
  const floorFail = failures.filter((f) => f.reason === 'NO_FLOOR');
  if (floorFail.length === failures.length) {
    return floorFail.reduce((a, b) => (b.maxFloor > a.maxFloor ? b : a));
  }
  return failures.find((f) => f.reason === 'NO_LINE') ?? failures[0]!;
}

/** 실패 이유별 안내 문구 (PLAN.md B1의 메시지 4종 + 후보 여러 개·세대 없음) */
export function lookupMessage(result: LookupFailure): string {
  switch (result.reason) {
    case 'EMPTY':
      return '동·호수를 입력하세요. 예: 101동 1203호';
    case 'FORMAT':
      return '형식 예: 101동 1203호, 101-1203, 101 1203';
    case 'NO_DONG':
      return `${result.dong}동이 지정된 건물이 없습니다 — 건물을 클릭해 동 번호를 지정하세요.`;
    case 'AMBIGUOUS':
      return `${result.dong}동이 ${result.candidates.length}곳 있습니다. 찾으려는 건물을 고르세요.`;
    case 'NO_UNITS':
      return `${result.dong}동은 주거 건물이 아니어서 세대 정보가 없습니다.`;
    case 'NO_FLOOR':
      return `${result.dong}동은 ${result.maxFloor}층까지입니다.`;
    case 'NO_LINE':
      return `${result.line}라인이 없습니다(1~${result.lineCount}라인).`;
  }
}
