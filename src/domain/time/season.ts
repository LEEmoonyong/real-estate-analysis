// 계절 타임랩스 (PLAN.md 9.12) — 대표일(매월 21일)과 계산 순서, 월별 요약 통계

/** m: 0~11 → 'YYYY-MM-21' */
export function monthDate(year: number, m: number): string {
  return `${String(year).padStart(4, '0')}-${String(m + 1).padStart(2, '0')}-21`;
}

/** 날짜가 대표일이면 월 인덱스(0~11), 아니면 −1 */
export function representativeMonth(date: string): number {
  return date.slice(8) === '21' ? Number(date.slice(5, 7)) - 1 : -1;
}

/**
 * 계산 순서: 지금 보고 있는 달부터(사용자가 먼저 볼 가능성이 큼) → 동지 달(12월) → 나머지는 가까운 달 순.
 */
export function monthComputeOrder(currentMonth: number): number[] {
  const order = [currentMonth];
  if (currentMonth !== 11) order.push(11);
  for (let d = 1; d <= 6; d++) {
    for (const m of [(currentMonth + d) % 12, (currentMonth - d + 12) % 12]) {
      if (!order.includes(m)) order.push(m);
    }
  }
  return order;
}

export interface MonthStats {
  /** 주향 세대 평균 [분] */
  mean: number;
  /** 주향 세대 하위 10% 값 [분] */
  p10: number;
}

/** 주향(호수 대상) 세대 값의 평균과 하위 10% */
export function mainFaceStats(values: ArrayLike<number>, isMainFace: Uint8Array): MonthStats {
  const picked: number[] = [];
  for (let i = 0; i < isMainFace.length; i++) if (isMainFace[i] === 1) picked.push(values[i]!);
  if (picked.length === 0) return { mean: 0, p10: 0 };
  picked.sort((a, b) => a - b);
  const mean = picked.reduce((s, v) => s + v, 0) / picked.length;
  return { mean, p10: picked[Math.floor(picked.length * 0.1)]! };
}
