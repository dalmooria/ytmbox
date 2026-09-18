import { describe, expect, it } from 'vitest';
import { fitBoundsToDisplays } from './window-bounds';

const primary = { x: 0, y: 0, width: 1920, height: 1080 };
const secondary = { x: 1920, y: 0, width: 1920, height: 1080 };
const fallback = { width: 1280, height: 800 };

describe('fitBoundsToDisplays', () => {
  it('returns fallback size when nothing is saved', () => {
    expect(fitBoundsToDisplays(null, [primary], fallback)).toEqual(fallback);
  });

  it('keeps saved bounds when they lie inside a display', () => {
    const saved = { x: 100, y: 100, width: 1000, height: 700 };
    expect(fitBoundsToDisplays(saved, [primary], fallback)).toEqual(saved);
  });

  it('keeps saved bounds on a secondary display', () => {
    const saved = { x: 2000, y: 50, width: 1000, height: 700 };
    expect(fitBoundsToDisplays(saved, [primary, secondary], fallback)).toEqual(saved);
  });

  it('falls back when the saved window is entirely off-screen (display unplugged)', () => {
    const saved = { x: 2000, y: 50, width: 1000, height: 700 };
    expect(fitBoundsToDisplays(saved, [primary], fallback)).toEqual(fallback);
  });

  it('falls back when saved bounds have non-positive size', () => {
    const saved = { x: 0, y: 0, width: 0, height: 700 };
    expect(fitBoundsToDisplays(saved, [primary], fallback)).toEqual(fallback);
  });

  it('clamps a window larger than its display down to the display size', () => {
    const saved = { x: 0, y: 0, width: 5000, height: 4000 };
    expect(fitBoundsToDisplays(saved, [primary], fallback)).toEqual({
      x: 0, y: 0, width: 1920, height: 1080,
    });
  });
});
