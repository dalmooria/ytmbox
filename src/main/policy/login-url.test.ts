import { describe, expect, it } from 'vitest';
import { isAccountsHost, loginUrlReturningToYtMusic } from './login-url';

describe('loginUrlReturningToYtMusic', () => {
  it('builds the exact ServiceLogin URL that returns to YT Music', () => {
    expect(loginUrlReturningToYtMusic()).toBe(
      'https://accounts.google.com/ServiceLogin?ltmpl=music&service=youtube&continue=https%3A%2F%2Fwww.youtube.com%2Fsignin%3Faction_handle_signin%3Dtrue%26next%3Dhttps%253A%252F%252Fmusic.youtube.com%252F',
    );
  });
});

describe('isAccountsHost', () => {
  it('matches accounts.google.com exactly', () => {
    expect(isAccountsHost('https://accounts.google.com/ServiceLogin')).toBe(true);
  });

  it('rejects other hosts, including lookalike subdomains', () => {
    expect(isAccountsHost('https://evil.accounts.google.com.attacker.com/')).toBe(false);
    expect(isAccountsHost('https://music.youtube.com/')).toBe(false);
  });

  it('rejects unparsable input', () => {
    expect(isAccountsHost('not a url')).toBe(false);
  });
});
