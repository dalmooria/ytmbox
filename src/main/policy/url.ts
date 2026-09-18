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
