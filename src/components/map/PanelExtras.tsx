// [요구사항: 컴포넌트] 지역·조건 패널의 부가 묶음 — 예산으로 찾기(자기 자금·연소득 → 살 수 있는 최대 가격), 최근 본 단지
// [요구사항: 상태관리] useLocalStorage(최근 본 단지 — 단지 상세가 쓰고 여기서 읽는다)
// [요구사항: 이벤트 처리] onChange(예산 입력·켜기), onClick(최근 본 단지 열기·지우기)
import { Link } from 'react-router-dom';
import { isRecentComplexList, type BudgetSetting, type RecentComplex } from '../../data/storage/complexNotes';
import { STORAGE_KEYS } from '../../data/storage/schema';
import type { BudgetInfo } from '../../domain/finance/budget';
import { formatManwon } from '../../domain/realestate/format';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import styles from './MarketPanel.module.css';

const BINDING_LABEL = { ltv: 'LTV(집값 대비 비율)', priceCap: '주택가격별 총액 한도', dsr: 'DSR(소득 대비 상환액)' };

interface BudgetFinderProps {
  budget: BudgetSetting;
  onBudget: (next: BudgetSetting) => void;
  /** 지역을 아직 모르면 null */
  info: BudgetInfo | null;
}

export function BudgetFinder({ budget, onBudget, info }: BudgetFinderProps) {
  const set = (patch: Partial<BudgetSetting>) => onBudget({ ...budget, ...patch });
  const toNumber = (raw: string, scale: number) => {
    const v = Number(raw);
    return Number.isFinite(v) && v >= 0 ? Math.round(v * scale) : 0;
  };
  return (
    <fieldset className={styles.group}>
      <legend>예산으로 찾기</legend>
      <div className={styles.grid}>
        <label className={styles.label} htmlFor="budget-own">
          자기 자금
        </label>
        <span className={styles.unitInput}>
          <input
            id="budget-own"
            type="number"
            inputMode="decimal"
            min={0}
            step={0.1}
            value={budget.ownFunds / 10_000}
            onChange={(e) => set({ ownFunds: toNumber(e.target.value, 10_000) })}
          />
          억원
        </span>
        <label className={styles.label} htmlFor="budget-income">
          연소득
        </label>
        <span className={styles.unitInput}>
          <input
            id="budget-income"
            type="number"
            inputMode="numeric"
            min={0}
            step={100}
            value={budget.annualIncome}
            onChange={(e) => set({ annualIncome: toNumber(e.target.value, 1) })}
          />
          만원
        </span>
      </div>
      {info === null ? (
        <p className={styles.note}>시·군·구를 고르면 그 지역 대출 규제로 살 수 있는 가격을 계산합니다.</p>
      ) : (
        <>
          <p className={styles.budgetResult} data-budget-cap={info.cap}>
            {info.kind === 'trade' ? (
              <>
                {info.area}에서 살 수 있는 최대 <strong>약 {formatManwon(info.maxPrice)}</strong>
                <small>
                  대출 {formatManwon(info.loan)} · 월 상환 약 {Math.round(info.monthlyPayment).toLocaleString()}만 ·
                  한도를 정한 요인 {BINDING_LABEL[info.binding]}
                </small>
              </>
            ) : (
              <>
                보증금 <strong>{formatManwon(info.cap)}</strong> 이하
                <small>전세·월세는 자기 자금만으로 계산합니다 (전세대출 제외).</small>
              </>
            )}
          </p>
          <label className={styles.check}>
            <input type="checkbox" checked={budget.on} onChange={(e) => set({ on: e.target.checked })} />이 예산 이하만
            지도에 표시
          </label>
        </>
      )}
      <p className={styles.note}>
        무주택 · 금리 4.5% · 30년 원리금 균등 가정이고 취득세 등 부대비용은 뺐습니다. 매매는 건물별 중앙값(㎡당 가격 ×
        면적)으로 견줍니다. 조건을 바꿔 보려면 단지의 대출 계산 탭을 쓰세요.
      </p>
    </fieldset>
  );
}

const NO_RECENT: RecentComplex[] = [];

/** 최근 본 단지 — 누르면 마지막으로 보던 탭으로 */
export function RecentComplexes() {
  const [recent, setRecent] = useLocalStorage(STORAGE_KEYS.recentComplexes, NO_RECENT, {
    version: 1,
    validate: isRecentComplexList,
  });
  if (recent.length === 0) return null;
  return (
    <fieldset className={styles.group}>
      <legend>최근 본 단지 ({recent.length})</legend>
      <ul className={styles.favList}>
        {recent.map((r) => (
          <li key={r.id} className={styles.favRow}>
            <Link to={r.path} className={styles.favItem} title={`${r.name} 다시 열기`}>
              {r.name}
            </Link>
            <button
              type="button"
              className={styles.favRemove}
              onClick={() => setRecent((prev) => prev.filter((e) => e.id !== r.id))}
              aria-label={`최근 본 단지 '${r.name}' 지우기`}
              title="목록에서 지우기"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className={styles.reset} onClick={() => setRecent(NO_RECENT)}>
        모두 지우기
      </button>
    </fieldset>
  );
}
