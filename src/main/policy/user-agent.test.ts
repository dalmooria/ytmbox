import { describe, expect, it } from 'vitest';
import { pickUserAgent, shouldRestoreOriginalUa } from './user-agent';

describe('pickUserAgent', () => {
  it('returns a macOS Chrome UA on darwin', () => {
    const ua = pickUserAgent('darwin', '130.0.6723.152');
    expect(ua).toContain('Macintosh; Intel Mac OS X');
    expect(ua).toContain('Chrome/130.0.6723.152');
    expect(ua).toContain('Safari/537.36');
  });

  it('returns a Windows UA on win32', () => {
    expect(pickUserAgent('win32', '130.0.0.0')).toContain('Windows NT 10.0; Win64; x64');
  });

  it('returns a Linux UA for anything else', () => {
    expect(pickUserAgent('linux', '130.0.0.0')).toContain('X11; Linux x86_64');
    expect(pickUserAgent('freebsd', '130.0.0.0')).toContain('X11; Linux x86_64');
  });

  it('never contains the Electron token', () => {
    for (const p of ['darwin', 'win32', 'linux']) {
      expect(pickUserAgent(p, '130.0.0.0')).not.toMatch(/Electron/i);
    }
  });
});

describe('shouldRestoreOriginalUa', () => {
  const login = 'https://accounts.google.com/signin/v2';
  it('is true only when page and request are both on accounts.google.com', () => {
    expect(shouldRestoreOriginalUa(login, 'https://accounts.google.com/_/x')).toBe(true);
  });
  it('is false when the page is YouTube Music', () => {
    expect(shouldRestoreOriginalUa('https://music.youtube.com/', 'https://accounts.google.com/_/x')).toBe(false);
  });
  it('is false when the request goes elsewhere', () => {
    expect(shouldRestoreOriginalUa(login, 'https://www.gstatic.com/a.js')).toBe(false);
  });
  it('is false for empty page URL (before first load)', () => {
    expect(shouldRestoreOriginalUa('', 'https://accounts.google.com/')).toBe(false);
  });
});
