// 단지 주소(URL) ↔ 대상 — 주소가 "지금 보고 있는 단지"의 유일한 출처가 된다
//   /complex/sample-seoul-jamsil          샘플 지역
//   /complex/geo-37.51293,127.08146?name=…&addr=…   좌표로 찾은 장소 (검색 결과·지도 클릭)
//   좌표 장소에는 실거래 단지 식별자(seq=11710-6346)와 시군구 코드(lawd=11710)가 붙을 수 있다(지도의 시세 표시에서 연 경우)
// 탭은 /complex/:key/:tab (sun = 일조·조망 기본, price = 시세·실거래, info = 단지 정보)

export type ComplexTarget =
  | { kind: 'sample'; sampleId: string }
  | {
      kind: 'geo';
      lat: number;
      lng: number;
      name: string;
      address?: string;
      /** 실거래 단지 식별자 (예: 11710-6346) */
      aptSeq?: string;
      /** 시군구 코드 5자리 */
      lawd?: string;
    };

export const COMPLEX_TABS = ['sun', 'price', 'info', 'area'] as const;
export type ComplexTab = (typeof COMPLEX_TABS)[number];

const round = (v: number) => Math.round(v * 1e6) / 1e6;

/** 대상 → 경로 (+ 쿼리) */
export function complexPath(target: ComplexTarget, tab: ComplexTab = 'sun'): string {
  if (target.kind === 'sample') return `/complex/sample-${encodeURIComponent(target.sampleId)}/${tab}`;
  const q = new URLSearchParams({ name: target.name });
  if (target.address) q.set('addr', target.address);
  if (target.aptSeq) q.set('seq', target.aptSeq);
  if (target.lawd) q.set('lawd', target.lawd);
  return `/complex/geo-${round(target.lat)},${round(target.lng)}/${tab}?${q.toString()}`;
}

/** 경로의 :key와 쿼리 → 대상 (형식이 틀리면 null) */
export function parseComplexKey(key: string | undefined, search: URLSearchParams): ComplexTarget | null {
  if (!key) return null;
  if (key.startsWith('sample-')) {
    const sampleId = decodeURIComponent(key.slice('sample-'.length));
    return /^[a-z0-9-]{1,60}$/.test(sampleId) ? { kind: 'sample', sampleId } : null;
  }
  const m = /^geo-(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)$/.exec(key);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  // 대한민국 범위 대략 (위도 33~39, 경도 124~132)
  if (lat < 32 || lat > 40 || lng < 123 || lng > 133) return null;
  const name = (search.get('name') ?? '').trim().slice(0, 80) || '선택한 위치';
  const address = search.get('addr')?.trim().slice(0, 120);
  const aptSeq = search.get('seq') ?? '';
  const lawd = search.get('lawd') ?? '';
  return {
    kind: 'geo',
    lat,
    lng,
    name,
    ...(address ? { address } : {}),
    ...(/^\d{5}-\d{1,7}$/.test(aptSeq) ? { aptSeq } : {}),
    ...(/^\d{5}$/.test(lawd) ? { lawd } : {}),
  };
}

/** 같은 대상인지 (주소가 바뀌어도 같은 장소면 다시 불러오지 않게) */
export function sameTarget(a: ComplexTarget | null, b: ComplexTarget | null): boolean {
  if (!a || !b) return a === b;
  if (a.kind === 'sample' || b.kind === 'sample')
    return a.kind === b.kind && (a as { sampleId: string }).sampleId === (b as { sampleId: string }).sampleId;
  return round(a.lat) === round(b.lat) && round(a.lng) === round(b.lng);
}

export function isComplexTab(tab: string | undefined): tab is ComplexTab {
  return (COMPLEX_TABS as readonly string[]).includes(tab ?? '');
}
