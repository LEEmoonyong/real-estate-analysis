// [요구사항: 컴포넌트] 세대 리포트 (확장 X5) — 세대 점수표 + 일조 + 주변 시세 + 대출·세금 추정 + 주변 시설을 한 장으로.
// "인쇄 / PDF 저장"은 브라우저 인쇄(window.print)를 쓰고, 인쇄용 CSS가 리포트만 남긴다(라이브러리 없음).
// [요구사항: 이벤트 처리] onClick(인쇄·닫기), keydown(Esc 닫기)
// [요구사항: Hooks] useEffect(주변 시설·시세 불러오기, Esc), useMemo(점수·대출 계산)
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useHeatmap } from '../../contexts/HeatmapContext';
import { useSceneData } from '../../contexts/SceneDataContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useSimulation } from '../../contexts/SimulationContext';
import { getNearby, getRegion, getTradeComplexes, latestDealMonth } from '../../data/realestate/realestateClient';
import { classifyArea, estimateLoan } from '../../domain/finance/loan';
import { acquisitionTax } from '../../domain/finance/tax';
import { compass8 } from '../../domain/geo/compass';
import { nearbyTradeComplexes } from '../../domain/realestate/aggregate';
import { formatArea, formatManwon, perPyeong } from '../../domain/realestate/format';
import {
  groupSchools,
  groupStations,
  nearbySummary,
  walkMinutes,
  type NearbyResponse,
} from '../../domain/realestate/nearby';
import type { Region, TradeComplex } from '../../domain/realestate/types';
import { unitScore } from '../../domain/realestate/unitScore';
import { evaluateCriteria } from '../../domain/sunlight/criteria';
import { skyOpenness } from '../../domain/sunlight/skyView';
import { findUnitIndex, unitAt } from '../../domain/units/generateUnits';
import type { SunlightOutcome } from '../../workers/sceneTransfer';
import styles from './UnitReport.module.css';

/** 주변 시세로 쓸 거래 단지 반경 — 샘플 지역은 중심이 단지 한가운데가 아닐 수 있어 넉넉히 */
const MARKET_RADIUS_M = 400;

const hm = (m: number) => `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ''}`;

export function UnitReport({ onClose }: { onClose: () => void }) {
  const { scene, units, buildings, selectedUnitId, sceneHash } = useSceneData();
  const { results } = useSimulation();
  const { svf } = useHeatmap();
  const { settings } = useSettings();
  const place = scene?.place;
  const [nearby, setNearby] = useState<NearbyResponse | null>(null);
  const [market, setMarket] = useState<{ region: Region; complex: TradeComplex | null } | null>(null);

  // 주변 시설·주변 시세는 실패해도 리포트는 보여 준다 (항목만 빠짐)
  useEffect(() => {
    if (!place) return;
    const controller = new AbortController();
    getNearby(place.lat, place.lng, controller.signal)
      .then(setNearby)
      .catch(() => undefined);
    void (async () => {
      try {
        const region = await getRegion(place.lat, place.lng, controller.signal);
        const list = await getTradeComplexes(region, latestDealMonth(), 3, controller.signal);
        setMarket({ region, complex: nearbyTradeComplexes(list, place, MARKET_RADIUS_M)[0] ?? null });
      } catch {
        /* 시세 없이 */
      }
    })();
    return () => controller.abort();
  }, [place]);

  // Esc로 닫기 — 전역 단축키(Esc = 세대 선택 해제)는 aria-modal이 열려 있으면 쉬므로 선택은 유지된다
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const index = useMemo(
    () => (selectedUnitId ? findUnitIndex(units, buildings, selectedUnitId) : -1),
    [units, buildings, selectedUnitId],
  );
  const unit = index >= 0 ? unitAt(units, index, buildings) : null;
  const building = unit ? buildings.find((b) => b.id === unit.buildingId) : undefined;
  const outcome = results.sunlight as SunlightOutcome | undefined;
  const valid = outcome && outcome.sceneHash === sceneHash && outcome.unitCount === units.count && index >= 0;

  const score = useMemo(() => {
    if (!valid || !unit || !building) return null;
    const crit = evaluateCriteria(
      outcome.windowMaxContinuous[index]!,
      outcome.windowTotalMinutes[index]!,
      settings.criteria,
    );
    const near = nearby ? nearbySummary(nearby) : null;
    return unitScore({
      windowTotalMinutes: outcome.windowTotalMinutes[index]!,
      windowMaxContinuous: outcome.windowMaxContinuous[index]!,
      meetsCriteria: crit.meets,
      azimuthDeg: unit.azimuthDeg,
      floor: unit.floor,
      topFloor: building.floors,
      svf: svf ? svf[index]! : null,
      elementaryM: near?.elementaryM ?? null,
      subwayM: near?.subwayM ?? null,
    });
  }, [valid, outcome, index, unit, building, settings.criteria, svf, nearby]);

  const money = useMemo(() => {
    const c = market?.complex;
    if (!market || !c) return null;
    const areaClass = classifyArea(market.region.sido, market.region.sigungu);
    const loan = estimateLoan({
      price: c.lastPrice,
      areaClass,
      buyer: 'none',
      annualIncome: 8_000,
      otherDebtAnnual: 0,
      ratePct: 4.5,
      years: 30,
    });
    const tax = acquisitionTax({ price: c.lastPrice, area: c.lastArea, homesAfter: 1, areaClass });
    return { c, loan, tax };
  }, [market]);

  if (!unit || !building || !place) return null;
  const dong = building.dongNumber ? `${building.dongNumber}동` : (building.name ?? '건물');
  const schools = nearby ? groupSchools(nearby.school) : null;
  const stations = nearby ? groupStations(nearby.subway) : [];

  return createPortal(
    <div className={`unit-report-root ${styles.overlay}`} role="dialog" aria-modal="true" aria-label="세대 리포트">
      <div className={styles.toolbar}>
        <button type="button" className={styles.primary} onClick={() => window.print()}>
          인쇄 / PDF 저장
        </button>
        <button type="button" className={styles.secondary} onClick={onClose}>
          닫기 (Esc)
        </button>
      </div>
      <article className={styles.page} data-report-score={score?.total ?? ''}>
        <header className={styles.head}>
          <p className={styles.kicker}>세대 리포트 · {new Date().toLocaleDateString('ko-KR')}</p>
          <h1 className={styles.title}>
            {place.name} {dong} {unit.floor}층 {unit.hoNumber ? `${unit.hoNumber}호(추정)` : '측면 창'}
          </h1>
          <p className={styles.muted}>
            {[
              place.address,
              `창 방향 ${compass8(unit.azimuthDeg)} ${Math.round(unit.azimuthDeg)}°`,
              `${unit.floor}/${building.floors}층`,
              `분석 날짜 ${outcome?.date ?? '—'}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </header>

        {score && (
          <section className={styles.section}>
            <h2>생활 환경 점수</h2>
            <div className={styles.scoreRow}>
              <p className={styles.score}>
                {score.total}
                <small>/100</small> <span className={styles.grade}>{score.grade}</span>
              </p>
              <table className={styles.table}>
                <tbody>
                  {score.items.map((i) => (
                    <tr key={i.id}>
                      <td>{i.label}</td>
                      <td>
                        <span className={styles.meter}>
                          <span style={{ width: `${(i.score / i.max) * 100}%` }} />
                        </span>
                      </td>
                      <td>
                        {i.score}/{i.max}
                      </td>
                      <td className={styles.muted}>{i.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={styles.muted}>
              일조·향·개방감·층·입지를 합친 참고 점수입니다.{' '}
              {svf ? '' : '천공률 레이어를 한 번 켜면 개방감 항목이 더해집니다. '}
              가격·관리 상태 등은 반영하지 않습니다.
            </p>
          </section>
        )}

        {valid && (
          <section className={styles.section}>
            <h2>일조 ({outcome.date})</h2>
            <dl className={styles.stats}>
              <div>
                <dt>하루 총 일조</dt>
                <dd>{hm(outcome.totalMinutes[index]!)}</dd>
              </div>
              <div>
                <dt>08~16시 총</dt>
                <dd>{hm(outcome.windowTotalMinutes[index]!)}</dd>
              </div>
              <div>
                <dt>09~15시 최대 연속</dt>
                <dd>{hm(outcome.windowMaxContinuous[index]!)}</dd>
              </div>
              {svf && (
                <div>
                  <dt>하늘 개방도</dt>
                  <dd>{Math.round(skyOpenness(svf[index]!) * 100)}%</dd>
                </div>
              )}
            </dl>
            <p className={styles.muted}>
              판례 등에서 자주 언급되는 동지 기준을 참고로 계산했으며 법적 판단이 아닙니다.
            </p>
          </section>
        )}

        <section className={styles.section}>
          <h2>주변 시세 · 대출 · 세금 (추정)</h2>
          {!market ? (
            <p className={styles.muted}>시세를 불러오는 중이거나 이 위치의 실거래 정보를 찾지 못했습니다.</p>
          ) : !money ? (
            <p className={styles.muted}>이 위치 400m 안에서 최근 3달 매매된 단지가 없습니다.</p>
          ) : (
            <dl className={styles.stats}>
              <div>
                <dt>{money.c.aptName} 최근 거래</dt>
                <dd>
                  {formatManwon(money.c.lastPrice)} <small>{formatArea(money.c.lastArea)}</small>
                </dd>
              </div>
              <div>
                <dt>평당가 (최근 3달 중앙값)</dt>
                <dd>{formatManwon(perPyeong(money.c.medianPricePerM2))}</dd>
              </div>
              <div>
                <dt>주담대 한도 (무주택·연소득 8천 가정)</dt>
                <dd>{money.loan.maxLoan > 0 ? formatManwon(money.loan.maxLoan) : '불가'}</dd>
              </div>
              <div>
                <dt>취득세 등 (1주택)</dt>
                <dd>{formatManwon(Math.round(money.tax.total))}</dd>
              </div>
            </dl>
          )}
        </section>

        <section className={styles.section}>
          <h2>학군 · 교통</h2>
          {!nearby ? (
            <p className={styles.muted}>주변 시설을 불러오는 중…</p>
          ) : (
            <ul className={styles.list}>
              <li>
                초등학교:{' '}
                {schools?.elementary[0]
                  ? `${schools.elementary[0].name} 도보 ${walkMinutes(schools.elementary[0].distanceM)}분`
                  : '1.5km 안 없음'}
              </li>
              <li>
                중학교:{' '}
                {schools?.middle[0]
                  ? `${schools.middle[0].name} 도보 ${walkMinutes(schools.middle[0].distanceM)}분`
                  : '1.5km 안 없음'}
              </li>
              <li>
                지하철:{' '}
                {stations[0]
                  ? `${stations[0].station}(${stations[0].lines.join('·')}) 도보 ${walkMinutes(stations[0].distanceM)}분`
                  : '2km 안 없음'}
              </li>
            </ul>
          )}
        </section>

        <footer className={styles.foot}>
          전국 부동산 분석 · 일조는 직접 구현한 태양 위치·광선 계산, 시세는 국토교통부 실거래가, 주변 시설은 카카오 로컬
          기준입니다. 세대 위치·호수는 추정값이며, 대출·세금은 참고용 추정입니다.
        </footer>
      </article>
    </div>,
    document.body,
  );
}
