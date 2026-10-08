import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { nextTrayFrame, TRAY_FRAME_COUNT, trayFrameFile } from './tray-frames';

const root = path.join(__dirname, '..', '..', '..');

describe('tray spin frames', () => {
  it('uses the base tray icon as the first frame', () => {
    expect(trayFrameFile(0)).toBe('trayTemplate.png');
    expect(trayFrameFile(1)).toBe('traySpin01Template.png');
  });

  it('wraps around after the last frame', () => {
    expect(nextTrayFrame(0)).toBe(1);
    expect(nextTrayFrame(TRAY_FRAME_COUNT - 1)).toBe(0);
  });

  it('has a generated asset for every frame at both scales', () => {
    for (let i = 0; i < TRAY_FRAME_COUNT; i++) {
      const file = path.join(root, 'assets', trayFrameFile(i));
      expect(existsSync(file), file).toBe(true);
      expect(existsSync(file.replace('.png', '@2x.png')), `${file} @2x`).toBe(true);
    }
  });

  it('matches the frame count the icon generator writes (drift guard)', () => {
    const generator = readFileSync(path.join(root, 'scripts', 'make-icons.js'), 'utf-8');
    expect(generator).toContain(`const FRAME_COUNT = ${TRAY_FRAME_COUNT};`);
  });
});
