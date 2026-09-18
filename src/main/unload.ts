import type { BrowserWindow } from 'electron';

/**
 * YouTube Music은 window에 beforeunload 핸들러를 등록한다. 그중 하나가 이탈을 취소하면
 * Electron은 will-prevent-unload 리스너가 없는 한 창 닫기를 조용히 거부하고,
 * 그 결과 app.quit()이 close 단계에서 멈춰 will-quit/quit에 도달하지 못한다.
 * (Cmd+Q, 트레이 `종료`, Apple Event가 모두 무력화되고 강제 종료만 남는다.)
 *
 * will-prevent-unload에서의 preventDefault는 "beforeunload를 무시하고 그대로 언로드한다"는 뜻이다.
 * 이 앱은 웹 플레이어 껍데기이고 사용자가 잃을 편집 중인 데이터가 없으므로 항상 무시한다.
 */
export function attachUnloadOverride(win: BrowserWindow): void {
  win.webContents.on('will-prevent-unload', (event) => {
    event.preventDefault();
  });
}
