import { EventEmitter } from 'node:events';
import type { BrowserWindow } from 'electron';
import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ shell: { openExternal: vi.fn() } }));
import { attachNavigationPolicy } from './navigation';

function navigationFrom(currentUrl: string) {
  const webContents = Object.assign(new EventEmitter(), {
    getURL: () => currentUrl,
    loadURL: vi.fn().mockResolvedValue(undefined),
    setWindowOpenHandler: vi.fn(),
  });
  attachNavigationPolicy({ webContents } as unknown as BrowserWindow);
  return webContents;
}

describe('same-window Google login', () => {
  it('returns a login started on the Premium landing page to Music', () => {
    const contents = navigationFrom('https://www.youtube.com/musicpremium');
    const event = { preventDefault: vi.fn() };
    contents.emit('will-navigate', event,
      'https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fwww.youtube.com%2Fmusicpremium');
    expect(event.preventDefault).toHaveBeenCalledOnce();
    const login = new URL(contents.loadURL.mock.calls[0][0]);
    const continuation = new URL(login.searchParams.get('continue')!);
    expect(login.origin).toBe('https://accounts.google.com');
    expect(continuation.origin).toBe('https://www.youtube.com');
    expect(continuation.searchParams.get('next')).toBe('https://music.youtube.com/');
  });

  it('does not restart an in-progress Google authentication flow', () => {
    const contents = navigationFrom('https://accounts.google.com/v3/signin/identifier');
    const event = { preventDefault: vi.fn() };
    contents.emit('will-navigate', event, 'https://accounts.google.com/v3/signin/challenge/pwd');
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(contents.loadURL).not.toHaveBeenCalled();
  });

  it('leaves Music internal navigation in the same window', () => {
    const contents = navigationFrom('https://music.youtube.com/');
    const event = { preventDefault: vi.fn() };
    contents.emit('will-navigate', event, 'https://music.youtube.com/explore');
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(contents.loadURL).not.toHaveBeenCalled();
  });
});
