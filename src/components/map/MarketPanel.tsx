// [요구사항: 컴포넌트] 지도 검색창 아래 접기/열기 패널 — 지역(시·도 → 시·군·구 → 동), 주택 유형(하나),
//   거래 종류(매매·전세·월세 중 하나), 방 구조, 세부 조건(가격·보증금·면적·준공·일조), 즐겨찾기한 단지 목록
// [요구사항: 상태관리] useState — 패널 열림, 시·도만 고르고 시·군·구는 아직 안 고른 중간 상태
// [요구사항: 이벤트 처리] onChange(select·체크·라디오) → 지역 이동·다시 불러오기·표시 거르기, onClick(접기/열기·초기화)
import { useId, useState } from 'react';
import { SIDO_LIST, findRegion, regionLabel, sigunguOf, type RegionEntry } from '../../data/regions/regions';
import {
  BUILD_YEAR_STEPS,
  DEFAULT_MAP_FILTER,
  DEPOSIT_CAP_STEPS,
  PYEONG_STEPS,
  activeFilterCount,
  type MapFilter,
} from '../../domain/realestate/mapFilter';
import { formatManwonShort } from '../../domain/realestate/format';
import {
  DEAL_KIND_OPTIONS,
  FILTER_STEPS,
  PROPERTY_TYPE_OPTIONS,
  ROOM_OPTIONS,
  kindLabel,
  kindsFor,
  normalizeQuery,
  roomApplies,
  stepLabel,
  typeLabel,
  type MarketQuery,
} from '../../domain/realestate/property';
import { useFavorites } from '../../contexts/FavoritesContext';
import type { Favorite } from '../../domain/types';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import styles from './MarketPanel.module.css';

interface MarketPanelProps {
  query: MarketQuery;
  onQuery: (q: MarketQuery) => void;
  filter: MapFilter;
  onFilter: (f: MapFilter) => void;
  /** 지금 지도에 불러온(또는 불러오는 중인) 시·군·구 코드 */
  regionLawd: string | null;
  onRegion: (r: RegionEntry) => void;
  onSido: (sido: string) => void;
  /** 불러온 시·군·구에서 거래가 있는 법정동 목록과 고른 동 ('' = 전체) */
  dongs: readonly string[];
  dong: string;
  onDong: (dong: string) => void;
  /** 즐겨찾기 단지를 고름 → 단지 분석으로 */
  onOpenFavorite: (fav: Favorite) => void;
  /** 안내 카드를 닫아 두었으면 다시 여는 버튼을 패널 머리에 둔다 */
  onShowGuide: (() => void) | null;
}

const SUN_STEPS = [50, 70, 90] as const;
const num = (v: string) => (v === '' ? null : Number(v));

export function MarketPanel({
  query,
  onQuery,
  filter,
  onFilter,
  regionLawd,
  onRegion,
  onSido,
  dongs,
  dong,
  onDong,
  onOpenFavorite,
  onShowGuide,
}: MarketPanelProps) {
  const { favorites } = useFavorites();
  const id = useId();
  const isMobile = useMediaQuery('(max-width: 767px)');
  // 휴대폰은 지도를 가리지 않게 접힌 채로 시작
  const [open, setOpen] = useState<boolean | null>(null);
  const isOpen = open ?? !isMobile;
  // 시·도만 고른 상태 (시·군·구를 고르면 지도가 그 지역을 불러오고 이 값은 비운다)
  const [pickedSido, setPickedSido] = useState<string | null>(null);

  const current = regionLawd ? findRegion(regionLawd) : undefined;
  const sido = pickedSido ?? current?.sido ?? '';
  const lawd = pickedSido && pickedSido !== current?.sido ? '' : (current?.lawdCode ?? '');
  const sigungus = sido ? sigunguOf(sido) : [];

  const set = (patch: Partial<MarketQuery>) => onQuery(normalizeQuery({ ...query, ...patch }));
  const setF = (patch: Partial<MapFilter>) => onFilter({ ...filter, ...patch });
  const kind = query.kind;
  const steps = FILTER_STEPS[kind];
  const filterCount = activeFilterCount(filter);
  const kinds = kindsFor(query.type);

  const pickSido = (next: string) => {
    if (!next) return;
    const list = sigunguOf(next);
    // 세종처럼 시·군·구가 하나뿐이면 바로 그 지역으로
    if (list.length === 1) {
      setPickedSido(null);
      onRegion(list[0]!);
      return;
    }
    setPickedSido(next);
    onSido(next);
  };

  const pickSigungu = (next: string) => {
    const r = findRegion(next);
    if (!r) return;
    setPickedSido(null);
    onRegion(r);
  };

  const summary = [
    current ? `${regionLabel(current)}${dong ? ` ${dong}` : ''}` : sido || '지역 미선택',
    typeLabel(query.type),
    kindLabel(kind),
    filterCount > 0 ? `세부 ${filterCount}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section className={styles.root} aria-label="지역·조건 선택">
      <div className={styles.head}>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={isOpen}
          aria-controls={`${id}-body`}
          onClick={() => setOpen(!isOpen)}
        >
          <span className={styles.toggleTitle}>지역·조건 {isOpen ? '▲' : '▼'}</span>
          <span className={styles.summary}>{summary}</span>
        </button>
        {onShowGuide && (
          <button type="button" className={styles.help} onClick={onShowGuide} aria-label="지도 사용 안내 열기">
            ?
          </button>
        )}
      </div>

      {isOpen && (
        <div id={`${id}-body`} className={styles.body}>
          <fieldset className={styles.group}>
            <legend>지역</legend>
            <div className={styles.row}>
              <select value={sido} onChange={(e) => pickSido(e.target.value)} aria-label="시·도">
                <option value="" disabled>
                  시·도
                </option>
                {SIDO_LIST.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                value={lawd}
                onChange={(e) => pickSigungu(e.target.value)}
                aria-label="시·군·구"
                disabled={sigungus.length === 0}
              >
                <option value="" disabled>
                  시·군·구
                </option>
                {sigungus.map((r) => (
                  <option key={r.lawdCode} value={r.lawdCode}>
                    {r.sigungu || `${r.sido} 전체`}
                  </option>
                ))}
              </select>
              <select
                value={lawd ? dong : ''}
                onChange={(e) => onDong(e.target.value)}
                aria-label="동"
                disabled={!lawd || dongs.length === 0}
              >
                <option value="">{lawd ? '동 전체' : '동'}</option>
                {dongs.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            {pickedSido && !lawd && <p className={styles.note}>시·군·구를 고르면 그 지역 건물이 표시됩니다.</p>}
            {lawd && dongs.length > 0 && (
              <p className={styles.note}>동 목록은 최근 3달 이 조건의 거래가 있는 법정동입니다.</p>
            )}
          </fieldset>

          <fieldset className={styles.group}>
            <legend>유형</legend>
            <div className={styles.row}>
              {PROPERTY_TYPE_OPTIONS.map((o) => (
                <label key={o.id} className={styles.check} title={o.hint}>
                  <input
                    type="radio"
                    name={`${id}-type`}
                    checked={query.type === o.id}
                    onChange={() => set({ type: o.id })}
                  />
                  {o.label}
                </label>
              ))}
            </div>
            {query.type === 'nrg' && <p className={styles.note}>상가는 국토교통부 공개 자료에 매매만 있습니다.</p>}
          </fieldset>

          <fieldset className={styles.group}>
            <legend>거래</legend>
            <div className={styles.row}>
              {DEAL_KIND_OPTIONS.map((o) => (
                <label key={o.id} className={styles.check}>
                  <input
                    type="radio"
                    name={`${id}-kind`}
                    checked={kind === o.id}
                    disabled={!kinds.includes(o.id)}
                    onChange={() => set({ kind: o.id })}
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </fieldset>

          {roomApplies(query.type) && (
            <fieldset className={styles.group}>
              <legend>방 구조 (면적으로 추정)</legend>
              <div className={styles.row}>
                {ROOM_OPTIONS.map((o) => (
                  <label key={o.id} className={styles.check} title={o.hint}>
                    <input
                      type="radio"
                      name={`${id}-room`}
                      checked={query.room === o.id}
                      onChange={() => set({ room: o.id })}
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <fieldset className={styles.group}>
            <legend>세부 조건</legend>
            <div className={styles.grid}>
              <span className={styles.label}>
                {kind === 'trade' ? '평당가' : kind === 'jeonse' ? '전세 보증금' : '월세'}
              </span>
              <div className={styles.row}>
                <select
                  value={filter.minValue ?? ''}
                  onChange={(e) => setF({ minValue: num(e.target.value) })}
                  aria-label="가격 하한"
                >
                  <option value="">하한 없음</option>
                  {steps.map((v) => (
                    <option key={v} value={v}>
                      {stepLabel(kind, v)} 이상
                    </option>
                  ))}
                </select>
                <select
                  value={filter.maxValue ?? ''}
                  onChange={(e) => setF({ maxValue: num(e.target.value) })}
                  aria-label="가격 상한"
                >
                  <option value="">상한 없음</option>
                  {steps.map((v) => (
                    <option key={v} value={v}>
                      {stepLabel(kind, v)} 이하
                    </option>
                  ))}
                </select>
              </div>

              {kind === 'wolse' && (
                <>
                  <span className={styles.label}>보증금</span>
                  <select
                    value={filter.maxDeposit ?? ''}
                    onChange={(e) => setF({ maxDeposit: num(e.target.value) })}
                    aria-label="월세 보증금 상한"
                  >
                    <option value="">제한 없음</option>
                    {DEPOSIT_CAP_STEPS.map((v) => (
                      <option key={v} value={v}>
                        {formatManwonShort(v)} 이하
                      </option>
                    ))}
                  </select>
                </>
              )}

              <span className={styles.label}>면적</span>
              <div className={styles.row}>
                <select
                  value={filter.minPyeong ?? ''}
                  onChange={(e) => setF({ minPyeong: num(e.target.value) })}
                  aria-label="면적 하한(평)"
                >
                  <option value="">하한 없음</option>
                  {PYEONG_STEPS.map((v) => (
                    <option key={v} value={v}>
                      {v}평 이상
                    </option>
                  ))}
                </select>
                <select
                  value={filter.maxPyeong ?? ''}
                  onChange={(e) => setF({ maxPyeong: num(e.target.value) })}
                  aria-label="면적 상한(평)"
                >
                  <option value="">상한 없음</option>
                  {PYEONG_STEPS.map((v) => (
                    <option key={v} value={v}>
                      {v}평 이하
                    </option>
                  ))}
                </select>
              </div>

              <span className={styles.label}>준공</span>
              <select
                value={filter.minBuildYear ?? ''}
                onChange={(e) => setF({ minBuildYear: num(e.target.value) })}
                aria-label="준공 연도"
              >
                <option value="">전체</option>
                {BUILD_YEAR_STEPS.map((v) => (
                  <option key={v} value={v}>
                    {v}년 이후
                  </option>
                ))}
              </select>

              {query.type === 'apt' && (
                <>
                  <span className={styles.label}>일조</span>
                  <select
                    value={filter.minSunPct}
                    onChange={(e) => setF({ minSunPct: Number(e.target.value) })}
                    aria-label="일조 기준 충족 세대 비율 하한"
                  >
                    <option value={0}>조건 없음</option>
                    {SUN_STEPS.map((v) => (
                      <option key={v} value={v}>
                        기준 충족 {v}% 이상
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
            <p className={styles.note}>
              면적·가격은 건물별 최근 3달 중앙값 기준입니다.
              {filter.minSunPct > 0 && ' 일조는 이 기기에서 분석한 단지 주변만 알 수 있습니다.'}
            </p>
            {filterCount > 0 && (
              <button type="button" className={styles.reset} onClick={() => onFilter(DEFAULT_MAP_FILTER)}>
                세부 조건 초기화
              </button>
            )}
          </fieldset>

          <fieldset className={styles.group}>
            <legend>즐겨찾기 ({favorites.length})</legend>
            {favorites.length === 0 ? (
              <p className={styles.note}>단지 분석 화면에서 ★ 현재 위치 추가로 즐겨찾기할 수 있습니다.</p>
            ) : (
              <ul className={styles.favList}>
                {favorites.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      className={styles.favItem}
                      onClick={() => onOpenFavorite(f)}
                      title={`${f.name} 단지 분석 열기`}
                    >
                      <span aria-hidden="true">★</span> {f.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
        </div>
      )}
    </section>
  );
}
