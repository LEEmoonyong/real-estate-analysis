// Context 계층 조립 — Toast → Settings → SceneData → Favorites → Watchlist → Time → Playback → Simulation → VirtualUi → Heatmap (PLAN.md 4.1, 확장 X6)
import type { ReactNode } from 'react';
import { FavoritesProvider } from './FavoritesContext';
import { HeatmapProvider } from './HeatmapContext';
import { PlaybackProvider } from './PlaybackContext';
import { SceneDataProvider } from './SceneDataContext';
import { SeasonProvider } from './SeasonContext';
import { SettingsProvider } from './SettingsContext';
import { SimulationProvider } from './SimulationContext';
import { TimeProvider } from './TimeContext';
import { VirtualUiProvider } from './VirtualUiContext';
import { WatchlistProvider } from './WatchlistContext';
import { ToastProvider } from './ToastContext';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <SettingsProvider>
        <SceneDataProvider>
          <FavoritesProvider>
            <WatchlistProvider>
              <TimeProvider>
                <PlaybackProvider>
                  <SeasonProvider>
                    <SimulationProvider>
                      <VirtualUiProvider>
                        <HeatmapProvider>{children}</HeatmapProvider>
                      </VirtualUiProvider>
                    </SimulationProvider>
                  </SeasonProvider>
                </PlaybackProvider>
              </TimeProvider>
            </WatchlistProvider>
          </FavoritesProvider>
        </SceneDataProvider>
      </SettingsProvider>
    </ToastProvider>
  );
}
