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

// src/shared/now-playing.ts의 채널명을 리터럴로 복제한다 (위와 같은 샌드박스 제약).
const NOWPLAYING_CHANNEL = 'media:nowplaying';

let lastReported = '';

function reportNowPlaying(): void {
  const metadata = navigator.mediaSession?.metadata;
  const title = metadata?.title ?? '';
  const artist = metadata?.artist ?? '';
  const key = `${title}\u0000${artist}`;
  if (key === lastReported) return;
  lastReported = key;
  ipcRenderer.send(NOWPLAYING_CHANNEL, { title, artist });
}

// 미디어 이벤트는 버블링하지 않지만 캡처 단계는 거친다. document에서 캡처하면
// 페이지가 <video>를 교체해도 리스너를 다시 붙일 필요가 없고 타이머도 필요 없다.
// timeupdate는 재생 중 자주 오지만 위 비교로 값이 바뀔 때만 전송한다.
for (const type of ['loadstart', 'loadedmetadata', 'play', 'pause', 'ended', 'emptied', 'timeupdate']) {
  document.addEventListener(type, reportNowPlaying, true);
}
document.addEventListener('DOMContentLoaded', reportNowPlaying);

ipcRenderer.on(MEDIA_CHANNEL, (_event, cmd: unknown) => {
  if (typeof cmd === 'string' && COMMANDS.includes(cmd)) {
    runMediaCommand(cmd as MediaCommand);
  }
});
// 페이지(main world)에는 아무 API도 노출하지 않는다.
