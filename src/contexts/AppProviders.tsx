// Context 계층 조립 — Settings → SceneData → Time → Simulation (PLAN.md 4.1)
import type { ReactNode } from 'react';
import { SceneDataProvider } from './SceneDataContext';
import { SettingsProvider } from './SettingsContext';
import { SimulationProvider } from './SimulationContext';
import { TimeProvider } from './TimeContext';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <SceneDataProvider>
        <TimeProvider>
          <SimulationProvider>{children}</SimulationProvider>
        </TimeProvider>
      </SceneDataProvider>
    </SettingsProvider>
  );
}
