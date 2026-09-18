import { app, BrowserWindow } from 'electron';
import { attachNavigationPolicy } from './navigation';

const YTMUSIC_URL = 'https://music.youtube.com';

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  attachNavigationPolicy(win);
  void win.loadURL(YTMUSIC_URL);
  return win;
}

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
