// OSM Overpass 응답(out tags geom) → RawBuilding 정규화
// [요구사항: 데이터 처리] 외부 API 응답 검증·정규화 후 도메인 모델로 변환
import type { RawBuilding } from '../../domain/types';
import { approxAreaM2, cleanLngLatRing, extractDongNumber, parsePositive, resolveHeight } from './common';

interface OverpassPoint {
  lat: number;
  lon: number;
}
interface OverpassMember {
  type: string;
  role: string;
  geometry?: OverpassPoint[];
}
export interface OverpassElement {
  type: 'way' | 'relation' | string;
  id: number;
  tags?: Record<string, string>;
  geometry?: OverpassPoint[];
  members?: OverpassMember[];
}

/** 그림자를 만들지 않거나 3D 프리즘으로 부적절한 building 값 */
const EXCLUDED_BUILDING_VALUES = new Set(['roof', 'carport', 'construction', 'ruins', 'no']);

export interface NormalizeReport {
  total: number;
  kept: number;
  skippedInvalidGeometry: number;
  skippedExcludedType: number;
}

export interface OsmNormalizeOptions {
  /** 층수·높이가 없는 공동주택에 쓸 층수 (샘플: 같은 지역 태그된 아파트 층수의 중앙값) */
  apartmentFallbackFloors?: number;
}

function outerRing(el: OverpassElement): [number, number][] | null {
  const pts =
    el.type === 'way'
      ? el.geometry
      : // multipolygon relation: 첫 번째 닫힌 outer 멤버만 사용 (구멍·다중 조각은 PLAN.md 9.3대로 무시)
        el.members?.find((m) => m.role === 'outer' && m.geometry && m.geometry.length >= 4)?.geometry;
  if (!pts) return null;
  return cleanLngLatRing(pts.map((p) => [p.lon, p.lat]));
}

export function normalizeOsm(
  elements: OverpassElement[],
  options: OsmNormalizeOptions = {},
): { buildings: RawBuilding[]; report: NormalizeReport } {
  const report: NormalizeReport = {
    total: elements.length,
    kept: 0,
    skippedInvalidGeometry: 0,
    skippedExcludedType: 0,
  };
  const buildings: RawBuilding[] = [];

  for (const el of elements) {
    const tags = el.tags ?? {};
    const buildingTag = tags.building;
    if (!buildingTag || EXCLUDED_BUILDING_VALUES.has(buildingTag)) {
      report.skippedExcludedType++;
      continue;
    }
    const footprint = outerRing(el);
    if (!footprint) {
      report.skippedInvalidGeometry++;
      continue;
    }

    const isApartment = buildingTag === 'apartments';
    const floors = parsePositive(tags['building:levels']);
    const heightM = parsePositive(tags.height);
    const height = resolveHeight(
      floors === null ? null : Math.round(floors),
      heightM,
      approxAreaM2(footprint),
      isApartment ? options.apartmentFallbackFloors : undefined,
    );
    const dong = extractDongNumber(tags.name) ?? extractDongNumber(tags['addr:housenumber']);

    buildings.push({
      id: `osm:${el.type}/${el.id}`,
      source: 'osm',
      footprint,
      ...height,
      ...(dong ? { dongNumber: dong } : {}),
      ...(tags.name ? { name: tags.name } : {}),
      usage: buildingTag,
    });
    report.kept++;
  }
  return { buildings, report };
}
