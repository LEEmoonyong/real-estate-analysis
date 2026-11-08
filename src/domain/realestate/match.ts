// 실거래 단지(aptSeq) ↔ 공동주택 단지 목록(kaptCode) 매칭
// 두 데이터는 단지 식별 체계가 달라 직접 연결할 열쇠가 없다. 2026-11 송파구 실측: 이름 완전 일치 55/183곳뿐
// ("리센츠" ↔ "잠실리센츠", "장미1" ↔ "신천장미1차2차", "주공아파트 5단지" ↔ "잠실주공5단지").
// 1) 같은 법정동 + 같은 지번(본번-부번)이면 확정
// 2) 아니면 이름 유사도: 지역명 접두어·"아파트"·괄호·차/단지 표기를 지우고, 숫자가 같을 때만 비교

export interface ComplexRef {
  kaptCode: string;
  name: string;
  /** 법정동 이름 (예: 잠실동) */
  dong: string;
  /** 대표 지번 '187-10' (단지 기본정보 주소에서 추출, 없으면 '') */
  jibun: string;
  /** 시군구 이름 (예: 송파구) — 접두어 제거용 */
  sigungu?: string;
}

export interface TradeRef {
  aptName: string;
  umdName: string;
  jibun: string;
}

const ROMAN: Record<string, string> = { Ⅰ: '1', Ⅱ: '2', Ⅲ: '3', Ⅳ: '4', Ⅴ: '5' };

/** 지번 표기 통일: '0127-0001' → '127-1', '127' → '127' */
export function normalizeJibun(j: string): string {
  const m = /^(산)?\s*0*(\d+)(?:-0*(\d+))?$/.exec(j.trim());
  if (!m) return j.trim();
  return `${m[1] ?? ''}${m[2]}${m[3] && m[3] !== '0' ? `-${m[3]}` : ''}`;
}

/** 지번 주소에서 법정동 뒤 지번 추출: '서울특별시 송파구 잠실동 187-10 잠실 센트럴파크' → '187-10' */
export function jibunFromAddress(address: string, dong: string): string {
  if (!dong) return '';
  const i = address.indexOf(dong);
  if (i < 0) return '';
  const m = /^\s*(산?\s*\d+(?:-\d+)?)/.exec(address.slice(i + dong.length));
  return m ? normalizeJibun(m[1]!.replace(/\s/g, '')) : '';
}

/**
 * 비교용 이름: 괄호 내용·"아파트"·공백·기호 제거, 로마 숫자 → 아라비아, 지역명 접두어 제거,
 * "N차"·"N단지"·"제N" 표기를 숫자만 남기도록.
 */
export function canonicalName(name: string, places: readonly string[] = []): string {
  // 괄호 안이 차수·단지 번호면 살리고(현대(6차) → 현대6차), 그 밖(지번·동 번호 등)은 지운다
  let s = name
    .replace(/\(([^)]*)\)/g, (_, inner: string) => (/^\d+(차|단지)?$/.test(inner.trim()) ? inner : ''))
    .replace(/[ⅠⅡⅢⅣⅤ]/g, (c) => ROMAN[c] ?? c);
  s = s.replace(/아파트|APT/gi, '').replace(/[\s·\-_,.'"]/g, '');
  for (const p of places) {
    const stem = p.replace(/(특별시|광역시|특별자치시|특별자치도|도|시|군|구|동|읍|면|가)$/, '');
    if (stem.length >= 2 && s.startsWith(stem) && s.length > stem.length + 1) s = s.slice(stem.length);
    if (p.length >= 2 && s.startsWith(p) && s.length > p.length + 1) s = s.slice(p.length);
  }
  s = s.replace(/제(\d)/g, '$1').replace(/(\d+)(차|단지)/g, '$1');
  return s.toLowerCase();
}

const digits = (s: string) => (s.match(/\d+/g) ?? []).join(',');

/** 단지를 가리키지 않는 옛 공공 분양 이름 — 단지 목록에서 자주 빠진다 */
const GENERIC_PREFIX = /^(주공|시영)/;

/** 글자 2-gram 다이스 계수 0~1 */
export function bigramSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const grams = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) m.set(s.slice(i, i + 2), (m.get(s.slice(i, i + 2)) ?? 0) + 1);
    return m;
  };
  const ga = grams(a);
  const gb = grams(b);
  let common = 0;
  for (const [g, n] of ga) common += Math.min(n, gb.get(g) ?? 0);
  return (2 * common) / (a.length - 1 + (b.length - 1));
}

/** 이름 점수 0~1 (숫자가 다르면 0 — "장미1"과 "장미2"는 다른 단지) */
export function nameScore(trade: TradeRef, complex: ComplexRef): number {
  const places = [trade.umdName, complex.dong, complex.sigungu ?? ''];
  const a = canonicalName(trade.aptName, places);
  const b = canonicalName(complex.name, places);
  if (!a || !b) return 0;
  const da = digits(a);
  const db = digits(b);
  if (da && db && !db.split(',').some((d) => da.split(',').includes(d))) return 0;
  if (a === b) return 1;
  // "주공"·"시영"(옛 공공 분양 이름)만 다르고 번호가 같으면 같은 단지
  // (2026-11 실측: 실거래 "주공아파트 5단지" ↔ 단지 목록 "잠실5단지아파트" — 지역명을 지우면 "주공5" ↔ "5")
  const bare = (s: string) => s.replace(GENERIC_PREFIX, '');
  if (da && bare(a) === bare(b)) return 0.95;
  // 한쪽이 다른 쪽을 포함하면 높은 점수 — 단 길이 차이가 크면(한신 ⊂ 한신잠실코아) 다른 단지일 가능성이 커 제외
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length >= 2 && long.includes(short) && short.length / long.length >= 0.5) return 0.9;
  return bigramSimilarity(a, b);
}

export interface MatchResult {
  kaptCode: string;
  method: 'jibun' | 'name';
  score: number;
}

/** 거래 단지 하나에 맞는 단지 목록 항목 (없으면 null) */
export function matchComplex(trade: TradeRef, complexes: readonly ComplexRef[], minScore = 0.6): MatchResult | null {
  const jibun = normalizeJibun(trade.jibun);
  const sameDong = complexes.filter((c) => c.dong === trade.umdName);
  const byJibun = sameDong.filter((c) => c.jibun && c.jibun === jibun);
  if (byJibun.length === 1) return { kaptCode: byJibun[0]!.kaptCode, method: 'jibun', score: 1 };
  // 같은 지번에 단지가 여럿이거나 지번이 다르면 이름으로 (같은 동 우선, 없으면 시군구 전체)
  const pool = byJibun.length > 1 ? byJibun : sameDong.length ? sameDong : complexes;
  let best: MatchResult | null = null;
  for (const c of pool) {
    const score = nameScore(trade, c) + (c.dong === trade.umdName ? 0.05 : 0);
    if (score >= minScore && (!best || score > best.score)) best = { kaptCode: c.kaptCode, method: 'name', score };
  }
  if (!best && pool !== complexes && sameDong.length) {
    // 법정동 표기가 다른 경우(신천동 ↔ 잠실동 등) 시군구 전체에서 한 번 더
    for (const c of complexes) {
      const score = nameScore(trade, c);
      if (score >= Math.max(minScore, 0.85) && (!best || score > best.score))
        best = { kaptCode: c.kaptCode, method: 'name', score };
    }
  }
  return best;
}

/**
 * 검색 이름과 맞는 주변 거래 단지 (확장 X7) — 큰 단지는 검색 좌표(정문·상가 주소)와 실거래 좌표(대표 지번)가
 * 수백 m 떨어질 수 있어, 거리만으로는 못 찾는다. 이름 점수 0.8 이상 중 가장 높은(같으면 가까운) 단지.
 */
export function bestNamedNearby<T extends { aptName: string; umdName: string; distanceM: number }>(
  searchName: string,
  near: readonly T[],
  sigungu = '',
): T | null {
  let best: T | null = null;
  let bestScore = 0.8;
  for (const c of near) {
    const score = nameScore(
      { aptName: searchName, umdName: c.umdName, jibun: '' },
      { kaptCode: '', name: c.aptName, dong: c.umdName, jibun: '', sigungu },
    );
    if (score > bestScore || (best && score === bestScore && c.distanceM < best.distanceM)) {
      best = c;
      bestScore = score;
    }
  }
  return best;
}
