// [요구사항: 컴포넌트] 가상 건물 영향 분석 패널 (확장 X6)
// "여기 25층 건물이 들어서면?" — 3D 지면을 눌러 상자를 놓고 크기·층수·회전을 바꾸면, 놓기 전과 세대별 일조를 비교한다.
// [요구사항: 이벤트 처리] onClick(놓기·지우기·전 결과 계산), onChange(슬라이더·체크박스)
// [요구사항: Hooks] useEffect(전 결과 계산 후 가상 건물 다시 켜기), useRef(자동 복귀 표시)
import { useEffect, useRef } from 'react';
import { useSceneData, useSceneDataActions } from '../../contexts/SceneDataContext';
import { useVirtualUi, useVirtualUiActions } from '../../contexts/VirtualUiContext';
import { AFFECTED_LOSS_MIN, VIRTUAL_LIMITS, type VirtualBuilding } from '../../domain/scene/virtualBuilding';
import { findUnitIndex } from '../../domain/units/generateUnits';
import { useTime } from '../../contexts/TimeContext';
import styles from './VirtualBuildingPanel.module.css';

const hm = (m: number) => {
  const r = Math.round(m);
  const h = Math.floor(r / 60);
  return h > 0 ? `${h}시간${r % 60 ? ` ${r % 60}분` : ''}` : `${r}분`;
};

export function VirtualBuildingPanel() {
  const { scene, virtualBuildings, virtualEnabled, radiusM, units, buildings, selectedUnitId } = useSceneData();
  const { addVirtual, updateVirtual, removeVirtual, clearVirtual, setVirtualEnabled } = useSceneDataActions();
  const { placing, activeId, showImpact, status, baseDate } = useVirtualUi();
  const { setPlacing, setActiveId, setShowImpact } = useVirtualUiActions();
  const { date } = useTime();
  const restoreRef = useRef(false);

  // "전 결과 계산": 가상 건물을 잠시 끄고, 그 날짜의 결과가 기억되면 다시 켠다
  useEffect(() => {
    if (restoreRef.current && baseDate === date && !virtualEnabled) {
      restoreRef.current = false;
      setVirtualEnabled(true);
    }
  }, [baseDate, date, virtualEnabled, setVirtualEnabled]);

  if (!scene) return null;
  const active = virtualBuildings.find((v) => v.id === activeId) ?? virtualBuildings[virtualBuildings.length - 1];
  const reach = Math.round(Math.max(radiusM, 100));
  const set = (v: VirtualBuilding, patch: Partial<Omit<VirtualBuilding, 'id'>>) => updateVirtual(v.id, patch);

  // 고른 세대의 전후 변화
  const unitIndex = selectedUnitId ? findUnitIndex(units, buildings, selectedUnitId) : -1;
  const unitLoss = status.kind === 'ready' && unitIndex >= 0 ? status.impact.loss[unitIndex]! : null;

  return (
    <div className={styles.root} data-impact-status={status.kind}>
      <p className={styles.muted}>
        빈 땅에 새 건물이 들어선다고 가정하고, 놓기 전과 비교해 세대마다 일조가 얼마나 줄어드는지 봅니다.
      </p>
      <div className={styles.row}>
        <button
          type="button"
          className={placing ? styles.primaryOn : styles.primary}
          aria-pressed={placing}
          onClick={() => setPlacing(!placing)}
        >
          {placing ? '지면을 눌러 위치 고르기 (취소)' : '＋ 가상 건물 놓기'}
        </button>
        {/* 키보드·화면 낭독기 사용자를 위해: 장면 가운데 남쪽에 놓고 슬라이더로 옮긴다 */}
        <button type="button" className={styles.secondary} onClick={() => addVirtual(0, 60)}>
          가운데에 놓기
        </button>
        {virtualBuildings.length > 0 && (
          <button type="button" className={styles.secondary} onClick={clearVirtual}>
            모두 지우기
          </button>
        )}
      </div>

      {virtualBuildings.length > 0 && (
        <>
          <ul className={styles.list} aria-label="가상 건물 목록">
            {virtualBuildings.map((v, i) => (
              <li key={v.id}>
                <button
                  type="button"
                  className={v.id === active?.id ? styles.chipOn : styles.chip}
                  aria-pressed={v.id === active?.id}
                  onClick={() => setActiveId(v.id)}
                >
                  가상 {i + 1} · {v.floors}층
                </button>
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={`가상 건물 ${i + 1} 지우기`}
                  onClick={() => removeVirtual(v.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          {active && (
            <fieldset className={styles.controls}>
              <legend>가상 건물 {virtualBuildings.indexOf(active) + 1}</legend>
              <Slider
                label="층수"
                value={active.floors}
                min={VIRTUAL_LIMITS.floors.min}
                max={VIRTUAL_LIMITS.floors.max}
                unit="층"
                onChange={(floors) => set(active, { floors })}
              />
              <Slider
                label="가로"
                value={active.widthM}
                min={VIRTUAL_LIMITS.widthM.min}
                max={VIRTUAL_LIMITS.widthM.max}
                unit="m"
                onChange={(widthM) => set(active, { widthM })}
              />
              <Slider
                label="세로"
                value={active.depthM}
                min={VIRTUAL_LIMITS.depthM.min}
                max={VIRTUAL_LIMITS.depthM.max}
                unit="m"
                onChange={(depthM) => set(active, { depthM })}
              />
              <Slider
                label="회전"
                value={active.rotationDeg}
                min={0}
                max={175}
                step={5}
                unit="°"
                onChange={(rotationDeg) => set(active, { rotationDeg })}
              />
              <Slider
                label="동서"
                value={active.x}
                min={-reach}
                max={reach}
                unit="m"
                onChange={(x) => set(active, { x })}
              />
              <Slider
                label="남북"
                value={active.z}
                min={-reach}
                max={reach}
                unit="m"
                hint="+ 남쪽"
                onChange={(z) => set(active, { z })}
              />
            </fieldset>
          )}

          <label className={styles.check}>
            <input type="checkbox" checked={virtualEnabled} onChange={(e) => setVirtualEnabled(e.target.checked)} />
            가상 건물 계산에 넣기
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={showImpact} onChange={(e) => setShowImpact(e.target.checked)} />
            히트맵을 줄어든 일조로 칠하기
          </label>

          <ImpactReport
            status={status}
            virtualEnabled={virtualEnabled}
            unitLoss={unitLoss}
            onComputeBase={() => {
              restoreRef.current = true;
              setVirtualEnabled(false);
            }}
          />
        </>
      )}
    </div>
  );
}

function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  hint?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className={styles.slider}>
      <span>
        {props.label} <strong>{props.value}</strong>
        {props.unit} {props.hint && <small>({props.hint})</small>}
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </label>
  );
}

function ImpactReport({
  status,
  virtualEnabled,
  unitLoss,
  onComputeBase,
}: {
  status: ReturnType<typeof useVirtualUi>['status'];
  virtualEnabled: boolean;
  unitLoss: number | null;
  onComputeBase: () => void;
}) {
  if (!virtualEnabled) return <p className={styles.muted}>가상 건물을 뺀 원래 장면으로 계산합니다.</p>;
  if (status.kind === 'computing') return <p className={styles.muted}>가상 건물을 넣고 다시 계산하는 중…</p>;
  if (status.kind === 'need-base')
    return (
      <div className={styles.notice}>
        <p>이 날짜의 "놓기 전" 결과가 없어 비교할 수 없습니다.</p>
        <button type="button" className={styles.secondary} onClick={onComputeBase}>
          놓기 전 결과 계산하기
        </button>
      </div>
    );
  if (status.kind !== 'ready') return null;
  const s = status.impact.summary;
  return (
    <section className={styles.report} aria-label="가상 건물 영향" data-affected={s.affected}>
      <h3>
        영향 ({status.impact.date}, 남향 세대 {s.units.toLocaleString()}곳)
      </h3>
      <dl>
        <div>
          <dt>{AFFECTED_LOSS_MIN}분 이상 줄어든 세대</dt>
          <dd>{s.affected.toLocaleString()}곳</dd>
        </div>
        <div>
          <dt>기준 충족 → 미충족</dt>
          <dd className={s.newlyFailing > 0 ? styles.bad : undefined}>{s.newlyFailing.toLocaleString()}곳</dd>
        </div>
        <div>
          <dt>최대 감소</dt>
          <dd>{hm(s.maxLossMin)}</dd>
        </div>
        <div>
          <dt>영향 세대 평균 감소</dt>
          <dd>{hm(s.avgLossMin)}</dd>
        </div>
        <div>
          <dt>기준 충족 비율</dt>
          <dd>
            {s.meetsPctBefore}% → {s.meetsPctAfter}%
          </dd>
        </div>
        {unitLoss !== null && (
          <div>
            <dt>고른 세대</dt>
            <dd>{unitLoss > 0 ? `−${hm(unitLoss)}` : '변화 없음'}</dd>
          </div>
        )}
      </dl>
      <p className={styles.muted}>
        08~16시 총 일조 기준. 상자 모양으로 단순화한 가정이며 실제 건축 계획·인허가와 다를 수 있습니다.
      </p>
    </section>
  );
}
