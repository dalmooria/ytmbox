import Store from 'electron-store';

/** 창 위치·크기. policy/window-bounds.ts도 이 타입을 import한다. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowState {
  bounds: Rect;
  isMaximized: boolean;
}

export interface Schema {
  /** 일반 Chrome UA로 위장 (Google 로그인 차단 우회). 변경 시 재시작 필요. */
  overrideUserAgent: boolean;
  /** globalShortcut으로 하드웨어 미디어키를 강제 점유. 기본 꺼짐. */
  forceMediaKeys: boolean;
  windowState: WindowState | null;
}

export const settings = new Store<Schema>({
  name: 'settings',
  defaults: {
    overrideUserAgent: true,
    forceMediaKeys: false,
    windowState: null,
  },
});
