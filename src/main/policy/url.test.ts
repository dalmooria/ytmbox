import { describe, expect, it } from 'vitest';
import { isAllowedUrl, isExternallyOpenable } from './url';

describe('isAllowedUrl', () => {
  it.each([
    'https://music.youtube.com/',
    'https://music.youtube.com/watch?v=abc',
    'https://accounts.google.com/ServiceLogin',
    'https://myaccount.google.com/',
    'https://www.youtube.com/signin',
    'https://youtube.com/',
    'https://consent.youtube.com/m',
    'https://apis.google.com/js/api.js',
    'https://www.googleapis.com/x',
    'https://lh3.googleusercontent.com/a.png',
    'https://www.gstatic.com/x.js',
    'https://yt3.ggpht.com/a.jpg',
    'https://MUSIC.YOUTUBE.COM/',
    'https://google.com/',
  ])('allows %s', (url) => {
    expect(isAllowedUrl(url)).toBe(true);
  });

  it.each([
    'https://example.com/',
    'https://evil.com/?next=music.youtube.com',
    'https://fakegoogle.com/',
    'https://google.com.evil.net/',
    'http://music.youtube.com/',
    'https://music.youtube.com@evil.com/',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'not a url',
    '',
  ])('blocks %s', (url) => {
    expect(isAllowedUrl(url)).toBe(false);
  });
});

describe('isExternallyOpenable', () => {
  it.each(['https://example.com/page', 'http://example.com/page'])(
    'allows %s',
    (url) => {
      expect(isExternallyOpenable(url)).toBe(true);
    },
  );

  it.each([
    'file:///Applications/Calculator.app',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'ftp://example.com/x',
    'myapp://do-something',
    'not a url',
    '',
  ])('blocks %s', (url) => {
    expect(isExternallyOpenable(url)).toBe(false);
  });
});
