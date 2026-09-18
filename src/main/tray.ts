import { app, Menu, nativeImage, Tray } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { MediaCommand } from '../shared/media';

export interface TrayHandlers {
  onShow(): void;
  onCommand(cmd: MediaCommand): void;
  onQuit(): void;
}

// GC로 트레이가 사라지지 않도록 모듈 스코프에 보관한다.
let tray: Tray | null = null;

function trayIconPath(): string {
  return path.join(app.getAppPath(), 'assets', 'trayTemplate.png');
}

/** 아이콘 파일이 없으면 null을 반환하고 트레이 없이 실행한다. */
export function createTray(handlers: TrayHandlers): Tray | null {
  const iconPath = trayIconPath();
  if (!fs.existsSync(iconPath)) {
    console.warn(`[tray] icon not found, running without tray: ${iconPath}`);
    return null;
  }

  const image = nativeImage.createFromPath(iconPath);
  image.setTemplateImage(true);

  tray = new Tray(image);
  tray.setToolTip('YTMusic');
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
  tray.on('click', () => handlers.onShow());
  return tray;
}
