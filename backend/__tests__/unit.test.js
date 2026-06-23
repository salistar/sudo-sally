process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-for-jest-unit';
process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'test-secret';

const yt = require('../src/services/youtubeService');
const { _test: chal } = require('../src/controllers/challengeController');
const { _test: game } = require('../src/controllers/gameController');
const isValid = game.isCompleteValidSudoku;

// ============ youtubeService: AES-256-GCM token encryption ============
describe('youtubeService encrypt/decrypt', () => {
  test('round-trips a refresh token', () => {
    const token = 'ya29.sample-refresh-token-1234567890';
    expect(yt.decrypt(yt.encrypt(token))).toBe(token);
  });
  test('encrypt(null)/decrypt(garbage) → null (no throw)', () => {
    expect(yt.encrypt(null)).toBeNull();
    expect(yt.decrypt(null)).toBeNull();
    expect(yt.decrypt('')).toBeNull();
    expect(yt.decrypt('garbage-without-colons')).toBeNull();
  });
  test('tampered ciphertext is rejected by the GCM auth tag', () => {
    const enc = yt.encrypt('a-secret-value');
    const parts = enc.split(':');
    const last = parts[parts.length - 1];
    parts[parts.length - 1] = last.slice(0, -1) + (last.endsWith('a') ? 'b' : 'a');
    expect(yt.decrypt(parts.join(':'))).toBeNull();
  });
});

// ============ generateSudokuPuzzle ============
describe('generateSudokuPuzzle', () => {
  for (const [diff, count] of [['easy', 35], ['medium', 45], ['hard', 55]]) {
    test(`${diff} → removes ${count} cells and a valid solution`, () => {
      const { puzzle, solution } = chal.generateSudokuPuzzle(diff);
      expect(solution.length).toBe(9);
      expect(isValid(solution)).toBe(true);
      expect(puzzle.flat().filter((c) => c === 0).length).toBe(count);
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++)
        if (puzzle[r][c] !== 0) expect(puzzle[r][c]).toBe(solution[r][c]);
    });
  }
  test('unknown difficulty defaults to 45 removed', () => {
    expect(chal.generateSudokuPuzzle('impossible').puzzle.flat().filter((c) => c === 0).length).toBe(45);
  });
});

// ============ isCompleteValidSudoku ============
describe('isCompleteValidSudoku', () => {
  const sol = chal.generateSudokuPuzzle('easy').solution;
  test('valid full grid → true', () => expect(isValid(sol)).toBe(true));
  test('grid with a zero → false', () => { const g = sol.map((r) => [...r]); g[0][0] = 0; expect(isValid(g)).toBe(false); });
  test('row duplicate → false', () => { const g = sol.map((r) => [...r]); g[0][1] = g[0][0]; expect(isValid(g)).toBe(false); });
  test('non-array → false (no throw)', () => { expect(isValid(null)).toBe(false); expect(isValid(undefined)).toBe(false); });
});

// ============ recordMoves (replay move log) ============
describe('recordMoves', () => {
  const filled = () => Array.from({ length: 9 }, () => [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  test('logs a new non-given cell and flags an error correctly', () => {
    const puzzle = filled(); puzzle[0][0] = 0;       // (0,0) is empty
    const solution = filled();                        // solution (0,0) = 1
    const challenge = { puzzle: JSON.stringify(puzzle), solution: JSON.stringify(solution), startedAt: new Date(), challengerProgress: { board: JSON.stringify(puzzle), moves: [] } };
    const next = puzzle.map((r) => [...r]); next[0][0] = 5;  // wrong value (sol is 1)
    chal.recordMoves(challenge, 'challengerProgress', JSON.stringify(next));
    expect(challenge.challengerProgress.moves.length).toBe(1);
    expect(challenge.challengerProgress.moves[0]).toMatchObject({ value: 5, err: true });
  });
  test('correct value → err:false', () => {
    const puzzle = filled(); puzzle[0][0] = 0;
    const solution = filled();
    const challenge = { puzzle: JSON.stringify(puzzle), solution: JSON.stringify(solution), startedAt: new Date(), challengerProgress: { board: JSON.stringify(puzzle), moves: [] } };
    const next = puzzle.map((r) => [...r]); next[0][0] = 1;  // correct
    chal.recordMoves(challenge, 'challengerProgress', JSON.stringify(next));
    expect(challenge.challengerProgress.moves[0].err).toBe(false);
  });
  test('malformed input → no throw, no moves', () => {
    const challenge = { puzzle: '[]', solution: '[]', challengerProgress: { moves: [] } };
    expect(() => chal.recordMoves(challenge, 'challengerProgress', 'not json')).not.toThrow();
    expect(challenge.challengerProgress.moves.length).toBe(0);
  });
});
