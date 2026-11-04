import { describe, expect, it } from 'vitest';
import { nearestSnap } from './bottomSheetSnap';

describe('nearestSnap', () => {
  it.each([
    [0.05, 'peek'],
    [0.3, 'peek'],
    [0.35, 'half'],
    [0.69, 'half'],
    [0.71, 'full'],
    [0.99, 'full'],
  ])('높이 비율 %o → %o', (ratio, expected) => expect(nearestSnap(ratio)).toBe(expected));
});
