// 동·호수 입력 해석 (PLAN.md 단계 B1)
// "101동 1203호", "101-1203", "101 1203", "A동 302호", "101동"(동만) 을 허용한다.
// 동과 호 사이에는 "동", "-", 공백 중 하나가 꼭 있어야 한다 — "1011203"처럼 붙여 쓰면 어디서 나눌지 알 수 없다.

export type ParsedDongHo = { ok: true; dong: string; ho: string | null } | { ok: false; reason: 'EMPTY' | 'FORMAT' };

const DONG = String.raw`제?\s*(\d{1,4}|[A-Za-z])`;
const DONG_HO = new RegExp(String.raw`^${DONG}\s*(?:동\s*[-\s]?|[-\s])\s*(\d{3,5})\s*호?$`);
const DONG_ONLY = new RegExp(String.raw`^${DONG}\s*동$`);

/** 동 번호 표기 통일: 숫자는 앞의 0 제거("0101" → "101"), 영문은 대문자 (데이터 추출 규칙 extractDongNumber와 같게) */
export function normalizeDong(dong: string): string {
  return /^\d+$/.test(dong) ? String(Number(dong)) : dong.toUpperCase();
}

export function parseDongHo(input: string): ParsedDongHo {
  // 전각 숫자·하이픈(모바일 키보드)도 받아 준다
  const text = input
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[－–—]/g, '-')
    .trim();
  if (!text) return { ok: false, reason: 'EMPTY' };

  const full = DONG_HO.exec(text);
  if (full) return { ok: true, dong: normalizeDong(full[1]!), ho: full[2]! };
  const only = DONG_ONLY.exec(text);
  if (only) return { ok: true, dong: normalizeDong(only[1]!), ho: null };
  return { ok: false, reason: 'FORMAT' };
}

/** 동 번호 지정 입력 검증: 1~4자리 숫자 또는 영문 한 글자 ("동"은 붙여도 된다) */
export function parseDongInput(input: string): string | null {
  const m = /^\s*제?\s*(\d{1,4}|[A-Za-z])\s*동?\s*$/.exec(input);
  if (!m) return null;
  const dong = normalizeDong(m[1]!);
  return dong === '0' ? null : dong;
}
