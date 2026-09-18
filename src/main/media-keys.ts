import { globalShortcut, systemPreferences } from 'electron';
import type { MediaCommand } from '../shared/media';

const ACCELERATORS: ReadonlyArray<readonly [string, MediaCommand]> = [
  ['MediaPlayPause', 'playpause'],
  ['MediaNextTrack', 'next'],
  ['MediaPreviousTrack', 'previous'],
  ['MediaStop', 'stop'],
];

/**
 * forceMediaKeys 옵션용. 기본 경로(Chromium MediaSession → macOS Now Playing)를 덮어쓰므로
 * 설정이 켜진 경우에만 호출한다. 실패는 경고 로그만 남긴다.
 */
export function registerMediaKeys(send: (cmd: MediaCommand) => void): void {
  if (process.platform === 'darwin' && !systemPreferences.isTrustedAccessibilityClient(true)) {
    console.warn('[media-keys] accessibility permission not granted; media keys not registered');
    return;
  }
  for (const [accelerator, cmd] of ACCELERATORS) {
    const ok = globalShortcut.register(accelerator, () => send(cmd));
    if (!ok) console.warn(`[media-keys] failed to register ${accelerator} (taken by another app?)`);
  }
}

export function unregisterMediaKeys(): void {
  globalShortcut.unregisterAll();
}
