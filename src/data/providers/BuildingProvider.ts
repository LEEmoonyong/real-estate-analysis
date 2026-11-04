// 건물 데이터 소스 추상화 (PLAN.md 6.3)
import type { BuildingSource, LatLng, RawBuilding } from '../../domain/types';
import { getJson } from '../apiClient';
import { normalizeOsm, type OverpassElement } from '../normalize/osm';
import { normalizeVworld } from '../normalize/vworld';

export interface BuildingProvider {
  readonly id: Exclude<BuildingSource, 'sample'>;
  readonly label: string;
  fetch(center: LatLng, radiusM: number, signal: AbortSignal): Promise<RawBuilding[]>;
}

const query = (c: LatLng, r: number) => `lat=${c.lat.toFixed(6)}&lng=${c.lng.toFixed(6)}&r=${Math.round(r)}`;

export const vworldProvider: BuildingProvider = {
  id: 'vworld',
  label: 'V-World(국토교통부)',
  async fetch(center, radiusM, signal) {
    const body = await getJson<{ features: unknown[] }>(`/api/buildings/vworld?${query(center, radiusM)}`, signal);
    return normalizeVworld(body.features).buildings;
  },
};

export const osmProvider: BuildingProvider = {
  id: 'osm',
  label: 'OpenStreetMap',
  async fetch(center, radiusM, signal) {
    const body = await getJson<{ elements: OverpassElement[] }>(`/api/buildings/osm?${query(center, radiusM)}`, signal);
    return normalizeOsm(body.elements).buildings;
  },
};

export const SOURCE_LABELS: Record<BuildingSource, string> = {
  vworld: 'V-World(국토교통부)',
  osm: 'OpenStreetMap',
  sample: '샘플 데이터',
};
