// V-World LT_C_BLDGINFO GeoJSON 피처 → RawBuilding 정규화
// 응답 형식은 1일차 실측으로 확정 (docs/api-verification.md):
//   id "LT_C_BLDGINFO.<숫자>", geometry 전부 MultiPolygon [경도, 위도], 숫자 속성도 문자열, 빈 값 ""
// [요구사항: 데이터 처리] 외부 API 응답 검증·정규화 후 도메인 모델로 변환
import type { RawBuilding } from '../../domain/types';
import { isRecord } from '../storage/schema';
import { approxAreaM2, cleanLngLatRing, extractDongNumber, parsePositive, resolveHeight } from './common';
import type { NormalizeReport } from './osm';

/** 건축물대장 주용도 코드 중 공동주택 */
const APARTMENT_USABILITY = '02000';

type Position = [number, number];

function outerRings(geometry: unknown): Position[][] {
  if (!isRecord(geometry) || !Array.isArray(geometry.coordinates)) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates[0] as Position[]];
  if (geometry.type === 'MultiPolygon') return (geometry.coordinates as Position[][][]).map((poly) => poly[0] ?? []);
  return [];
}

/** 여러 조각이면 가장 큰 외곽선 하나를 쓴다 (실측상 다중 조각 피처는 드묾) */
function largestRing(rings: Position[][]): [number, number][] | null {
  let best: [number, number][] | null = null;
  let bestArea = 0;
  for (const raw of rings) {
    if (!Array.isArray(raw)) continue;
    const ring = cleanLngLatRing(raw);
    if (!ring) continue;
    const area = approxAreaM2(ring);
    if (area > bestArea) {
      best = ring;
      bestArea = area;
    }
  }
  return best;
}

export function normalizeVworld(features: unknown[]): { buildings: RawBuilding[]; report: NormalizeReport } {
  const report: NormalizeReport = { total: features.length, kept: 0, skippedInvalidGeometry: 0, skippedExcludedType: 0 };
  const buildings: RawBuilding[] = [];

  features.forEach((feature, index) => {
    if (!isRecord(feature)) {
      report.skippedInvalidGeometry++;
      return;
    }
    const footprint = largestRing(outerRings(feature.geometry));
    if (!footprint) {
      report.skippedInvalidGeometry++;
      return;
    }
    const props = isRecord(feature.properties) ? feature.properties : {};
    const rawId = typeof feature.id === 'string' ? feature.id.replace(/^LT_C_BLDGINFO\./, '') : `idx${index}`;
    const floors = parsePositive(props.grnd_flr);
    const usability = typeof props.usability === 'string' ? props.usability : '';
    const name = [props.bld_nm, props.dong_nm].filter((v): v is string => typeof v === 'string' && v.trim() !== '').join(' ');
    const dong = extractDongNumber(typeof props.dong_nm === 'string' ? props.dong_nm : null);

    buildings.push({
      id: `vworld:${rawId}`,
      source: 'vworld',
      footprint,
      ...resolveHeight(floors === null ? null : Math.round(floors), parsePositive(props.height), approxAreaM2(footprint)),
      ...(dong ? { dongNumber: dong } : {}),
      ...(name ? { name } : {}),
      ...(usability ? { usage: usability === APARTMENT_USABILITY ? 'apartments' : usability } : {}),
    });
    report.kept++;
  });
  return { buildings, report };
}
