import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isMediaCommand, MEDIA_CHANNEL, MEDIA_COMMANDS, PLAYER_SELECTORS } from './media';

describe('media command contract', () => {
  it('channel name is stable', () => {
    expect(MEDIA_CHANNEL).toBe('media:command');
  });

  it('lists exactly the four commands', () => {
    expect([...MEDIA_COMMANDS].sort()).toEqual(['next', 'playpause', 'previous', 'stop']);
  });

  it('isMediaCommand accepts only known commands', () => {
    expect(isMediaCommand('next')).toBe(true);
    expect(isMediaCommand('NEXT')).toBe(false);
    expect(isMediaCommand(42)).toBe(false);
    expect(isMediaCommand(undefined)).toBe(false);
  });

  it('has a selector for next and previous', () => {
    expect(PLAYER_SELECTORS.next).toContain('next-button');
    expect(PLAYER_SELECTORS.previous).toContain('previous-button');
  });
});

describe('preload literal mirror of media.ts (drift guard)', () => {
  // sandbox: true인 preload는 상대 경로 require가 불가해 src/preload/index.ts가
  // 이 파일의 값들을 리터럴로 복제한다. 여기서 두 곳이 어긋나지 않는지 확인한다.
  const preloadSource = readFileSync(
    path.join(__dirname, '..', 'preload', 'index.ts'),
    'utf-8',
  );

  it('contains the media channel name', () => {
    expect(preloadSource).toContain(MEDIA_CHANNEL);
  });

  it('contains every media command string', () => {
    for (const cmd of MEDIA_COMMANDS) {
      expect(preloadSource).toContain(cmd);
    }
  });

  it('contains both player selectors', () => {
    expect(preloadSource).toContain(PLAYER_SELECTORS.next);
    expect(preloadSource).toContain(PLAYER_SELECTORS.previous);
  });
});
