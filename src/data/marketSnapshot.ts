// 샘플 시세 스냅샷 (확장 X7) — 키도 배포 서버도 없을 때(샘플 모드) 샘플 3곳의 시세·단지 정보·학군·금리를 보여 주는 저장 자료
// public/samples/market-snapshot.json = { capturedAt, baseMonth, responses: { "/api/...": 응답 } }
// scripts/capture-market-snapshot.mjs가 실데이터 서버에서 같은 주소로 받아 만든다(세대·거래는 샘플 주변 단지만 남김).
import { isRecord } from './storage/schema';

export interface MarketSnapshot {
  /** 받은 날짜 YYYY-MM-DD */
  capturedAt: string;
  /** 그때의 "가장 최근 거래 달" YYYYMM — 샘플 모드에서는 이 달을 기준으로 주소를 만든다 */
  baseMonth: string;
  responses: Record<string, unknown>;
}

let snapshot: MarketSnapshot | null = null;
let pending: Promise<MarketSnapshot | null> | null = null;

const isSnapshot = (x: unknown): x is MarketSnapshot =>
  isRecord(x) &&
  typeof x.capturedAt === 'string' &&
  typeof x.baseMonth === 'string' &&
  /^\d{6}$/.test(x.baseMonth) &&
  isRecord(x.responses);

export function loadMarketSnapshot(): Promise<MarketSnapshot | null> {
  pending ??= fetch(`${import.meta.env.BASE_URL}samples/market-snapshot.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((body: unknown) => {
      snapshot = isSnapshot(body) ? body : null;
      return snapshot;
    })
    .catch(() => null);
  return pending;
}

/** 샘플 모드에서 쓰는 기준 달 (스냅샷을 불러온 뒤에만 값이 있다) */
export function snapshotBaseMonth(): string | null {
  return snapshot?.baseMonth ?? null;
}

export function snapshotCapturedAt(): string | null {
  return snapshot?.capturedAt ?? null;
}

/** 주소에 맞는 저장 응답 (없으면 undefined) */
export async function snapshotResponse(url: string): Promise<unknown> {
  const s = await loadMarketSnapshot();
  return s?.responses[url];
}
