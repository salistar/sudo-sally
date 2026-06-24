/**
 * Covers the sudoku.ts functions not already exercised by sudoku.test.ts:
 * generateSudoku difficulty bands, getHint, isBoardComplete,
 * getPossibleNumbers, createEmptyNotes, autoFillNotes.
 */
import {
  generateSudoku,
  getHint,
  isBoardComplete,
  getPossibleNumbers,
  createEmptyNotes,
  autoFillNotes,
  isValidPlacement,
  Board,
} from '../sudoku';

// A known-valid full solution (each row/col/box has 1-9 once).
const SOLUTION: Board = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3],
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4],
  [2, 8, 7, 4, 1, 9, 6, 3, 5],
  [3, 4, 5, 2, 8, 6, 1, 7, 9],
];

const clone = (b: Board): Board => b.map(r => [...r]);

describe('generateSudoku difficulty bands', () => {
  test.each([
    [1, 'beginner'],
    [5, 'beginner'],
    [6, 'easy'],
    [10, 'easy'],
    [11, 'medium'],
    [15, 'medium'],
    [16, 'hard'],
    [20, 'hard'],
    [21, 'expert'],
    [25, 'expert'],
    [26, 'master'],
    [30, 'master'],
  ])('level %i → %s', (level, difficulty) => {
    const p = generateSudoku(level as number);
    expect(p.difficulty).toBe(difficulty);
    expect(p.level).toBe(level);
  });

  test('puzzle and solution are 9×9 and the puzzle is a subset of the solution', () => {
    const { puzzle, solution } = generateSudoku(1);
    expect(solution).toHaveLength(9);
    expect(puzzle).toHaveLength(9);
    for (let i = 0; i < 9; i++) {
      expect(solution[i]).toHaveLength(9);
      expect(puzzle[i]).toHaveLength(9);
      for (let j = 0; j < 9; j++) {
        // every solution cell is a real digit
        expect(solution[i][j]).toBeGreaterThanOrEqual(1);
        expect(solution[i][j]).toBeLessThanOrEqual(9);
        // every given puzzle cell matches the solution
        if (puzzle[i][j] !== null) expect(puzzle[i][j]).toBe(solution[i][j]);
      }
    }
  });

  test('the generated solution is internally valid', () => {
    const { solution } = generateSudoku(1);
    for (let r = 0; r < 9; r++) {
      expect(new Set(solution[r]).size).toBe(9); // row has 9 distinct
      const col = solution.map(row => row[r]);
      expect(new Set(col).size).toBe(9); // column has 9 distinct
    }
  });
});

describe('getHint', () => {
  test('returns a correct value for an empty cell', () => {
    const puzzle = clone(SOLUTION);
    puzzle[4][4] = null;
    const hint = getHint(puzzle, SOLUTION);
    expect(hint).toEqual({ row: 4, col: 4, value: SOLUTION[4][4] });
  });
  test('always points at an empty cell with the solution value', () => {
    const puzzle = clone(SOLUTION);
    puzzle[0][0] = null;
    puzzle[8][8] = null;
    const hint = getHint(puzzle, SOLUTION)!;
    expect(puzzle[hint.row][hint.col]).toBeNull();
    expect(hint.value).toBe(SOLUTION[hint.row][hint.col]);
  });
  test('returns null when the board has no empty cells', () => {
    expect(getHint(clone(SOLUTION), SOLUTION)).toBeNull();
  });
});

describe('isBoardComplete', () => {
  test('true when board equals the solution', () => {
    expect(isBoardComplete(clone(SOLUTION), SOLUTION)).toBe(true);
  });
  test('false when any cell differs or is empty', () => {
    const wrong = clone(SOLUTION);
    wrong[3][3] = null;
    expect(isBoardComplete(wrong, SOLUTION)).toBe(false);
    const mismatched = clone(SOLUTION);
    mismatched[0][0] = mismatched[0][0] === 1 ? 2 : 1;
    expect(isBoardComplete(mismatched, SOLUTION)).toBe(false);
  });
});

describe('getPossibleNumbers', () => {
  test('an empty board allows all 9 digits in any cell', () => {
    const empty: Board = Array(9).fill(null).map(() => Array(9).fill(null));
    expect(getPossibleNumbers(empty, 0, 0)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
  test('narrows candidates given existing placements', () => {
    const board = clone(SOLUTION);
    board[0][0] = null; // solution here is 5
    const poss = getPossibleNumbers(board, 0, 0);
    // For a valid solution with exactly this cell removed, only 5 fits.
    expect(poss).toEqual([5]);
    expect(isValidPlacement(board, 0, 0, 5)).toBe(true);
  });
});

describe('notes helpers', () => {
  test('createEmptyNotes builds a 9×9 grid of empty Sets', () => {
    const notes = createEmptyNotes();
    expect(notes).toHaveLength(9);
    for (let i = 0; i < 9; i++) {
      expect(notes[i]).toHaveLength(9);
      for (let j = 0; j < 9; j++) {
        expect(notes[i][j]).toBeInstanceOf(Set);
        expect(notes[i][j].size).toBe(0);
      }
    }
  });
  test('the empty Sets are independent instances (no shared reference)', () => {
    const notes = createEmptyNotes();
    notes[0][0].add(5);
    expect(notes[0][1].size).toBe(0);
    expect(notes[1][0].size).toBe(0);
  });
  test('autoFillNotes fills candidates for empty cells only', () => {
    const board = clone(SOLUTION);
    board[0][0] = null; // only 5 fits
    board[4][4] = null; // only its solution value fits
    const notes = autoFillNotes(board);
    expect([...notes[0][0]]).toEqual([5]);
    expect([...notes[4][4]]).toEqual([SOLUTION[4][4]]);
    // a filled cell gets no notes
    expect(notes[1][1].size).toBe(0);
  });
});
