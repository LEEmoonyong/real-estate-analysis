// [요구사항: 컴포넌트] 태양 정보 카드 + 태양 경로 표시 선택 (PLAN.md 9.8, 단계 B3)
// 일출·남중·일몰 시각, 남중 고도, 낮 길이와 3D 궤적 토글(선택한 날짜 / 동지 / 하지 / 춘분·추분)
// [요구사항: 이벤트 처리] onChange(체크박스)
import { DEFAULT_LOCATION } from '../../config/constants';
import { useSceneData } from '../../contexts/SceneDataContext';
import { useSettings, useSettingsActions, type SunPathDay } from '../../contexts/SettingsContext';
import { useTime } from '../../contexts/TimeContext';
import { formatMinute } from '../../domain/time/kst';
import { useSunEvents } from '../../hooks/useSunPosition';
import { SUN_PATH_STYLE } from '../../scene/sunPathStyle';
import styles from './SunInfoCard.module.css';

const DAYS: SunPathDay[] = ['today', 'winter', 'summer', 'spring'];

const duration = (min: number) => `${Math.floor(min / 60)}시간 ${Math.round(min % 60)}분`;

export function SunInfoCard() {
  const { scene } = useSceneData();
  const { date } = useTime();
  const { sunPaths } = useSettings();
  const { setSunPathVisible } = useSettingsActions();
  const place = scene?.place ?? DEFAULT_LOCATION;
  const events = useSunEvents(place.lat, place.lng, date);

  return (
    <div className={styles.root}>
      <dl className={styles.grid} aria-label={`${date} 태양 정보`}>
        <div>
          <dt>일출</dt>
          <dd>{events.sunriseMin === null ? '—' : formatMinute(Math.round(events.sunriseMin))}</dd>
        </div>
        <div>
          <dt>남중</dt>
          <dd>{formatMinute(Math.round(events.solarNoonMin))}</dd>
        </div>
        <div>
          <dt>일몰</dt>
          <dd>{events.sunsetMin === null ? '—' : formatMinute(Math.round(events.sunsetMin))}</dd>
        </div>
        <div>
          <dt>남중 고도</dt>
          <dd>{events.noonAltitudeDeg.toFixed(1)}°</dd>
        </div>
        <div>
          <dt>낮 길이</dt>
          <dd>{duration(events.dayLengthMin)}</dd>
        </div>
      </dl>
      <fieldset className={styles.paths}>
        <legend className={styles.legend}>3D 태양 경로</legend>
        {DAYS.map((day) => (
          <label key={day} className={styles.option}>
            <input type="checkbox" checked={sunPaths[day]} onChange={(e) => setSunPathVisible(day, e.target.checked)} />
            <span className={styles.swatch} style={{ background: SUN_PATH_STYLE[day].color }} aria-hidden="true" />
            {SUN_PATH_STYLE[day].label}
          </label>
        ))}
      </fieldset>
    </div>
  );
}
