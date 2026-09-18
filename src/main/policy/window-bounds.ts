import type { Rect } from '../settings';

export type { Rect };

export interface Size {
  width: number;
  height: number;
}

function intersects(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * 저장된 창 위치가 현재 연결된 디스플레이 중 하나와 겹치면 그대로(크기는 해당 디스플레이 이하로 클램프),
 * 아니면 fallback 크기만 반환해 Electron이 화면 중앙에 배치하게 한다.
 */
export function fitBoundsToDisplays(
  saved: Rect | null,
  displays: Rect[],
  fallback: Size,
): Rect | Size {
  if (!saved || saved.width <= 0 || saved.height <= 0) return fallback;
  const display = displays.find((d) => intersects(saved, d));
  if (!display) return fallback;
  return {
    x: saved.x,
    y: saved.y,
    width: Math.min(saved.width, display.width),
    height: Math.min(saved.height, display.height),
  };
}
