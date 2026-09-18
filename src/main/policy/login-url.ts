import { YTMUSIC_URL } from '../constants';

export const ACCOUNTS_HOST = 'accounts.google.com';

/**
 * YouTube Music의 로그인 버튼은 window.open으로 accounts.google.com 팝업을 열고 결과를 받는다.
 * 팝업 없이 같은 창에서 로그인시키려면 완료 후 돌아올 continue URL을 직접 지정해야 한다.
 * 방식 출처: pear-desktop (MIT) src/index.ts
 */
export function loginUrlReturningToYtMusic(): string {
  // YTMUSIC_URL(트레일링 슬래시 없음)에 슬래시를 붙여 기존 로그인 continue URL과 바이트 동일하게 유지한다.
  const next = encodeURIComponent(`${YTMUSIC_URL}/`);
  const cont = encodeURIComponent(
    `https://www.youtube.com/signin?action_handle_signin=true&next=${next}`,
  );
  return `https://${ACCOUNTS_HOST}/ServiceLogin?ltmpl=music&service=youtube&continue=${cont}`;
}

export function isAccountsHost(url: string): boolean {
  try {
    return new URL(url).hostname === ACCOUNTS_HOST;
  } catch {
    return false;
  }
}
