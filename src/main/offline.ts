import { app, BrowserWindow } from 'electron';
import path from 'node:path';

const ERR_ABORTED = -3;

/** 메인 프레임 로드 실패 시 오프라인 안내 페이지를 띄운다. 사용자 취소(-3)는 무시. */
export function attachOfflineFallback(win: BrowserWindow): void {
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, _validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === ERR_ABORTED) return;
    console.warn(`[offline] main frame failed to load: ${errorCode} ${errorDescription}`);
    void win.loadFile(path.join(app.getAppPath(), 'assets', 'offline.html'));
  });
}
