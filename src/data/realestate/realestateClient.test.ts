import { expect, it } from 'vitest';
import { latestDealMonth } from './realestateClient';

it('실거래 기준 달은 지난달 (KST)', () => {
  expect(latestDealMonth(new Date(Date.UTC(2026, 10, 6)))).toBe('202610');
  expect(latestDealMonth(new Date(Date.UTC(2026, 0, 1, 0, 0)))).toBe('202512');
  // UTC 12월 31일 16시 = KST 1월 1일 → 기준은 12월
  expect(latestDealMonth(new Date(Date.UTC(2026, 11, 31, 16)))).toBe('202612');
});
