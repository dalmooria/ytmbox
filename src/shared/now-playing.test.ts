import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  displayWidth,
  formatTrayTitle,
  formatWindowTitle,
  isNowPlaying,
  NOWPLAYING_CHANNEL,
  TRAY_TITLE_BUDGET,
} from './now-playing';

describe('displayWidth', () => {
  it('counts Latin characters as one column', () => {
    expect(displayWidth('Hello')).toBe(5);
  });

  it('counts Hangul and CJK as two columns', () => {
    expect(displayWidth('제목')).toBe(4);
    expect(displayWidth('曲')).toBe(2);
  });

  it('counts emoji as two columns rather than by code unit', () => {
    expect(displayWidth('🎵')).toBe(2);
  });
});

describe('formatTrayTitle', () => {
  it('shows nothing when there is no track', () => {
    expect(formatTrayTitle(null)).toBe('');
    expect(formatTrayTitle({ title: '', artist: 'Someone' })).toBe('');
  });

  it('joins title and artist when they fit', () => {
    expect(formatTrayTitle({ title: '짧은 제목', artist: '아티스트' })).toBe('짧은 제목 — 아티스트');
  });

  it('shows the title alone when there is no artist', () => {
    expect(formatTrayTitle({ title: 'Hello', artist: '' })).toBe('Hello');
  });

  it('drops the artist rather than truncating when the pair is too wide', () => {
    const title = 'A'.repeat(25);
    expect(formatTrayTitle({ title, artist: 'B'.repeat(20) })).toBe(title);
  });

  it('truncates a title that is too wide on its own', () => {
    // 실제 곡: 라틴 + 한글 혼합, 폭 36칸으로 예산을 넘는다.
    const title = 'Still waiting for you(바라고 바라고)';
    expect(displayWidth(title)).toBeGreaterThan(TRAY_TITLE_BUDGET);

    const out = formatTrayTitle({ title, artist: 'SEUNGJUN(승준)' });

    expect(out.endsWith('…')).toBe(true);
    expect(displayWidth(out)).toBeLessThanOrEqual(TRAY_TITLE_BUDGET);
    expect(title.startsWith(out.slice(0, -1))).toBe(true);
  });

  it('never splits a multi-code-unit character when truncating', () => {
    const out = formatTrayTitle({ title: '🎵'.repeat(30), artist: '' });

    expect(displayWidth(out)).toBeLessThanOrEqual(TRAY_TITLE_BUDGET);
    expect([...out].every((ch) => ch === '🎵' || ch === '…')).toBe(true);
  });

  it('collapses whitespace and newlines that would break the menu bar', () => {
    expect(formatTrayTitle({ title: '  Song\n\n  Name  ', artist: '' })).toBe('Song Name');
  });

  it('honours a caller-supplied budget', () => {
    expect(displayWidth(formatTrayTitle({ title: 'A'.repeat(50), artist: '' }, 10))).toBeLessThanOrEqual(10);
  });
});

describe('formatWindowTitle', () => {
  it('shows the app name alone when nothing is playing', () => {
    expect(formatWindowTitle(null, 'YTMBox')).toBe('YTMBox');
    expect(formatWindowTitle({ title: '', artist: 'Someone' }, 'YTMBox')).toBe('YTMBox');
  });

  it('puts the track before the app name', () => {
    expect(formatWindowTitle({ title: '너인가봄', artist: '코드네임' }, 'YTMBox')).toBe('너인가봄 — YTMBox');
  });

  it('does not truncate — the title bar has room the menu bar does not', () => {
    const title = 'A'.repeat(200);
    expect(formatWindowTitle({ title, artist: '' }, 'YTMBox')).toBe(`${title} — YTMBox`);
  });

  it('collapses whitespace', () => {
    expect(formatWindowTitle({ title: ' Song\n Name ', artist: '' }, 'YTMBox')).toBe('Song Name — YTMBox');
  });
});

describe('isNowPlaying', () => {
  it('accepts a well-formed payload', () => {
    expect(isNowPlaying({ title: 'a', artist: 'b' })).toBe(true);
  });

  it('rejects anything that is not a title/artist pair of strings', () => {
    expect(isNowPlaying(null)).toBe(false);
    expect(isNowPlaying('nope')).toBe(false);
    expect(isNowPlaying({ title: 'a' })).toBe(false);
    expect(isNowPlaying({ title: 'a', artist: 42 })).toBe(false);
  });

  it('rejects an oversized payload from a compromised renderer', () => {
    expect(isNowPlaying({ title: 'a'.repeat(5000), artist: 'b' })).toBe(false);
  });
});

describe('channel contract', () => {
  it('channel name is stable', () => {
    expect(NOWPLAYING_CHANNEL).toBe('media:nowplaying');
  });
});

describe('preload literal mirror of now-playing.ts (drift guard)', () => {
  // sandbox: true인 preload는 상대 경로 require가 불가해 채널명을 리터럴로 복제한다.
  const preloadSource = readFileSync(path.join(__dirname, '..', 'preload', 'index.ts'), 'utf-8');

  it('contains the now-playing channel name', () => {
    expect(preloadSource).toContain(NOWPLAYING_CHANNEL);
  });

  it('reports on media events rather than polling with a timer', () => {
    expect(preloadSource).toContain(NOWPLAYING_CHANNEL);
    expect(preloadSource).not.toMatch(/setInterval|setTimeout/);
  });
});
