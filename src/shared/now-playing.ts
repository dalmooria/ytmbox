export const NOWPLAYING_CHANNEL = 'media:nowplaying';

/** 렌더러가 보내는 현재 곡. preload/index.ts의 리터럴과 반드시 동일하게 유지한다. */
export interface NowPlaying {
  title: string;
  artist: string;
}

/**
 * 메뉴 막대에 허용할 폭(칸). 한글·CJK는 2칸이므로 32칸은 한글 16자 남짓이다.
 * 메뉴 막대를 독차지하지 않으면서 곡을 알아볼 수 있는 선으로 잡았다.
 */
export const TRAY_TITLE_BUDGET = 32;

/** 렌더러 입력의 상한. 이 길이를 넘으면 정상적인 곡 정보가 아니다. */
const RAW_MAX = 500;

// 폭 2칸으로 세는 문자: 한글, CJK, 전각, 그리고 이모지.
const WIDE =
  /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹯＀-｠￠-￦]|[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F2FF}]/u;

/** 코드 단위가 아니라 화면에서 차지하는 칸 수를 센다. */
export function displayWidth(text: string): number {
  let width = 0;
  for (const ch of segments(text)) width += WIDE.test(ch) ? 2 : 1;
  return width;
}

/** 이모지나 결합 문자를 반으로 쪼개지 않도록 자소 단위로 나눈다. */
function segments(text: string): string[] {
  const Segmenter = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (!Segmenter) return [...text];
  return [...new Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map((s) => s.segment);
}

function clean(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

function truncate(text: string, budget: number): string {
  let width = 0;
  let out = '';
  for (const ch of segments(text)) {
    const w = WIDE.test(ch) ? 2 : 1;
    if (width + w > budget) break;
    width += w;
    out += ch;
  }
  return out;
}

/**
 * 메뉴 막대에 넣을 한 줄을 만든다. 예산을 넘으면 아티스트를 먼저 버리고,
 * 그래도 넘으면 제목을 자른다. 잘린 아티스트 이름은 알아보기 어렵지만
 * 잘린 제목은 여전히 곡을 식별해주기 때문이다.
 */
export function formatTrayTitle(track: NowPlaying | null, budget = TRAY_TITLE_BUDGET): string {
  if (!track) return '';
  const title = clean(track.title);
  if (!title) return '';
  const artist = clean(track.artist);

  const pair = artist ? `${title} — ${artist}` : title;
  if (displayWidth(pair) <= budget) return pair;
  if (displayWidth(title) <= budget) return title;
  return `${truncate(title, budget - 1)}…`;
}

/**
 * 창 제목. 메뉴 막대와 달리 폭 제한이 없으므로 자르지 않고,
 * 아티스트는 메뉴 막대에 이미 있으므로 넣지 않는다.
 */
export function formatWindowTitle(track: NowPlaying | null, appName: string): string {
  if (!track) return appName;
  const title = clean(track.title);
  return title ? `${title} — ${appName}` : appName;
}

/** 렌더러에서 온 값은 신뢰하지 않는다. */
export function isNowPlaying(value: unknown): value is NowPlaying {
  if (typeof value !== 'object' || value === null) return false;
  const { title, artist } = value as Record<string, unknown>;
  if (typeof title !== 'string' || typeof artist !== 'string') return false;
  return title.length <= RAW_MAX && artist.length <= RAW_MAX;
}
