/**
 * 재생 중에 돌리는 트레이 아이콘의 프레임 수. 반 바퀴 분량이며(도안이 180° 대칭),
 * scripts/make-icons.js의 FRAME_COUNT와 반드시 동일하게 유지한다.
 */
export const TRAY_FRAME_COUNT = 12;

/** 프레임을 넘기는 간격(ms). 12프레임이 반 바퀴이므로 한 바퀴에 약 1.9초 — 33⅓rpm에 가깝다. */
export const TRAY_FRAME_INTERVAL_MS = 80;

/** 0번은 멈춰 있을 때도 쓰는 기본 아이콘이다. @2x는 Electron이 같은 이름에서 알아서 찾는다. */
export function trayFrameFile(index: number): string {
  return index === 0 ? 'trayTemplate.png' : `traySpin${String(index).padStart(2, '0')}Template.png`;
}

export function nextTrayFrame(index: number): number {
  return (index + 1) % TRAY_FRAME_COUNT;
}
