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
