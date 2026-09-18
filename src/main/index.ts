import './app-name';
import { app, BrowserWindow } from 'electron';
import { MediaCommand, sendMediaCommand } from '../shared/media';
import { registerMediaKeys, unregisterMediaKeys } from './media-keys';
import { installApplicationMenu } from './menu';
import { settings } from './settings';
import { createTray } from './tray';
import { createMainWindow } from './window';

let mainWindow: BrowserWindow | null = null;
let quitting = false;
let hasTray = false;

function showMainWindow(): void {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function dispatchMedia(cmd: MediaCommand): void {
  if (mainWindow) sendMediaCommand(mainWindow.webContents, cmd);
}

function applyForceMediaKeys(enabled: boolean): void {
  unregisterMediaKeys();
  if (enabled) registerMediaKeys(dispatchMedia);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showMainWindow);

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
