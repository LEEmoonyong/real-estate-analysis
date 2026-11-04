// Context 계층 조립 — Toast → Settings → SceneData → Favorites → Time → Playback → Simulation (PLAN.md 4.1)
import type { ReactNode } from 'react';
import { FavoritesProvider } from './FavoritesContext';
import { HeatmapProvider } from './HeatmapContext';
import { PlaybackProvider } from './PlaybackContext';
import { SceneDataProvider } from './SceneDataContext';
import { SettingsProvider } from './SettingsContext';
import { SimulationProvider } from './SimulationContext';
import { TimeProvider } from './TimeContext';
import { ToastProvider } from './ToastContext';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <SettingsProvider>
        <SceneDataProvider>
          <FavoritesProvider>
            <TimeProvider>
              <PlaybackProvider>
                <SimulationProvider>
                  <HeatmapProvider>{children}</HeatmapProvider>
                </SimulationProvider>
              </PlaybackProvider>
            </TimeProvider>
          </FavoritesProvider>
        </SceneDataProvider>
      </SettingsProvider>
    </ToastProvider>
  );
}
