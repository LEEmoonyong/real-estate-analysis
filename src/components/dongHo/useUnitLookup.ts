// [요구사항: Hooks] 커스텀 훅 — 동·호수 입력 → 세대 (PLAN.md 7장 useUnitLookup)
// useContext(SceneData) + useMemo(동 → 건물 색인). 색인은 건물·동 번호가 바뀔 때만 다시 만든다.
import { useCallback, useMemo } from 'react';
import { useSceneData } from '../../contexts/SceneDataContext';
import { compass8 } from '../../domain/geo/compass';
import { normalizeDong } from '../../domain/units/parseDongHo';
import { unitAt } from '../../domain/units/generateUnits';
import { buildDongIndex, lookupDongHo, type LookupFailure } from '../../domain/units/unitLookup';

export type UnitLookupResult =
  | { ok: true; buildingId: string; unitId: string | null; label: string }
  | (LookupFailure & { candidateInfo?: CandidateInfo[] });

/** 같은 동 번호 후보를 구별해 보여 줄 정보 */
export interface CandidateInfo {
  buildingIndex: number;
  buildingId: string;
  label: string;
}

export function useUnitLookup() {
  const { buildings, units } = useSceneData();
  const dongIndex = useMemo(() => buildDongIndex(buildings), [buildings]);

  /** 장면 중심 기준 방향·거리와 층수로 후보를 구별한다 (단지 이름은 데이터에 없는 경우가 많다) */
  const describe = useCallback(
    (bi: number): CandidateInfo => {
      const b = buildings[bi]!;
      let cx = 0;
      let cz = 0;
      const n = b.ring.length / 2;
      for (let i = 0; i < n; i++) {
        cx += b.ring[i * 2]!;
        cz += b.ring[i * 2 + 1]!;
      }
      cx /= n;
      cz /= n;
      const dist = Math.hypot(cx, cz);
      // 북 = −z
      const azimuth = ((Math.atan2(cx, -cz) * 180) / Math.PI + 360) % 360;
      const where = dist < 30 ? '중심부' : `중심에서 ${compass8(azimuth)}쪽 ${Math.round(dist / 10) * 10}m`;
      const name = b.name && normalizeDong(b.name.replace(/동$/, '')) !== b.dongNumber ? `${b.name} · ` : '';
      return { buildingIndex: bi, buildingId: b.id, label: `${name}${b.floors}층 · ${where}` };
    },
    [buildings],
  );

  const lookup = useCallback(
    (input: string, onlyBuildingId?: string): UnitLookupResult => {
      const only = onlyBuildingId ? buildings.findIndex((b) => b.id === onlyBuildingId) : undefined;
      const r = lookupDongHo(input, buildings, units, dongIndex, only !== undefined && only >= 0 ? only : undefined);
      if (!r.ok) {
        if (r.reason === 'AMBIGUOUS') return { ...r, candidateInfo: r.candidates.map(describe) };
        return r;
      }
      const building = buildings[r.buildingIndex]!;
      if (r.unitIndex === null) return { ok: true, buildingId: building.id, unitId: null, label: `${r.dong}동` };
      const unit = unitAt(units, r.unitIndex, buildings);
      return { ok: true, buildingId: building.id, unitId: unit.id, label: `${r.dong}동 ${unit.hoNumber ?? r.ho}호` };
    },
    [buildings, units, dongIndex, describe],
  );

  return { lookup, dongCount: dongIndex.size };
}
