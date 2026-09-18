const EXACT_HOSTS: ReadonlySet<string> = new Set([
  'music.youtube.com',
  'accounts.google.com',
  'www.youtube.com',
  'youtube.com',
  'apis.google.com',
]);

const SUFFIX_HOSTS: readonly string[] = [
  '.google.com',
  '.youtube.com',
  '.googleapis.com',
  '.googleusercontent.com',
  '.gstatic.com',
  '.ggpht.com',
];

/** 앱 창 안에서 열어도 되는 URL인지 판정한다. https + 허용 호스트만 true. */
export function isAllowedUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  if (EXACT_HOSTS.has(host)) return true;
  return SUFFIX_HOSTS.some((suffix) => host.endsWith(suffix));
}

/**
 * 외부 브라우저로 넘겨도 되는 URL인지 판정한다.
 * http/https만 허용한다 — file:, data:, javascript:, 커스텀 스킴을 OS 핸들러에
 * 넘기면 렌더러가 임의의 파일·앱을 열 수 있다.
 */
export function isExternallyOpenable(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
