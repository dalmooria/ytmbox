import './app-name';
import { app, BrowserWindow, ipcMain } from 'electron';
import { MediaCommand, sendMediaCommand } from '../shared/media';
import { formatTrayTitle, isNowPlaying, NOWPLAYING_CHANNEL } from '../shared/now-playing';
import { registerMediaKeys, unregisterMediaKeys } from './media-keys';
import { installApplicationMenu } from './menu';
import { settings } from './settings';
import { createTray, setTrayTitle } from './tray';
import { createMainWindow } from './window';

let mainWindow: BrowserWindow | null = null;
let quitting = false;
let hasTray = false;

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function dispatchMedia(cmd: MediaCommand): void {
  if (mainWindow && !mainWindow.isDestroyed()) sendMediaCommand(mainWindow.webContents, cmd);
}

function applyForceMediaKeys(enabled: boolean): void {
  unregisterMediaKeys();
  if (enabled) registerMediaKeys(dispatchMedia);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showMainWindow);

  // 렌더러가 보내는 값이므로 발신자와 형식을 모두 확인한 뒤에야 사용한다.
  ipcMain.on(NOWPLAYING_CHANNEL, (event, payload: unknown) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) return;
    if (!isNowPlaying(payload)) return;
    setTrayTitle(formatTrayTitle(payload));
  });

  app.on('before-quit', () => {
    quitting = true;
  });

  app.on('will-quit', () => {
    unregisterMediaKeys();
  });

  app.whenReady().then(() => {
    installApplicationMenu({ onForceMediaKeysChange: applyForceMediaKeys });
    mainWindow = createMainWindow({
      isQuitting: () => quitting,
      // macOS는 Dock으로 복원 가능. 그 외 OS는 트레이가 있을 때만 숨기고, 없으면 실제로 닫는다.
      hideOnClose: () => process.platform === 'darwin' || hasTray,
    });
    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    hasTray =
      createTray({
        onShow: showMainWindow,
        onCommand: dispatchMedia,
        onQuit: () => app.quit(),
      }) !== null;

    applyForceMediaKeys(settings.get('forceMediaKeys'));
  });

  app.on('activate', showMainWindow);

  app.on('window-all-closed', () => {
    // macOS와 트레이가 있는 경우 창이 숨겨져도 앱을 유지한다. 그 외에는 마지막 창이 닫히면 종료.
    if (process.platform !== 'darwin' && !hasTray) app.quit();
  });
}
