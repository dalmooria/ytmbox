import { EventEmitter } from 'node:events';
import type { BrowserWindow } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { attachUnloadOverride } from './unload';

function windowWithWebContents() {
  const webContents = new EventEmitter();
  attachUnloadOverride({ webContents } as unknown as BrowserWindow);
  return webContents;
}

describe('beforeunload override', () => {
  it('overrides the page veto so the window can always close', () => {
    const webContents = windowWithWebContents();
    const event = { preventDefault: vi.fn() };

    webContents.emit('will-prevent-unload', event);

    // preventDefault on will-prevent-unload means "ignore beforeunload, unload anyway".
    expect(event.preventDefault).toHaveBeenCalledOnce();
  });

  it('keeps overriding on every later close attempt', () => {
    const webContents = windowWithWebContents();
    const first = { preventDefault: vi.fn() };
    const second = { preventDefault: vi.fn() };

    webContents.emit('will-prevent-unload', first);
    webContents.emit('will-prevent-unload', second);

    expect(first.preventDefault).toHaveBeenCalledOnce();
    expect(second.preventDefault).toHaveBeenCalledOnce();
  });
});
