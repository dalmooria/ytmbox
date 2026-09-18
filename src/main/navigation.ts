import { BrowserWindow, shell } from 'electron';
import { isAllowedUrl } from './policy/url';

const YTMUSIC_URL = 'https://music.youtube.com/';
const ACCOUNTS_HOST = 'accounts.google.com';

/**
 * YouTube Music의 로그인 버튼은 window.open으로 accounts.google.com 팝업을 열고 결과를 받는다.
 * 팝업 없이 같은 창에서 로그인시키려면 완료 후 돌아올 continue URL을 직접 지정해야 한다.
 * 방식 출처: pear-desktop (MIT) src/index.ts
 */
export function loginUrlReturningToYtMusic(): string {
  const next = encodeURIComponent(YTMUSIC_URL);
  const cont = encodeURIComponent(
    `https://www.youtube.com/signin?action_handle_signin=true&next=${next}`,
  );
  return `https://${ACCOUNTS_HOST}/ServiceLogin?ltmpl=music&service=youtube&continue=${cont}`;
}

function isAccountsHost(url: string): boolean {
  try {
    return new URL(url).hostname === ACCOUNTS_HOST;
  } catch {
    return false;
  }
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
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  webContents.on('will-navigate', (event, url) => {
    if (!isAllowedUrl(url)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });
}
