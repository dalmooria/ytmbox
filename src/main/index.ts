import './app-name';
import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './window';

let mainWindow: BrowserWindow | null = null;
let quitting = false;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    mainWindow.show();
    mainWindow.focus();
  });

  app.on('before-quit', () => {
    quitting = true;
  });

  app.whenReady().then(() => {
    mainWindow = createMainWindow({
      isQuitting: () => quitting,
      hideOnClose: () => process.platform === 'darwin', // 트레이는 Task 9에서 연결
    });
  });

  app.on('activate', () => {
    mainWindow?.show();
  });

  app.on('window-all-closed', () => {
    // 창이 숨겨져도 앱을 유지한다 (트레이/Dock에서 복원).
  });
}
