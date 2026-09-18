import './app-name';
import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './window';

let mainWindow: BrowserWindow | null = null;
let quitting = false;

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
  // macOS는 창이 숨겨져도 앱을 유지한다. 다른 OS도 트레이 동작을 맞추므로 종료하지 않는다.
});
