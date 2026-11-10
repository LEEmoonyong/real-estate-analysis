// [요구사항: 컴포넌트] 지도 검색창 아래 접기/열기 패널 — 지역(시·도 → 시·군·구 → 동), 주택 유형(하나),
//   거래 종류(매매·전세·월세 중 하나), 방 구조, 세부 조건(가격 분포 슬라이더·보증금·면적·준공·거래 건수),
//   켜 둔 조건 칩(×로 하나씩 해제), 조건에 맞는 곳 목록(정렬·더 보기), 즐겨찾기한 단지 목록
// [요구사항: 상태관리] useState — 패널 열림, 시·도만 고르고 시·군·구는 아직 안 고른 중간 상태, 결과 정렬·표시 개수
// [요구사항: Hooks] useMemo — 결과 정렬 (결과·정렬 기준이 바뀔 때만)
// [요구사항: 이벤트 처리] onChange(select·체크·라디오·슬라이더) → 지역 이동·다시 불러오기·표시 거르기,
//   onClick(접기/열기·조건 칩 ×·초기화·결과 항목 → 지도에서 그곳)
import { useId, useMemo, useState } from 'react';
import { SIDO_LIST, findRegion, regionLabel, sigunguOf, type RegionEntry } from '../../data/regions/regions';
import {
  BUILD_YEAR_STEPS,
  COUNT_STEPS,
  DEFAULT_MAP_FILTER,
  DEPOSIT_CAP_STEPS,
  PYEONG_STEPS,
  activeFilterCount,
  filterChips,
  type MapFilter,
} from '../../domain/realestate/mapFilter';
import { RESULT_SORT_OPTIONS, sortResults, type ResultSort } from '../../domain/realestate/mapResults';
import { formatManwonShort } from '../../domain/realestate/format';
import { M2_PER_PYEONG } from '../../domain/realestate/types';
import {
  DEAL_KIND_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  ROOM_OPTIONS,
  filterValue,
  kindLabel,
  kindsFor,
  markerText,
  normalizeQuery,
  roomApplies,
  stepLabel,
  typeLabel,
  type DealPlace,
  type MarketQuery,
} from '../../domain/realestate/property';
import type { BudgetSetting } from '../../data/storage/complexNotes';
import { budgetLabel, type BudgetInfo } from '../../domain/finance/budget';
import { BudgetFinder, RecentComplexes } from './PanelExtras';
import { PriceRange } from './PriceRange';
import { Link } from 'react-router-dom';
import { useCompare } from '../../contexts/CompareContext';
import { useFavorites, useFavoritesActions } from '../../contexts/FavoritesContext';
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
  /** 조건에 맞는 곳 (null = 아직 불러온 시세 없음) */
  results: readonly DealPlace[] | null;
  /** 가격 외 조건을 통과한 곳의 값 [만원] — 가격 분포 막대 */
  priceValues: readonly number[];
  /** 결과 목록에서 한 곳을 고름 → 지도에서 그곳 카드 */
  onPickResult: (place: DealPlace) => void;
  /** 매매일 때 건물 key → 전세가율 */
  jeonseRatios?: ReadonlyMap<string, number> | undefined;
  /** 예산으로 찾기 입력과, 지금 지역 기준 계산 결과 (지역을 모르면 null) */
  budget: BudgetSetting;
  onBudget: (next: BudgetSetting) => void;
  budgetInfo: BudgetInfo | null;
}

const num = (v: string) => (v === '' ? null : Number(v));
/** 결과 목록을 한 번에 보여 줄 개수 */
const RESULT_PAGE = 20;

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
  results,
  priceValues,
  onPickResult,
  jeonseRatios,
  budget,
  onBudget,
  budgetInfo,
}: MarketPanelProps) {
  const { favorites } = useFavorites();
  // 삭제하면 5초 동안 "실행 취소" 알림이 뜬다 (FavoritesContext)
  const { removeFavorite } = useFavoritesActions();
  const { list: compareList } = useCompare();
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
  const budgetChip = budget.on && budgetInfo ? budgetLabel(budgetInfo) : null;
  const valueText = (v: number) => stepLabel(kind, v);
  const filterCount = activeFilterCount(filter);
  const chips = filterChips(filter, valueText);
  const kinds = kindsFor(query.type);

  // 결과 목록 정렬과 몇 개까지 보일지 (결과가 바뀌면 처음 개수로)
  const [sort, setSort] = useState<ResultSort>('count');
  const sorted = useMemo(
    () => (results ? sortResults(results, sort, (p) => filterValue(p, kind)) : []),
    [results, sort, kind],
  );
  const [page, setPage] = useState<{ of: readonly DealPlace[] | null; n: number }>({ of: null, n: RESULT_PAGE });
  const limit = page.of === results ? page.n : RESULT_PAGE;
  const setLimit = (n: number) => setPage({ of: results, n });

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
    results ? `${results.length.toLocaleString()}곳` : '',
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
        {compareList.length > 0 && (
          <Link
            to="/compare"
            className={styles.compareLink}
            title={compareList.map((e) => e.name).join(', ')}
            aria-label={`단지 비교 열기 (${compareList.length}곳)`}
          >
            비교 {compareList.length}
          </Link>
        )}
        {onShowGuide && (
          <button type="button" className={styles.help} onClick={onShowGuide} aria-label="지도 사용 안내 열기">
            ?
          </button>
        )}
      </div>

      {(chips.length > 0 || (lawd && dong) || budgetChip) && (
        // 켜 둔 조건 — 패널을 접어도 보이고, ×로 그 조건만 끈다
        <ul className={styles.chips} aria-label="적용한 조건">
          {budgetChip && (
            <li>
              <button
                type="button"
                className={styles.chip}
                onClick={() => onBudget({ ...budget, on: false })}
                aria-label={`${budgetChip} 조건 해제`}
              >
                {budgetChip} <span aria-hidden="true">×</span>
              </button>
            </li>
          )}
          {lawd && dong && (
            <li>
              <button type="button" className={styles.chip} onClick={() => onDong('')} aria-label={`${dong} 선택 해제`}>
                {dong} <span aria-hidden="true">×</span>
              </button>
            </li>
          )}
          {chips.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className={styles.chip}
                onClick={() => setF(c.clear)}
                aria-label={`${c.label} 조건 해제`}
              >
                {c.label} <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
          {chips.length > 1 && (
            <li>
              <button type="button" className={styles.chipClear} onClick={() => onFilter(DEFAULT_MAP_FILTER)}>
                모두 해제
              </button>
            </li>
          )}
        </ul>
      )}

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
              <span className={`${styles.label} ${styles.labelTop}`}>
                {kind === 'trade' ? '평당가' : kind === 'jeonse' ? '전세 보증금' : '월세'}
              </span>
              <PriceRange
                key={kind}
                kind={kind}
                values={priceValues}
                min={filter.minValue}
                max={filter.maxValue}
                onChange={(minValue, maxValue) => setF({ minValue, maxValue })}
                format={valueText}
              />

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

              <span className={styles.label}>거래 건수</span>
              <select
                value={filter.minCount ?? ''}
                onChange={(e) => setF({ minCount: num(e.target.value) })}
                aria-label="최근 3달 거래 건수 하한"
                title="거래가 1~2건뿐인 곳은 중앙값이 한 건 값이라 흔들립니다"
              >
                <option value="">전체</option>
                {COUNT_STEPS.map((v) => (
                  <option key={v} value={v}>
                    최근 3달 {v}건 이상
                  </option>
                ))}
              </select>
            </div>
            <p className={styles.note}>면적·가격은 건물별 최근 3달 중앙값 기준입니다.</p>
            {filterCount > 0 && (
              <button type="button" className={styles.reset} onClick={() => onFilter(DEFAULT_MAP_FILTER)}>
                세부 조건 초기화
              </button>
            )}
          </fieldset>

          <BudgetFinder budget={budget} onBudget={onBudget} info={budgetInfo} />

          <fieldset className={styles.group}>
            <legend>조건에 맞는 곳{results && ` (${results.length.toLocaleString()})`}</legend>
            {results === null ? (
              <p className={styles.note}>시·군·구를 고르거나 지도를 확대하면 조건에 맞는 곳이 여기 나옵니다.</p>
            ) : results.length === 0 ? (
              <p className={styles.note}>
                조건에 맞는 곳이 없습니다.{filterCount > 0 && ' 위 조건 칩의 ×로 조건을 하나씩 풀어 보세요.'}
              </p>
            ) : (
              <>
                <select value={sort} onChange={(e) => setSort(e.target.value as ResultSort)} aria-label="결과 정렬">
                  {RESULT_SORT_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <ul className={styles.resultList}>
                  {sorted.slice(0, limit).map((p) => {
                    const text = markerText(p, kind);
                    return (
                      <li key={p.key}>
                        <button
                          type="button"
                          className={styles.resultItem}
                          onClick={() => onPickResult(p)}
                          title={`${p.name} 지도에서 보기`}
                        >
                          <span className={styles.resultName}>
                            {p.name}
                            <small>{p.level === 'dong' ? '동 단위' : p.umdName}</small>
                          </span>
                          <span className={styles.resultValue}>
                            {text.main}
                            {text.sub && <small> · {text.sub}</small>}
                          </span>
                          <span className={styles.resultMeta}>
                            {Math.round(p.areaMedian / M2_PER_PYEONG)}평{p.buildYear !== null && ` · ${p.buildYear}년`}{' '}
                            · {p.count}건
                            {kind === 'trade' && jeonseRatios?.has(p.key) && (
                              <> · 전세가율 {Math.round(jeonseRatios.get(p.key)! * 100)}%</>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {sorted.length > limit && (
                  <button type="button" className={styles.reset} onClick={() => setLimit(limit + RESULT_PAGE)}>
                    더 보기 ({(sorted.length - limit).toLocaleString()}곳 남음)
                  </button>
                )}
              </>
            )}
          </fieldset>

          <fieldset className={styles.group}>
            <legend>즐겨찾기 ({favorites.length})</legend>
            {favorites.length === 0 ? (
              <p className={styles.note}>단지 분석 화면에서 ★ 현재 위치 추가로 즐겨찾기할 수 있습니다.</p>
            ) : (
              <ul className={styles.favList}>
                {favorites.map((f) => (
                  <li key={f.id} className={styles.favRow}>
                    <button
                      type="button"
                      className={styles.favItem}
                      onClick={() => onOpenFavorite(f)}
                      title={`${f.name} 단지 분석 열기`}
                    >
                      <span aria-hidden="true">★</span> {f.name}
                    </button>
                    <button
                      type="button"
                      className={styles.favRemove}
                      onClick={() => removeFavorite(f.id)}
                      aria-label={`즐겨찾기 '${f.name}' 삭제`}
                      title="즐겨찾기 삭제"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>

          <RecentComplexes />
        </div>
      )}
    </section>
  );
}
