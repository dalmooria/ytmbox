import { app, BrowserWindow } from 'electron';
import { pickUserAgent, shouldRestoreOriginalUa } from './policy/user-agent';

/** loadURL 이전에 호출. 세션 단위로 UA를 바꾸고 재시도 예외 훅을 건다. */
export function applyUserAgentSpoof(win: BrowserWindow): void {
  const { webContents } = win;
  const originalUa = webContents.userAgent;
  const spoofedUa = pickUserAgent(process.platform, process.versions.chrome);

  webContents.userAgent = spoofedUa;
  app.userAgentFallback = spoofedUa;
  webContents.session.setUserAgent(spoofedUa);

  webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
    if (shouldRestoreOriginalUa(webContents.getURL(), details.url)) {
      details.requestHeaders['User-Agent'] = originalUa;
    }
    callback({ requestHeaders: details.requestHeaders });
  });
}
