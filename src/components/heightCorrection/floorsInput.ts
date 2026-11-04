// 층수 보정 입력 검증 (PLAN.md 단계 B4: 지상층수 1~120 정수)

export const MIN_FLOORS = 1;
export const MAX_FLOORS = 120;

export function parseFloorsInput(input: string): number | null {
  const t = input.trim();
  if (!/^\d{1,3}$/.test(t)) return null;
  const n = Number(t);
  return n >= MIN_FLOORS && n <= MAX_FLOORS ? n : null;
}
