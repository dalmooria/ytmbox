import { BrowserWindow, shell } from 'electron';
import { isAllowedUrl, isExternallyOpenable } from './policy/url';
import { isAccountsHost, loginUrlReturningToYtMusic } from './policy/login-url';

export { loginUrlReturningToYtMusic };

function safeOpenExternal(raw: string): void {
  if (isExternallyOpenable(raw)) void shell.openExternal(raw);
}

/**
 * 새 창은 절대 만들지 않는다. 허용 URL은 같은 창에서 열고,
 * 나머지는 OS 기본 브라우저로 보낸다.
 */
export function attachNavigationPolicy(win: BrowserWindow): void {
  const { webContents } = win;

  webContents.setWindowOpenHandler(({ url }) => {
    if (isAccountsHost(url)) {
      void webContents.loadURL(loginUrlReturningToYtMusic());
    } else if (isAllowedUrl(url)) {
      void webContents.loadURL(url);
    } else {
      safeOpenExternal(url);
    }
    return { action: 'deny' };
  });

  webContents.on('will-navigate', (event, url) => {
    // Premium 안내 페이지의 로그인은 팝업이 아니라 같은 창에서 열린다.
    // Google 인증 도중의 단계 이동은 그대로 두고, 최초 진입만 Music으로 복귀시킨다.
    if (isAllowedUrl(url) && isAccountsHost(url) && !isAccountsHost(webContents.getURL())) {
      event.preventDefault();
      void webContents.loadURL(loginUrlReturningToYtMusic());
    } else if (!isAllowedUrl(url)) {
      event.preventDefault();
      safeOpenExternal(url);
    }
  });
}
