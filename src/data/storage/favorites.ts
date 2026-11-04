// 즐겨찾기·최근 검색 목록 규칙 (PLAN.md 단계 B5) — React와 무관한 순수 함수, 단위 테스트한다.
import type { Favorite, LatLng, RecentSearch } from '../../domain/types';
import { isArrayOf, isRecord } from './schema';

export const MAX_RECENT = 10;
export const MAX_FAVORITES = 50;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isOptStr = (v: unknown) => v === undefined || typeof v === 'string';

export const isFavorite = (x: unknown): x is Favorite =>
  isRecord(x) &&
  typeof x.id === 'string' &&
  typeof x.name === 'string' &&
  isNum(x.lat) &&
  isNum(x.lng) &&
  isNum(x.createdAt) &&
  isOptStr(x.address) &&
  isOptStr(x.sampleId);

export const isRecentSearch = (x: unknown): x is RecentSearch =>
  isRecord(x) &&
  typeof x.query === 'string' &&
  typeof x.label === 'string' &&
  isNum(x.lat) &&
  isNum(x.lng) &&
  isNum(x.at) &&
  ['kakao', 'vworld', 'sample'].includes(x.provider as string) &&
  isOptStr(x.sampleId);

export const isFavoriteList = isArrayOf(isFavorite);
export const isRecentList = isArrayOf(isRecentSearch);

/** 같은 장소 판단: 약 10m 이내 (위경도 소수 4자리) */
export function samePlace(a: LatLng, b: LatLng): boolean {
  return Math.abs(a.lat - b.lat) < 1e-4 && Math.abs(a.lng - b.lng) < 1e-4;
}

/** 최근 검색 추가 — 같은 장소는 맨 앞으로 옮기고, 최대 10개 */
export function pushRecent(list: readonly RecentSearch[], entry: RecentSearch): RecentSearch[] {
  return [entry, ...list.filter((r) => !samePlace(r, entry))].slice(0, MAX_RECENT);
}

/** 즐겨찾기 추가 — 같은 장소가 이미 있으면 그대로 둔다 */
export function addFavorite(list: readonly Favorite[], fav: Favorite): { list: Favorite[]; added: boolean } {
  if (list.some((f) => samePlace(f, fav))) return { list: [...list], added: false };
  return { list: [fav, ...list].slice(0, MAX_FAVORITES), added: true };
}

/** 이름 변경 입력 정리: 앞뒤 공백 제거, 40자 제한, 비면 null(변경 취소) */
export function cleanFavoriteName(input: string): string | null {
  const name = input.trim().replace(/\s+/g, ' ').slice(0, 40);
  return name ? name : null;
}

/** 삭제 취소 — 원래 위치에 다시 넣는다 */
export function restoreFavorite(list: readonly Favorite[], fav: Favorite, index: number): Favorite[] {
  if (list.some((f) => f.id === fav.id)) return [...list];
  const next = [...list];
  next.splice(Math.min(index, next.length), 0, fav);
  return next;
}
