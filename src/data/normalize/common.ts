// 데이터 소스 공통 정규화 유틸 (V-World·OSM·샘플 생성 스크립트 공용, React 비의존)
import { DEFAULT_FLOORS, SMALL_STRUCTURE_AREA_M2 } from '../../config/constants';
import type { RawBuilding } from '../../domain/types';

type Ring = [number, number][];

/** 소수 6자리(약 0.1m) 반올림 — 샘플 파일 크기 절감과 외곽선 해시 안정화 */
export const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

/** 닫힘 정점·연속 중복 정점 제거 + 좌표 반올림. 정점이 3개 미만이면 null */
export function cleanLngLatRing(ring: Ring): Ring | null {
  const out: Ring = [];
  for (const [lng, lat] of ring) {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    const p: [number, number] = [round6(lng), round6(lat)];
    const prev = out[out.length - 1];
    if (!prev || prev[0] !== p[0] || prev[1] !== p[1]) out.push(p);
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (out.length > 1 && first && last && first[0] === last[0] && first[1] === last[1]) out.pop();
  return out.length >= 3 ? out : null;
}

/**
 * 경위도 링의 대략적 면적 [m²] (등장방형 근사, 신발끈 공식).
 * 반경 500m 이내 건물 하나 수준에서는 오차가 무시할 만하다. 정밀 변환은 domain/geo(3일차).
 */
export function approxAreaM2(ring: Ring): number {
  const first = ring[0];
  if (!first) return 0;
  const k = 111_320;
  const cos = Math.cos((first[1] * Math.PI) / 180);
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[(i + 1) % ring.length]!;
    sum += x1 * k * cos * (y2 * k) - x2 * k * cos * (y1 * k);
  }
  return Math.abs(sum / 2);
}

/** 숫자처럼 보이는 문자열 → 양수, 아니면 null ("45 m", "18.4", "" 처리) */
export function parsePositive(value: unknown): number | null {
  if (typeof value === 'number') return value > 0 && Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const m = /^\s*(\d+(?:\.\d+)?)\s*(m|미터)?\s*$/i.exec(value);
  if (!m) return null;
  const n = Number(m[1]);
  return n > 0 ? n : null;
}

/**
 * 동 이름에서 동 번호 추출. 숫자 동("101동", "101")과 알파벳 동("A동", "b")만 인정한다.
 * "주동3", "상가동", "Tower1", 단지명 등은 null → 사용자가 직접 지정 (V-World 실측: docs/api-verification.md)
 */
export function extractDongNumber(text: string | undefined | null): string | null {
  if (!text) return null;
  const t = text.trim();
  const numeric = /^제?\s*(\d{1,4})\s*동?$/.exec(t);
  if (numeric) return String(Number(numeric[1]));
  const alpha = /^([A-Za-z])\s*동?$/.exec(t);
  if (alpha) return alpha[1]!.toUpperCase();
  return null;
}

/**
 * 층수·높이가 모두 없을 때의 추정 규칙 (1일차 실측 근거):
 * 작은 외곽선(< 50m²)은 경비실·창고 같은 부속 건물이므로 1층, 그 밖에는 기본 층수.
 */
export function estimateFloors(areaM2: number, fallbackFloors = DEFAULT_FLOORS): number {
  return areaM2 < SMALL_STRUCTURE_AREA_M2 ? 1 : fallbackFloors;
}

/** 층수·높이 정보로 RawBuilding의 높이 관련 필드를 결정한다 */
export function resolveHeight(
  floors: number | null,
  heightM: number | null,
  areaM2: number,
  fallbackFloors?: number,
): Pick<RawBuilding, 'floors' | 'heightM' | 'heightSource'> {
  if (heightM !== null) {
    return { floors: floors ?? Math.max(1, Math.round(heightM / 2.9)), heightM, heightSource: 'measured' };
  }
  if (floors !== null) return { floors, heightM: null, heightSource: 'floors' };
  return { floors: estimateFloors(areaM2, fallbackFloors), heightM: null, heightSource: 'default' };
}
