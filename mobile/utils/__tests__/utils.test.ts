import { formatClock, formatClockMs, formatDuration } from '../format';
import { getDailyChallenge, getDailySeed } from '../daily';
import { SERVER_URL, API_URL, RELAY_WSS } from '../api';

describe('format', () => {
  test('formatClock: pads seconds, not minutes', () => {
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(600)).toBe('10:00');
    expect(formatClock(3599)).toBe('59:59');
  });
  test('formatClock: clamps negatives / NaN to 0:00', () => {
    expect(formatClock(-5)).toBe('0:00');
    expect(formatClock(NaN as unknown as number)).toBe('0:00');
  });
  test('formatClockMs: from milliseconds', () => {
    expect(formatClockMs(65000)).toBe('1:05');
    expect(formatClockMs(0)).toBe('0:00');
    expect(formatClockMs(125500)).toBe('2:05');
  });
  test('formatDuration: em-dash fallback for empty/zero', () => {
    expect(formatDuration(0)).toBe('—');
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(undefined)).toBe('—');
    expect(formatDuration(-3)).toBe('—');
    expect(formatDuration(65)).toBe('1:05');
  });
});

describe('daily challenge', () => {
  test('structure: ISO date, seed == YYYYMMDD int, valid difficulty', () => {
    const c = getDailyChallenge();
    expect(c.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(c.seed).toBe(getDailySeed());
    expect(c.seed).toBe(parseInt(c.date.replace(/-/g, ''), 10));
    expect(['medium', 'hard', 'expert']).toContain(c.difficulty);
    expect(c.completed).toBe(false);
    expect(c.time).toBeNull();
    expect(c.stars).toBe(0);
  });
  test('difficulty rotates by weekday (deterministic via fake time)', () => {
    jest.useFakeTimers();
    // Sunday 2026-06-21 (getDay 0 < 3) → medium
    jest.setSystemTime(new Date(2026, 5, 21, 12, 0, 0));
    expect(getDailyChallenge().difficulty).toBe('medium');
    // Thursday 2026-06-25 (getDay 4, 3..5) → hard
    jest.setSystemTime(new Date(2026, 5, 25, 12, 0, 0));
    expect(getDailyChallenge().difficulty).toBe('hard');
    // Saturday 2026-06-27 (getDay 6) → expert
    jest.setSystemTime(new Date(2026, 5, 27, 12, 0, 0));
    expect(getDailyChallenge().difficulty).toBe('expert');
    jest.useRealTimers();
  });
});

describe('api URLs (single source of truth)', () => {
  test('prod host + derived API/relay URLs', () => {
    expect(SERVER_URL).toBe('https://api.sallysudo.com');
    expect(API_URL).toBe('https://api.sallysudo.com/api');
    expect(RELAY_WSS).toBe('wss://api.sallysudo.com/api/youtube/ingest');
  });
});
