const ACCOUNTS_HOST = 'accounts.google.com';

function isAccountsUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && url.hostname === ACCOUNTS_HOST;
  } catch {
    return false;
  }
}

/**
 * Electron 토큰이 없는 일반 Chrome UA를 만든다.
 * chromeVersion은 process.versions.chrome을 넘겨 Electron 내장 버전과 맞춘다.
 * 방식 출처: pear-desktop (구 th-ch/youtube-music, MIT) src/index.ts
 */
export function pickUserAgent(platform: string, chromeVersion: string): string {
  const tail = `AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
  switch (platform) {
    case 'darwin':
      return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ${tail}`;
    case 'win32':
      return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) ${tail}`;
    default:
      return `Mozilla/5.0 (X11; Linux x86_64) ${tail}`;
  }
}

/**
 * 로그인 실패 후 "다시 시도" 케이스: 현재 페이지와 요청이 모두
 * accounts.google.com일 때만 원래 Electron UA로 되돌린다.
 */
export function shouldRestoreOriginalUa(pageUrl: string, requestUrl: string): boolean {
  return isAccountsUrl(pageUrl) && isAccountsUrl(requestUrl);
}
