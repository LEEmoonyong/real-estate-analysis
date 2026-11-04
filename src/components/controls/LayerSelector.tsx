// [요구사항: 컴포넌트] 분석 레이어 선택 — 구현된 레이어만 보여 준다 (천공률·일사량·지면 그림자는 추가되는 날 함께 노출)
// [요구사항: 이벤트 처리] onChange(radio, checkbox)
import { useSettings, useSettingsActions } from '../../contexts/SettingsContext';
import type { AnalysisLayer } from '../../domain/types';
import styles from './Controls.module.css';

const LAYERS: { id: AnalysisLayer; label: string; description: string }[] = [
  { id: 'sunlight', label: '일조 시간', description: '세대 창문에 직사광이 드는 시간 (기준 구간)' },
];

export function LayerSelector() {
  const { layer, heatmapVisible } = useSettings();
  const { setLayer, setHeatmapVisible } = useSettingsActions();

  return (
    <div className={styles.layers}>
      <fieldset className={styles.fieldset}>
        <legend className={styles.srOnly}>분석 레이어</legend>
        {LAYERS.map((l) => (
          <label key={l.id} className={styles.option} title={l.description}>
            <input
              type="radio"
              name="analysis-layer"
              value={l.id}
              checked={layer === l.id}
              onChange={() => setLayer(l.id)}
            />
            {l.label}
          </label>
        ))}
      </fieldset>
      <label className={styles.option}>
        <input type="checkbox" checked={heatmapVisible} onChange={(e) => setHeatmapVisible(e.target.checked)} />
        3D 히트맵 표시
      </label>
    </div>
  );
}
