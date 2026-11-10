// 최근 본 단지 · 단지 메모 · 예산 입력 (localStorage) — 순수 함수(검증·추가)는 단위 테스트한다.
import { isArrayOf, isRecord, isRecordOf } from './schema';

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

// ---- 최근 본 단지 --------------------------------------------------------------

export const MAX_RECENT_COMPLEXES = 10;

export interface RecentComplex {
  /** 같은 단지인지 가리는 값 (좌표) */
  id: string;
  name: string;
  /** 마지막으로 본 화면 주소 (/complex/geo-…/price?name=…) */
  path: string;
  /** 본 시각 (ms) */
  at: number;
}

export const isRecentComplex = (x: unknown): x is RecentComplex =>
  isRecord(x) &&
  typeof x.id === 'string' &&
  typeof x.name === 'string' &&
  typeof x.path === 'string' &&
  x.path.startsWith('/complex/') &&
  isNum(x.at);

export const isRecentComplexList = isArrayOf(isRecentComplex);

/** 맨 앞에 넣고(같은 단지는 하나만) 최대 10곳 */
export function addRecentComplex(list: readonly RecentComplex[], entry: RecentComplex): RecentComplex[] {
  return [entry, ...list.filter((e) => e.id !== entry.id)].slice(0, MAX_RECENT_COMPLEXES);
}

// ---- 단지 메모 ----------------------------------------------------------------

export const MEMO_MAX_LENGTH = 300;

export interface ComplexMemo {
  text: string;
  /** 고친 시각 (ms) */
  at: number;
}

export const isComplexMemo = (x: unknown): x is ComplexMemo => isRecord(x) && typeof x.text === 'string' && isNum(x.at);

/** 단지 식별자(실거래 단지 번호) → 메모 */
export const isMemoMap = isRecordOf(isComplexMemo);

/** 메모를 넣거나 고친다. 빈 글이면 지운다 (원본은 그대로) */
export function setMemo(
  memos: Readonly<Record<string, ComplexMemo>>,
  id: string,
  text: string,
  now: number,
): Record<string, ComplexMemo> {
  const next = { ...memos };
  const trimmed = text.trim().slice(0, MEMO_MAX_LENGTH);
  if (trimmed) next[id] = { text: trimmed, at: now };
  else delete next[id];
  return next;
}

// ---- 예산 입력 ----------------------------------------------------------------

export interface BudgetSetting {
  /** 자기 자금 [만원] */
  ownFunds: number;
  /** 연소득 [만원] */
  annualIncome: number;
  /** 지도에서 이 예산 이하만 보기 */
  on: boolean;
}

export const DEFAULT_BUDGET: BudgetSetting = { ownFunds: 30_000, annualIncome: 6_000, on: false };

export const isBudgetSetting = (x: unknown): x is BudgetSetting =>
  isRecord(x) &&
  isNum(x.ownFunds) &&
  x.ownFunds >= 0 &&
  isNum(x.annualIncome) &&
  x.annualIncome >= 0 &&
  typeof x.on === 'boolean';
