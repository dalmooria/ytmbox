import { ipcRenderer } from 'electron';

// 샌드박스 preload는 상대 경로 require가 불가하므로 src/shared/media.ts의 값을 리터럴로 복제한다.
const MEDIA_CHANNEL = 'media:command';
type MediaCommand = 'playpause' | 'next' | 'previous' | 'stop';
const COMMANDS: readonly string[] = ['playpause', 'next', 'previous', 'stop'];
const PLAYER_SELECTORS = {
  next: 'ytmusic-player-bar .next-button',
  previous: 'ytmusic-player-bar .previous-button',
} as const;

function clickPlayerButton(selector: string): void {
  const el = document.querySelector<HTMLElement>(selector);
  el?.click();
}

function runMediaCommand(cmd: MediaCommand): void {
  const video = document.querySelector('video');
  switch (cmd) {
    case 'playpause':
      if (!video) return;
      if (video.paused) void video.play().catch(() => undefined);
      else video.pause();
      return;
    case 'stop':
      video?.pause();
      return;
    case 'next':
      clickPlayerButton(PLAYER_SELECTORS.next);
      return;
    case 'previous':
      clickPlayerButton(PLAYER_SELECTORS.previous);
      return;
  }
}

ipcRenderer.on(MEDIA_CHANNEL, (_event, cmd: unknown) => {
  if (typeof cmd === 'string' && COMMANDS.includes(cmd)) {
    runMediaCommand(cmd as MediaCommand);
  }
});
// 페이지(main world)에는 아무 API도 노출하지 않는다.
