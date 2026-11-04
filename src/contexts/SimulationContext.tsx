// [요구사항: 상태관리] useReducer + Context — 시뮬레이션 상태·진행률·계산 결과
import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react';
import {
  initialSimulationState,
  simulationReducer,
  type SimulationAction,
  type SimulationState,
} from '../reducers/simulationReducer';

const SimulationStateContext = createContext<SimulationState | null>(null);
const SimulationDispatchContext = createContext<Dispatch<SimulationAction> | null>(null);

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(simulationReducer, initialSimulationState);
  return (
    <SimulationDispatchContext.Provider value={dispatch}>
      <SimulationStateContext.Provider value={state}>{children}</SimulationStateContext.Provider>
    </SimulationDispatchContext.Provider>
  );
}

export function useSimulation(): SimulationState {
  const ctx = useContext(SimulationStateContext);
  if (!ctx) throw new Error('useSimulation은 SimulationProvider 안에서 사용해야 합니다.');
  return ctx;
}

export function useSimulationDispatch(): Dispatch<SimulationAction> {
  const ctx = useContext(SimulationDispatchContext);
  if (!ctx) throw new Error('useSimulationDispatch는 SimulationProvider 안에서 사용해야 합니다.');
  return ctx;
}
