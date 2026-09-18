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
 * 외부로 넘길 URL은 http/https만 허용한다. file:, data:, 커스텀 스킴을 OS 핸들러에
 * 그대로 넘기면 렌더러가 임의의 앱·파일을 열 수 있다.
 */
function safeOpenExternal(raw: string): void {
  try {
    const url = new URL(raw);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      void shell.openExternal(url.toString());
    }
  } catch {
    // 파싱 불가한 URL은 무시한다.
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
      safeOpenExternal(url);
    }
    return { action: 'deny' };
  });

  webContents.on('will-navigate', (event, url) => {
    if (!isAllowedUrl(url)) {
      event.preventDefault();
      safeOpenExternal(url);
    }
  });
}
