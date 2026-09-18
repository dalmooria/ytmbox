import { describe, expect, it } from 'vitest';
import { isAllowedUrl } from './url';

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
  ])('allows %s', (url) => {
    expect(isAllowedUrl(url)).toBe(true);
  });

  it.each([
    'https://example.com/',
    'https://evil.com/?next=music.youtube.com',
    'https://fakegoogle.com/',
    'https://google.com.evil.net/',
    'http://music.youtube.com/',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'not a url',
    '',
  ])('blocks %s', (url) => {
    expect(isAllowedUrl(url)).toBe(false);
  });
});
