// 추정 호수 규칙 (PLAN.md 9.4)
// 호수 = 층 × 100 + 라인 (라인이 100개 이상이면 층 × 1000 + 라인). 라인은 주향 면을 바깥에서 볼 때 왼쪽부터 1, 2, 3…
// 실제 호수 체계는 단지마다 달라 화면에는 "추정 호수"로 표시한다.

/** 라인 수에 따른 호수 자리 배수 */
export function hoMultiplier(lineCount: number): number {
  return lineCount >= 100 ? 1000 : 100;
}

/** (층, 라인) → 호수 문자열. 라인은 1부터 */
export function formatHo(floor: number, line: number, lineCount: number): string {
  return String(floor * hoMultiplier(lineCount) + line);
}

/** 호수 문자열 → (층, 라인). 형식이 맞지 않거나 라인이 범위를 벗어나면 null */
export function parseHo(ho: string, lineCount: number): { floor: number; line: number } | null {
  if (!/^\d{3,6}$/.test(ho)) return null;
  const value = Number(ho);
  const m = hoMultiplier(lineCount);
  const floor = Math.floor(value / m);
  const line = value % m;
  if (floor < 1 || line < 1 || line > lineCount) return null;
  return { floor, line };
}
