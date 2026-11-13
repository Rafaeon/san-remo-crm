import { describe, expect, it } from 'vitest';
import { easeOutCubic, landingRotation, segmentCenterAngle } from '@/lib/roulette';
describe('Roulette math', () => {
  it('centers each segment under the pointer after landing', () => {
    for (const count of [2, 3, 5, 7, 12]) {
      for (let index = 0; index < count; index++) {
        const rotation = landingRotation(0, index, count);
        expect((rotation + segmentCenterAngle(index, count)) % 360).toBeCloseTo(0, 6);
      }
    }
  });
  it('keeps spinning at least the requested turns before landing', () => {
    const rotation = landingRotation(123, 1, 4, 3);
    expect(rotation - 123).toBeGreaterThanOrEqual(3 * 360);
  });
  it('lands ahead of the current rotation for any starting angle', () => {
    const rotation = landingRotation(2000, 2, 5);
    expect(rotation).toBeGreaterThan(2000);
  });
  it('eases out of the spin', () => {
    expect(easeOutCubic(0)).toBe(0); expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});
