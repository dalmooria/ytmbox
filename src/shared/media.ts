import type { WebContents } from 'electron';

export const MEDIA_CHANNEL = 'media:command';

export const MEDIA_COMMANDS = ['playpause', 'next', 'previous', 'stop'] as const;
export type MediaCommand = (typeof MEDIA_COMMANDS)[number];

/** preload/index.ts의 리터럴과 반드시 동일하게 유지한다. */
export const PLAYER_SELECTORS = {
  next: 'ytmusic-player-bar .next-button',
  previous: 'ytmusic-player-bar .previous-button',
} as const;

export function isMediaCommand(value: unknown): value is MediaCommand {
  return typeof value === 'string' && (MEDIA_COMMANDS as readonly string[]).includes(value);
}

export function sendMediaCommand(target: WebContents, cmd: MediaCommand): void {
  if (target.isDestroyed()) return;
  target.send(MEDIA_CHANNEL, cmd);
}
