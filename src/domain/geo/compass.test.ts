import { expect, it } from 'vitest';
import { compass8 } from './compass';

it.each([
  [0, '북'],
  [22, '북'],
  [23, '북동'],
  [158, '남'],
  [180, '남'],
  [202, '남'],
  [203, '남서'],
  [359, '북'],
  [-90, '서'],
])('%d° → %s', (deg, name) => {
  expect(compass8(deg)).toBe(name);
});
