import { isValidPlacement, isBoardComplete, getPossibleNumbers, generateSudoku } from '../sudoku';

const emptyBoard = (): (number | null)[][] => Array.from({ length: 9 }, () => Array(9).fill(null));

describe('isValidPlacement', () => {
  test('legal placement on an empty board → true', () => {
    expect(isValidPlacement(emptyBoard(), 0, 0, 5)).toBe(true);
  });
  test('row duplicate → false', () => {
    const b = emptyBoard(); b[0][4] = 5;
    expect(isValidPlacement(b, 0, 0, 5)).toBe(false);
  });
  test('column duplicate → false', () => {
    const b = emptyBoard(); b[4][0] = 5;
    expect(isValidPlacement(b, 0, 0, 5)).toBe(false);
  });
  test('3x3 box duplicate → false', () => {
    const b = emptyBoard(); b[1][1] = 5;
    expect(isValidPlacement(b, 0, 0, 5)).toBe(false);
  });
});

describe('generateSudoku', () => {
  test('produces a 9x9 puzzle and a complete valid solution', () => {
    const { puzzle, solution } = generateSudoku(1);
    expect(solution.length).toBe(9);
    expect(solution.every((r) => r.length === 9 && r.every((c) => c! >= 1 && c! <= 9))).toBe(true);
    expect(isBoardComplete(solution, solution)).toBe(true);
    // every clue in the puzzle matches the solution
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++)
      if (puzzle[r][c] !== null) expect(puzzle[r][c]).toBe(solution[r][c]);
  });
});

describe('isBoardComplete', () => {
  const { solution } = generateSudoku(1);
  test('identical board → true', () => expect(isBoardComplete(solution, solution)).toBe(true));
  test('one wrong cell → false', () => {
    const b = solution.map((r) => [...r]); b[0][0] = (b[0][0]! % 9) + 1;
    expect(isBoardComplete(b, solution)).toBe(false);
  });
  test('a null cell → false', () => {
    const b = solution.map((r) => [...r]); b[3][3] = null;
    expect(isBoardComplete(b, solution)).toBe(false);
  });
});

describe('getPossibleNumbers', () => {
  test('empty cell on an empty board → all 9 candidates', () => {
    expect(getPossibleNumbers(emptyBoard(), 0, 0).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});
