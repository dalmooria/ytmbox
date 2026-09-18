import './app-name';
import { app, BrowserWindow } from 'electron';
import { attachNavigationPolicy } from './navigation';
import { applyUserAgentSpoof } from './user-agent';
import { settings } from './settings';

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
  if (settings.get('overrideUserAgent')) {
    applyUserAgentSpoof(win);
  }
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
