import { app, Menu, nativeImage, type NativeImage, Tray } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { MediaCommand } from '../shared/media';
import { APP_NAME } from './constants';
import { nextTrayFrame, TRAY_FRAME_COUNT, TRAY_FRAME_INTERVAL_MS, trayFrameFile } from './policy/tray-frames';

export interface TrayHandlers {
  onShow(): void;
  onCommand(cmd: MediaCommand): void;
  onQuit(): void;
}

// GC로 트레이가 사라지지 않도록 모듈 스코프에 보관한다.
let tray: Tray | null = null;

// 재생 중에 돌리는 레코드판 프레임. 비어 있으면 회전 없이 기본 아이콘만 쓴다.
let frames: NativeImage[] = [];
let frameIndex = 0;
let spinTimer: NodeJS.Timeout | null = null;

function trayIconPath(index = 0): string {
  return path.join(app.getAppPath(), 'assets', trayFrameFile(index));
}

function loadFrame(index: number): NativeImage {
  const image = nativeImage.createFromPath(trayIconPath(index));
  image.setTemplateImage(true);
  return image;
}

/** 프레임이 하나라도 없으면 빈 배열을 돌려 회전을 끈다. 반쯤 도는 아이콘보다 멈춘 아이콘이 낫다. */
function loadFrames(): NativeImage[] {
  const loaded: NativeImage[] = [];
  for (let i = 0; i < TRAY_FRAME_COUNT; i++) {
    const image = loadFrame(i);
    if (image.isEmpty()) {
      console.warn(`[tray] spin frame missing, icon will not rotate: ${trayIconPath(i)}`);
      return [];
    }
    loaded.push(image);
  }
  return loaded;
}

/**
 * 재생 중이면 레코드판을 돌리고, 일시정지·정지면 그 자리에서 멈춘다.
 * 앱을 열지 않고도 재생 여부를 알 수 있게 하려는 것이다.
 */
export function setTraySpinning(spinning: boolean): void {
  if (!spinning) {
    if (spinTimer) clearInterval(spinTimer);
    spinTimer = null;
    return;
  }
  if (spinTimer || !tray || frames.length === 0) return;
  spinTimer = setInterval(() => {
    if (!tray || tray.isDestroyed()) return setTraySpinning(false);
    frameIndex = nextTrayFrame(frameIndex);
    tray.setImage(frames[frameIndex]);
  }, TRAY_FRAME_INTERVAL_MS);
}

/**
 * 아이콘 옆에 현재 곡을 표시한다. setTitle은 macOS 전용이라 다른 OS에서는 아무것도 하지 않는다.
 * 트레이가 없으면(아이콘 누락·생성 실패) 조용히 넘어간다.
 */
export function setTrayTitle(text: string): void {
  if (process.platform !== 'darwin') return;
  tray?.setTitle(text);
}

/** 아이콘 파일이 없으면 null을 반환하고 트레이 없이 실행한다. */
export function createTray(handlers: TrayHandlers): Tray | null {
  const iconPath = trayIconPath();
  if (!fs.existsSync(iconPath)) {
    console.warn(`[tray] icon not found, running without tray: ${iconPath}`);
    return null;
  }

  try {
    tray = new Tray(loadFrame(0));
    frames = loadFrames();
    tray.setToolTip(APP_NAME);
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: '열기', click: () => handlers.onShow() },
        { type: 'separator' },
        { label: '재생 / 일시정지', click: () => handlers.onCommand('playpause') },
        { label: '다음 곡', click: () => handlers.onCommand('next') },
        { label: '이전 곡', click: () => handlers.onCommand('previous') },
        { type: 'separator' },
        { label: '종료', click: () => handlers.onQuit() },
      ]),
    );
    // macOS는 클릭하면 위 메뉴가 뜬다. 여기에 창 열기까지 걸면 메뉴를 보려던 클릭이 앱을
    // 앞으로 끌어내므로, 메뉴가 우클릭에만 뜨는 다른 OS에서만 좌클릭으로 창을 연다.
    if (process.platform !== 'darwin') tray.on('click', () => handlers.onShow());
    return tray;
  } catch (error) {
    console.warn('[tray] failed to create tray, running without it:', error);
    tray = null;
    return null;
  }
}
