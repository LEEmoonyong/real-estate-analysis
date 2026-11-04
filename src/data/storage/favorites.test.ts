import { describe, expect, it } from 'vitest';
import type { Favorite, RecentSearch } from '../../domain/types';
import {
  MAX_RECENT,
  addFavorite,
  cleanFavoriteName,
  isFavoriteList,
  isRecentList,
  pushRecent,
  restoreFavorite,
} from './favorites';

const recent = (n: number, lat = 37 + n * 0.01): RecentSearch => ({
  query: `q${n}`,
  label: `장소${n}`,
  lat,
  lng: 127,
  provider: 'kakao',
  at: n,
});
const fav = (id: string, lat: number): Favorite => ({ id, name: id, lat, lng: 127, createdAt: 0 });

describe('pushRecent', () => {
  it('맨 앞에 추가하고 최대 10개', () => {
    let list: RecentSearch[] = [];
    for (let n = 0; n < 15; n++) list = pushRecent(list, recent(n));
    expect(list).toHaveLength(MAX_RECENT);
    expect(list[0]!.query).toBe('q14');
    expect(list.at(-1)!.query).toBe('q5');
  });

  it('같은 장소를 다시 검색하면 중복 없이 맨 앞으로', () => {
    const list = pushRecent([recent(1), recent(2)], { ...recent(9), lat: recent(2).lat + 0.00001 });
    expect(list.map((r) => r.query)).toEqual(['q9', 'q1']);
  });
});

describe('즐겨찾기', () => {
  it('같은 장소는 다시 추가하지 않는다', () => {
    const a = addFavorite([], fav('a', 37.1));
    expect(a.added).toBe(true);
    const b = addFavorite(a.list, fav('b', 37.10001));
    expect(b.added).toBe(false);
    expect(b.list).toHaveLength(1);
  });

  it('삭제 취소는 원래 위치로', () => {
    const list = [fav('a', 1), fav('c', 3)];
    expect(restoreFavorite(list, fav('b', 2), 1).map((f) => f.id)).toEqual(['a', 'b', 'c']);
    expect(restoreFavorite(list, fav('a', 1), 0)).toHaveLength(2); // 이미 있으면 그대로
  });

  it('이름 정리: 공백 정리, 40자 제한, 빈 값은 취소', () => {
    expect(cleanFavoriteName('  우리   집 ')).toBe('우리 집');
    expect(cleanFavoriteName('가'.repeat(50))).toHaveLength(40);
    expect(cleanFavoriteName('   ')).toBeNull();
  });
});

describe('저장 형식 검증', () => {
  it('올바른 목록만 통과', () => {
    expect(isFavoriteList([fav('a', 1), { ...fav('b', 2), sampleId: 'seoul-jamsil' }])).toBe(true);
    expect(isFavoriteList([{ id: 'x', name: 'x', lat: '37', lng: 127, createdAt: 0 }])).toBe(false);
    expect(isRecentList([recent(1)])).toBe(true);
    expect(isRecentList([{ ...recent(1), provider: 'google' }])).toBe(false);
  });
});
