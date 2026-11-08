// [요구사항: 컴포넌트] 대출·세금 계산기 (확장 X4) — 주담대 한도(LTV·가격별 한도·DSR), 월 상환액, 취득세, 보유세
// [요구사항: 상태관리] useReducer — 입력 폼 상태(필드 여러 개를 한 곳에서 갱신), useState — 금리 목록
// [요구사항: 이벤트 처리] onChange(입력·선택), onClick(금리 적용)
// [요구사항: 데이터 처리] 외부 API — 금감원 금융상품한눈에(주담대 금리), 주소 쿼리로 단지 시세 전달
// 결과는 모두 "참고용 추정" — 규칙은 src/config/regulations.ts(기준일 표시).
import { useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BUYER_LABELS, REGULATION_BASIS_DATE, REGULATION_SOURCES, type BuyerType } from '../config/regulations';
import { getJson } from '../data/apiClient';
import { classifyArea, estimateLoan, type AreaClass } from '../domain/finance/loan';
import { acquisitionTax, estimatePublicPrice, holdingTax, type TaxResult } from '../domain/finance/tax';
import { formatManwon } from '../domain/realestate/format';
import styles from './CalculatorPage.module.css';

interface MortgageRate {
  bank: string;
  product: string;
  rateType: '고정' | '변동';
  min: number | null;
  max: number | null;
  avg: number | null;
  month: string;
}

interface Form {
  price: number;
  area: number;
  areaClass: AreaClass;
  buyer: BuyerType;
  annualIncome: number;
  otherDebtAnnual: number;
  ratePct: number;
  years: number;
  homesAfter: number;
  /** 공시가격 직접 입력 (0이면 시세 × 현실화율 추정) */
  publicPrice: number;
}

type FormAction = { type: 'set'; field: keyof Form; value: Form[keyof Form] };

// [요구사항: 상태관리] useReducer — 폼 필드 갱신 + 서로 맞물리는 값 정리
function formReducer(state: Form, action: FormAction): Form {
  const next = { ...state, [action.field]: action.value } as Form;
  // 다주택 유형을 고르면 보유 주택 수를 최소 2로, 무주택·생애최초면 1로
  if (action.field === 'buyer') {
    if (action.value === 'multi' && next.homesAfter < 2) next.homesAfter = 2;
    if ((action.value === 'none' || action.value === 'firstTime') && next.homesAfter !== 1) next.homesAfter = 1;
  }
  return next;
}

const AREA_CLASS_LABELS: Record<AreaClass, string> = {
  regulated: '규제지역 (서울 전역·경기 12곳)',
  capital: '수도권 비규제지역',
  other: '지방',
};

const num = (v: string | null, fallback: number) => {
  const n = Number(v);
  return v !== null && v !== '' && Number.isFinite(n) && n >= 0 ? n : fallback;
};

/** /calc 주소로 여는 계산기 — 주소 쿼리(price·area·sido·sigungu·name)로 시작 값을 받는다 */
export function CalculatorPage() {
  const [params] = useSearchParams();
  const name = params.get('name') ?? '';
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.back}>
          ← 지도
        </Link>
        <h1 className={styles.title}>대출·세금 계산기</h1>
        {name && <span className={styles.muted}>{name}</span>}
      </header>
      <main>
        <LoanCalculator
          price={num(params.get('price'), 100_000)}
          area={num(params.get('area'), 84)}
          sido={params.get('sido') ?? ''}
          sigungu={params.get('sigungu') ?? ''}
        />
      </main>
    </div>
  );
}

export interface LoanCalculatorProps {
  /** 시작 주택 가격 [만원] */
  price: number;
  /** 전용면적 [㎡] */
  area: number;
  /** 지역 (규제지역 판단) — 모르면 '' */
  sido: string;
  sigungu: string;
}

/** 계산기 본문 — /calc 화면과 단지 상세의 "대출 계산" 탭이 함께 쓴다 */
export function LoanCalculator({ price, area, sido, sigungu }: LoanCalculatorProps) {
  const [form, dispatch] = useReducer(formReducer, undefined, () => ({
    price,
    area,
    areaClass: sido ? classifyArea(sido, sigungu) : 'regulated',
    buyer: 'none' as BuyerType,
    annualIncome: 8_000,
    otherDebtAnnual: 0,
    ratePct: 4.5,
    years: 30,
    homesAfter: 1,
    publicPrice: 0,
  }));
  const set = <K extends keyof Form>(field: K, value: Form[K]) => dispatch({ type: 'set', field, value });

  // 금감원 주담대 금리 (하루 캐시)
  const [rates, setRates] = useState<{ items: MortgageRate[] } | { error: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    getJson<{ items: MortgageRate[] }>('/api/finance/mortgage-rates', controller.signal)
      .then((r) => setRates({ items: r.items }))
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setRates({ error: e instanceof Error ? e.message : String(e) });
      });
    return () => controller.abort();
  }, []);

  const loan = useMemo(
    () =>
      estimateLoan({
        price: form.price,
        areaClass: form.areaClass,
        buyer: form.buyer,
        annualIncome: form.annualIncome,
        otherDebtAnnual: form.otherDebtAnnual,
        ratePct: form.ratePct,
        years: form.years,
      }),
    [form],
  );
  const acquisition = useMemo(
    () =>
      acquisitionTax({
        price: form.price,
        area: form.area,
        homesAfter: form.homesAfter,
        areaClass: form.areaClass,
        firstHome: form.buyer === 'firstTime',
      }),
    [form],
  );
  const publicPrice = form.publicPrice > 0 ? form.publicPrice : estimatePublicPrice(form.price);
  const holding = useMemo(
    () => holdingTax({ publicPrice, oneHome: form.homesAfter === 1, homes: form.homesAfter }),
    [publicPrice, form.homesAfter],
  );

  const bindingLabel = { ltv: 'LTV', priceCap: '주택가격별 한도', dsr: 'DSR(소득)' }[loan.binding];
  const maxBar = Math.max(loan.byLtv, loan.byPriceCap ?? 0, loan.byDsr, 1);

  return (
    <>
      <div className={styles.main}>
        <form className={styles.form} onSubmit={(e) => e.preventDefault()} aria-label="계산 조건">
          <Field label="주택 가격 (만원)" hint={formatManwon(form.price)}>
            <input
              type="number"
              min={0}
              step={1000}
              value={form.price}
              onChange={(e) => set('price', Number(e.target.value))}
            />
          </Field>
          <Field label="전용면적 (㎡)" hint="85㎡ 초과면 농어촌특별세">
            <input
              type="number"
              min={10}
              max={400}
              step={0.1}
              value={form.area}
              onChange={(e) => set('area', Number(e.target.value))}
            />
          </Field>
          <Field label="지역" hint={sido ? `${sido} ${sigungu} → 자동 판단` : '단지에서 열면 자동으로 정해집니다'}>
            <select value={form.areaClass} onChange={(e) => set('areaClass', e.target.value as AreaClass)}>
              {(Object.keys(AREA_CLASS_LABELS) as AreaClass[]).map((k) => (
                <option key={k} value={k}>
                  {AREA_CLASS_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="구입자">
            <select value={form.buyer} onChange={(e) => set('buyer', e.target.value as BuyerType)}>
              {(Object.keys(BUYER_LABELS) as BuyerType[]).map((k) => (
                <option key={k} value={k}>
                  {BUYER_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="연소득 (만원)" hint={formatManwon(form.annualIncome)}>
            <input
              type="number"
              min={0}
              step={100}
              value={form.annualIncome}
              onChange={(e) => set('annualIncome', Number(e.target.value))}
            />
          </Field>
          <Field label="다른 대출 연간 원리금 (만원)">
            <input
              type="number"
              min={0}
              step={10}
              value={form.otherDebtAnnual}
              onChange={(e) => set('otherDebtAnnual', Number(e.target.value))}
            />
          </Field>
          <Field label="대출 금리 (%)">
            <input
              type="number"
              min={0}
              max={20}
              step={0.01}
              value={form.ratePct}
              onChange={(e) => set('ratePct', Number(e.target.value))}
            />
          </Field>
          <Field label="만기 (년)">
            <select value={form.years} onChange={(e) => set('years', Number(e.target.value))}>
              {[10, 15, 20, 25, 30, 35, 40].map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
          </Field>
          <Field label="취득 후 보유 주택 수">
            <input
              type="number"
              min={1}
              max={10}
              step={1}
              value={form.homesAfter}
              onChange={(e) => set('homesAfter', Math.max(1, Math.round(Number(e.target.value))))}
            />
          </Field>
          <Field
            label="공시가격 (만원, 비우면 추정)"
            hint={
              form.publicPrice > 0 ? formatManwon(form.publicPrice) : `추정 ${formatManwon(publicPrice)} (시세 × 69%)`
            }
          >
            <input
              type="number"
              min={0}
              step={1000}
              value={form.publicPrice || ''}
              placeholder="자동 추정"
              onChange={(e) => set('publicPrice', Number(e.target.value))}
            />
          </Field>
        </form>

        <section className={styles.card} aria-label="대출 한도" data-max-loan={loan.maxLoan}>
          <h2 className={styles.cardTitle}>주택담보대출 한도 (추정)</h2>
          <p className={styles.big}>{loan.maxLoan > 0 ? formatManwon(loan.maxLoan) : '대출 불가'}</p>
          <p className={styles.muted}>
            한도를 정한 요인: <strong>{bindingLabel}</strong> · 월 상환액 약{' '}
            {formatManwon(Math.round(loan.monthlyPayment))} (원리금 균등, {form.ratePct}%, {loan.termYears}년) · 필요한
            자기 자금 {formatManwon(loan.ownFunds)} + 세금·부대비용
          </p>
          <div className={styles.bars}>
            <Bar
              label={`LTV ${Math.round(loan.ltv * 100)}%`}
              value={loan.byLtv}
              max={maxBar}
              active={loan.binding === 'ltv'}
            />
            {loan.byPriceCap !== null && (
              <Bar
                label="주택가격별 총액 한도"
                value={loan.byPriceCap}
                max={maxBar}
                active={loan.binding === 'priceCap'}
              />
            )}
            <Bar
              label={`DSR 40% (스트레스 +${loan.stressRatePct}%p)`}
              value={loan.byDsr}
              max={maxBar}
              active={loan.binding === 'dsr'}
            />
          </div>
          {loan.notes.map((n) => (
            <p key={n} className={styles.muted}>
              {n}
            </p>
          ))}
        </section>

        <TaxCard title="취득세 (개략)" result={acquisition} />
        <TaxCard title={`보유세 연간 (개략, 공시가 ${formatManwon(publicPrice)})`} result={holding} />

        <section className={styles.card} aria-label="은행 주담대 금리">
          <h2 className={styles.cardTitle}>은행 주택담보대출 금리 (아파트·분할상환)</h2>
          {!rates && <p className={styles.muted}>금리를 불러오는 중…</p>}
          {rates && 'error' in rates && <p className={styles.muted}>금리를 불러오지 못했습니다: {rates.error}</p>}
          {rates && 'items' in rates && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>은행 · 상품</th>
                    <th>금리 유형</th>
                    <th>전월 평균</th>
                    <th>범위</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rates.items.slice(0, 12).map((r, i) => (
                    <tr key={`${r.bank}-${r.product}-${r.rateType}-${i}`}>
                      <td>
                        {r.bank} · <small>{r.product}</small>
                      </td>
                      <td>{r.rateType}</td>
                      <td>{r.avg !== null ? `${r.avg}%` : '—'}</td>
                      <td>
                        {r.min ?? '—'}~{r.max ?? '—'}%
                      </td>
                      <td>
                        {(r.avg ?? r.min) !== null && (
                          <button
                            type="button"
                            className={styles.small}
                            onClick={() => set('ratePct', (r.avg ?? r.min)!)}
                          >
                            이 금리로
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className={styles.muted}>출처: 금융감독원 금융상품한눈에 ({rates.items[0]?.month ?? ''} 공시)</p>
            </div>
          )}
        </section>

        <section className={styles.card} aria-label="안내">
          <p className={styles.muted}>
            <strong>참고용 추정입니다.</strong> 실제 대출 한도는 금융기관 심사(신용·소득 증빙·담보 평가)로, 세액은 세무
            당국 고지로 정해집니다. 규칙 기준일 {REGULATION_BASIS_DATE} (10·15 대책 반영, 2026-08 종부세 개편안은 국회
            확정 전이라 미반영). 정책대출(디딤돌·보금자리론), 감면·세액공제, 세부담 상한은 넣지 않았습니다.
          </p>
          <ul className={styles.sources}>
            {REGULATION_SOURCES.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {children}
      {hint && <span className={styles.hint}>{hint}</span>}
    </label>
  );
}

function Bar({ label, value, max, active }: { label: string; value: number; max: number; active: boolean }) {
  return (
    <div className={styles.bar} data-active={active}>
      <span className={styles.barLabel}>{label}</span>
      <span className={styles.barTrack}>
        <span className={styles.barFill} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </span>
      <span className={styles.barValue}>{formatManwon(Math.max(0, Math.floor(value / 100) * 100))}</span>
    </div>
  );
}

function TaxCard({ title, result }: { title: string; result: TaxResult }) {
  return (
    <section className={styles.card} aria-label={title}>
      <h2 className={styles.cardTitle}>{title}</h2>
      <table className={styles.table}>
        <tbody>
          {result.lines.map((l) => (
            <tr key={l.label}>
              <td>{l.label}</td>
              <td>{l.rate ?? ''}</td>
              <td>{formatManwon(Math.round(l.amount))}</td>
            </tr>
          ))}
          <tr className={styles.totalRow}>
            <td>합계</td>
            <td />
            <td>{formatManwon(Math.round(result.total))}</td>
          </tr>
        </tbody>
      </table>
      {result.notes.map((n) => (
        <p key={n} className={styles.muted}>
          {n}
        </p>
      ))}
    </section>
  );
}
