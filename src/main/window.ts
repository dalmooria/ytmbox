import { app, BrowserWindow, screen, session } from 'electron';
import path from 'node:path';
import { fitBoundsToDisplays } from './policy/window-bounds';
import { settings } from './settings';
import { applyUserAgentSpoof } from './user-agent';
import { attachNavigationPolicy } from './navigation';
import { attachOfflineFallback } from './offline';
import { YTMUSIC_URL } from './constants';

const PARTITION = 'persist:ytmusic';
const DEFAULT_SIZE = { width: 1280, height: 800 };
const SAVE_DEBOUNCE_MS = 300;
const SHOW_TIMEOUT_MS = 3000;

export interface MainWindowOptions {
  /** true면 close 이벤트에서 hide 대신 실제로 닫는다. */
  isQuitting: () => boolean;
  /**
   * false면 close가 실제로 창을 닫는다. macOS는 Dock으로 복원할 수 있어 항상 true,
   * 그 외 OS는 트레이가 만들어졌을 때만 true여야 한다 (Task 9에서 연결).
   */
  hideOnClose: () => boolean;
}

export function createMainWindow(opts: MainWindowOptions): BrowserWindow {
  const saved = settings.get('windowState');
  const displays = screen.getAllDisplays().map((d) => d.workArea);
  const bounds = fitBoundsToDisplays(saved?.bounds ?? null, displays, DEFAULT_SIZE);

  const win = new BrowserWindow({
    ...bounds,
    minWidth: 480,
    minHeight: 320,
    title: 'YTMusic',
    show: false,
    webPreferences: {
      session: session.fromPartition(PARTITION),
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (saved?.isMaximized) win.maximize();

  // ready-to-show는 첫 렌더 뒤에만 발생한다. 네트워크가 느려도 창이 영영 안 뜨는 일이 없도록 상한을 둔다.
  const showTimeout = setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible()) win.show();
  }, SHOW_TIMEOUT_MS);
  win.once('ready-to-show', () => {
    clearTimeout(showTimeout);
    win.show();
  });

  if (settings.get('overrideUserAgent')) {
    applyUserAgentSpoof(win);
  }
  attachNavigationPolicy(win);
  attachOfflineFallback(win);
  attachWindowStatePersistence(win);

  win.on('close', (event) => {
    if (opts.isQuitting() || !opts.hideOnClose()) return;
    event.preventDefault();
    win.hide();
  });

  void win.loadURL(YTMUSIC_URL);
  return win;
}

function attachWindowStatePersistence(win: BrowserWindow): void {
  let timer: NodeJS.Timeout | null = null;

  const save = (): void => {
    if (win.isDestroyed()) return;
    settings.set('windowState', {
      bounds: win.getNormalBounds(),
      isMaximized: win.isMaximized(),
    });
  };

  const scheduleSave = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(save, SAVE_DEBOUNCE_MS);
  };

  win.on('resize', scheduleSave);
  win.on('move', scheduleSave);
  win.on('maximize', scheduleSave);
  win.on('unmaximize', scheduleSave);
  win.on('close', save);
  app.on('before-quit', save);
}
