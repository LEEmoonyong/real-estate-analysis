// [요구사항: 상태관리] 가상 건물 영향 분석 (확장 X6) — 배치 모드·고른 가상 건물·"변화량 보기"(useState)와
// "전" 결과(가상 건물이 없는 장면의 일조) 보관, 전후 비교(useMemo)를 한곳에서 나눈다.
//
// "전" 결과: 가상 건물을 놓기 전(또는 잠시 끈 동안) 계산된 일조 결과를 기억해 둔다.
// 같은 날짜·같은 세대 수일 때만 비교한다. 날짜를 바꾸면 가상 건물을 잠시 꺼서 "전"을 다시 계산하면 된다
// (결과 캐시 덕분에 이미 계산한 날짜는 바로 돌아온다).
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { impactSummary, lossPerUnit, type ImpactSummary } from '../domain/scene/virtualBuilding';
import type { SunlightOutcome } from '../workers/sceneTransfer';
import { useSceneData } from './SceneDataContext';
import { useSimulation } from './SimulationContext';

export interface ImpactData {
  /** 세대별 08~16시 총 일조 감소량 [분] */
  loss: Float32Array;
  summary: ImpactSummary;
  date: string;
}

export type ImpactStatus =
  | { kind: 'idle' } // 가상 건물 없음
  | { kind: 'need-base' } // "전" 결과가 없거나 날짜가 다름
  | { kind: 'computing' } // "후" 결과를 계산 중
  | { kind: 'ready'; impact: ImpactData };

interface VirtualUiState {
  placing: boolean;
  activeId: string | null;
  /** 히트맵을 일조 대신 감소량으로 칠한다 */
  showImpact: boolean;
  status: ImpactStatus;
  /** 기억해 둔 "전" 결과의 날짜 (없으면 null) */
  baseDate: string | null;
}

interface VirtualUiActions {
  setPlacing: (v: boolean) => void;
  setActiveId: (id: string | null) => void;
  setShowImpact: (v: boolean) => void;
}

const StateContext = createContext<VirtualUiState | null>(null);
const ActionsContext = createContext<VirtualUiActions | null>(null);

export function VirtualUiProvider({ children }: { children: ReactNode }) {
  const { scene, units, sceneHash, baseSceneHash, virtualBuildings, virtualEnabled } = useSceneData();
  const { results } = useSimulation();
  const [placing, setPlacing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showImpact, setShowImpact] = useState(true);
  const [base, setBase] = useState<SunlightOutcome | null>(null);
  const outcome = results.sunlight as SunlightOutcome | undefined;

  // 장면이 바뀌면 모두 초기화
  useEffect(() => {
    setBase(null);
    setPlacing(false);
    setActiveId(null);
  }, [scene]);

  // 가상 건물이 없는 장면의 결과가 나오면 "전"으로 기억
  useEffect(() => {
    if (outcome && outcome.sceneHash === baseSceneHash && outcome.unitCount === units.count) setBase(outcome);
  }, [outcome, baseSceneHash, units.count]);

  const hasVirtual = virtualEnabled && virtualBuildings.length > 0;
  const status = useMemo<ImpactStatus>(() => {
    if (!hasVirtual) return { kind: 'idle' };
    const after = outcome && outcome.sceneHash === sceneHash && outcome.unitCount === units.count ? outcome : null;
    if (!after) return { kind: 'computing' };
    if (!base || base.date !== after.date || base.unitCount !== after.unitCount) return { kind: 'need-base' };
    return {
      kind: 'ready',
      impact: {
        date: after.date,
        loss: lossPerUnit(base.windowTotalMinutes, after.windowTotalMinutes),
        summary: impactSummary({
          beforeTotal: base.windowTotalMinutes,
          afterTotal: after.windowTotalMinutes,
          beforeMeets: base.meets,
          afterMeets: after.meets,
          isMainFace: units.isMainFace,
        }),
      },
    };
  }, [hasVirtual, outcome, sceneHash, units, base]);

  const baseDate = base?.date ?? null;
  const state = useMemo(
    () => ({ placing, activeId, showImpact, status, baseDate }),
    [placing, activeId, showImpact, status, baseDate],
  );
  const actions = useMemo(() => ({ setPlacing, setActiveId, setShowImpact }), []);
  return (
    <ActionsContext.Provider value={actions}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </ActionsContext.Provider>
  );
}

export function useVirtualUi(): VirtualUiState {
  const ctx = useContext(StateContext);
  if (!ctx) throw new Error('useVirtualUi는 VirtualUiProvider 안에서 사용해야 합니다.');
  return ctx;
}

export function useVirtualUiActions(): VirtualUiActions {
  const ctx = useContext(ActionsContext);
  if (!ctx) throw new Error('useVirtualUiActions는 VirtualUiProvider 안에서 사용해야 합니다.');
  return ctx;
}
