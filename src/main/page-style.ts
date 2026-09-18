import type { BrowserWindow } from 'electron';

/**
 * YouTube Music은 플레이어 바의 볼륨·셔플·반복을 두 겹으로 감춘다.
 *
 * 1. `(max-width: 1149px)`에서 `.volume`, `.shuffle`, `.repeat`, `.volume-slider`를
 *    통째로 `display: none` 처리한다. 창이 1150px보다 좁으면 아예 존재하지 않는다.
 * 2. 그 위로 `.volume-slider`는 `opacity: .000001`이라, 창이 넓어도 볼륨 영역에
 *    마우스를 올려야 슬라이더가 드러난다.
 *
 * 둘 다 되돌린다. `flex: none`이 없으면 슬라이더가 100px를 유지하지 못하고 32px로
 * 찌그러지고, `min-width: max-content`가 없으면 반대로 슬라이더가 컨테이너 밖으로
 * 넘쳐 작업 메뉴(⋮) 위를 덮어 클릭을 가로챈다. 두 줄은 함께 있어야 한다.
 *
 * 마지막으로 `.expand-button`(레이블 "플레이어 컨트롤 더보기")을 숨긴다. 이 버튼은
 * 위 1번으로 숨겨진 컨트롤을 꺼내주는 용도인데, 우리가 그것들을 이미 항상 보이게
 * 만들었으므로 꺼낼 것이 남아 있지 않다. 실측으로 확인했다 — 창 1000px, 플레이어
 * 페이지가 닫힌 상태에서 실제 마우스 이벤트로 클릭해도 플레이어 바의 컨트롤 목록과
 * 좌표가 클릭 전후 완전히 동일했다.
 */
export const PLAYER_BAR_CSS = `
@media (max-width: 1149px) {
  ytmusic-player-bar .volume,
  ytmusic-player-bar .shuffle,
  ytmusic-player-bar .right-controls-buttons .repeat {
    display: inline-block !important;
  }
  ytmusic-player-bar .volume-slider {
    display: flex !important;
    flex: none !important;
    width: 100px !important;
  }
  ytmusic-player-bar .right-controls {
    min-width: max-content !important;
  }
}
ytmusic-player-bar .volume-slider {
  opacity: 1 !important;
  pointer-events: auto !important;
}
ytmusic-player-bar .right-controls .expand-button {
  display: none !important;
}
`;

/**
 * insertCSS는 문서 하나에만 살아 있으므로 로드마다 다시 넣는다.
 * 오프라인 안내 페이지처럼 셀렉터가 맞지 않는 문서에 들어가도 아무 일도 하지 않는다.
 */
export function attachPageStyle(win: BrowserWindow): void {
  const { webContents } = win;

  webContents.on('did-finish-load', () => {
    webContents.insertCSS(PLAYER_BAR_CSS).catch((error) => {
      console.warn('[page-style] failed to inject player bar stylesheet:', error);
    });
  });
}
