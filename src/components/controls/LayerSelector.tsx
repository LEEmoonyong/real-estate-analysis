// [요구사항: 컴포넌트] 분석 레이어 선택 — 구현된 레이어만 보여 준다 (천공률·일사량은 추가되는 날 함께 노출)
// [요구사항: 이벤트 처리] onChange(radio, checkbox, select)
import { FEATURES } from '../../config/features';
import { useSettings, useSettingsActions, type GroundCellSize } from '../../contexts/SettingsContext';
import type { AnalysisLayer } from '../../domain/types';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import styles from './Controls.module.css';

const LAYERS: { id: AnalysisLayer; label: string; description: string; enabled: boolean }[] = [
  { id: 'sunlight', label: '일조 시간', description: '세대 창문에 직사광이 드는 시간 (기준 구간)', enabled: true },
  {
    id: 'groundShadow',
    label: '지면 그림자',
    description: '기준 구간(08~16시) 동안 땅에 그림자가 진 시간 — 놀이터·주차장 위치 비교',
    enabled: FEATURES.groundShadow,
  },
];

export function LayerSelector() {
  const { layer, heatmapVisible, groundCellSize } = useSettings();
  const { setLayer, setHeatmapVisible, setGroundCellSize } = useSettingsActions();
  const breakpoint = useBreakpoint();
  // 모바일은 계산량 때문에 4m 이상만
  const cellSizes: GroundCellSize[] = breakpoint === 'mobile' ? [4, 8] : [2, 4, 8];

  return (
    <div className={styles.layers}>
      <fieldset className={styles.fieldset}>
        <legend className={styles.srOnly}>분석 레이어</legend>
        {LAYERS.filter((l) => l.enabled).map((l) => (
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
      {layer === 'groundShadow' && (
        <label className={styles.option}>
          셀 크기
          <select
            className={styles.select}
            value={groundCellSize}
            onChange={(e) => setGroundCellSize(Number(e.target.value) as GroundCellSize)}
          >
            {cellSizes.map((c) => (
              <option key={c} value={c}>
                {c}m{c === 2 ? ' (정밀, 느림)' : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className={styles.option}>
        <input type="checkbox" checked={heatmapVisible} onChange={(e) => setHeatmapVisible(e.target.checked)} />
        3D 히트맵 표시
      </label>
    </div>
  );
}
