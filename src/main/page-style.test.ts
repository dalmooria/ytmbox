import { EventEmitter } from 'node:events';
import type { BrowserWindow } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { attachPageStyle, PLAYER_BAR_CSS } from './page-style';

function windowWithWebContents() {
  const webContents = Object.assign(new EventEmitter(), {
    insertCSS: vi.fn().mockResolvedValue('key'),
  });
  attachPageStyle({ webContents } as unknown as BrowserWindow);
  return webContents;
}

describe('player bar stylesheet', () => {
  it('injects once the document has loaded', () => {
    const webContents = windowWithWebContents();

    webContents.emit('did-finish-load');

    expect(webContents.insertCSS).toHaveBeenCalledWith(PLAYER_BAR_CSS);
  });

  it('re-injects on every load, because insertCSS only lives as long as the document', () => {
    const webContents = windowWithWebContents();

    webContents.emit('did-finish-load');
    webContents.emit('did-finish-load');

    expect(webContents.insertCSS).toHaveBeenCalledTimes(2);
  });

  it('survives a rejected injection', async () => {
    const webContents = windowWithWebContents();
    webContents.insertCSS.mockRejectedValueOnce(new Error('detached'));

    expect(() => webContents.emit('did-finish-load')).not.toThrow();
    await Promise.resolve();
  });
});

describe('the rules the stylesheet must carry', () => {
  // 실측 근거: 창 1000px에서 YouTube Music이 (max-width: 1149px) 미디어 쿼리로
  // .volume/.shuffle/.repeat/.volume-slider를 display:none 처리한다.
  it('undoes the breakpoint that hides volume, shuffle and repeat', () => {
    expect(PLAYER_BAR_CSS).toContain('max-width: 1149px');
    for (const sel of ['.volume', '.shuffle', '.repeat', '.volume-slider']) {
      expect(PLAYER_BAR_CSS).toContain(sel);
    }
  });

  it('undoes the near-zero opacity that hides the slider until hover', () => {
    expect(PLAYER_BAR_CSS).toMatch(/opacity:\s*1\s*!important/);
  });

  // 이 버튼("플레이어 컨트롤 더보기")은 위 미디어 쿼리가 숨긴 컨트롤을 꺼내는 용도다.
  // 그 컨트롤들을 우리가 이미 항상 보이게 만들었으므로 누를 것이 남아 있지 않다.
  it('hides the overflow button that has nothing left to reveal', () => {
    expect(PLAYER_BAR_CSS).toMatch(
      /\.right-controls\s+\.expand-button\s*\{[^}]*display:\s*none\s*!important/,
    );
  });

  it('keeps the slider from being flex-shrunk, and gives its row room', () => {
    // flex:none 만 주면 슬라이더가 컨테이너 밖으로 넘쳐 작업 메뉴(⋮)를 덮는다.
    expect(PLAYER_BAR_CSS).toMatch(/flex:\s*none\s*!important/);
    expect(PLAYER_BAR_CSS).toMatch(/min-width:\s*max-content\s*!important/);
  });
});
