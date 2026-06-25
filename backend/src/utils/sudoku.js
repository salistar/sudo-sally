/**
 * Shared Sudoku helpers (server-side).
 * - generateSudoku(difficulty) → a REAL puzzle + its solution (was a stub on the
 *   daily route that returned an empty grid / all-1s solution).
 * - isCompleteValidSudoku(board) → true iff `board` is a complete, valid solved
 *   grid (every row/col/3x3 box holds 1-9 exactly once). Lets us reject a fake
 *   daily completion without holding the original puzzle.
 */

// Randomized backtracking → a full valid 9x9 solution.
function generateSolution() {
  const grid = Array.from({ length: 9 }, () => Array(9).fill(0));
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const ok = (r, c, n) => {
    for (let i = 0; i < 9; i++) { if (grid[r][i] === n || grid[i][c] === n) return false; }
    const br = r - (r % 3), bc = c - (c % 3);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (grid[br + i][bc + j] === n) return false;
    return true;
  };
  const fill = (pos) => {
    if (pos === 81) return true;
    const r = Math.floor(pos / 9), c = pos % 9;
    for (const n of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (ok(r, c, n)) { grid[r][c] = n; if (fill(pos + 1)) return true; grid[r][c] = 0; }
    }
    return false;
  };
  fill(0);
  return grid;
}

const CLUES = { easy: [40, 45], medium: [32, 36], hard: [28, 31], expert: [24, 27] };

// Remove cells (set to 0) down to a clue count for the difficulty.
function createPuzzle(solution, difficulty) {
  const puzzle = solution.map((r) => [...r]);
  const [minC, maxC] = CLUES[difficulty] || CLUES.medium;
  const target = minC + Math.floor(Math.random() * (maxC - minC + 1));
  let toRemove = 81 - target;
  const cells = Array.from({ length: 81 }, (_, i) => i);
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  for (const idx of cells) {
    if (toRemove <= 0) break;
    const r = Math.floor(idx / 9), c = idx % 9;
    if (puzzle[r][c] !== 0) { puzzle[r][c] = 0; toRemove--; }
  }
  return puzzle;
}

function generateSudoku(difficulty = 'medium') {
  const solution = generateSolution();
  const puzzle = createPuzzle(solution, difficulty);
  return { puzzle, solution, difficulty };
}

// Accepts a 9x9 array or an 81-char string; true iff a complete valid solution.
function isCompleteValidSudoku(board) {
  let grid;
  try {
    if (typeof board === 'string') {
      if (board.length !== 81) return false;
      grid = Array.from({ length: 9 }, (_, r) => board.slice(r * 9, r * 9 + 9).split('').map(Number));
    } else { grid = board; }
  } catch (_) { return false; }
  if (!Array.isArray(grid) || grid.length !== 9) return false;
  const has123456789 = (nums) => {
    const seen = new Set();
    for (const n of nums) { if (!Number.isInteger(n) || n < 1 || n > 9) return false; seen.add(n); }
    return seen.size === 9;
  };
  for (let r = 0; r < 9; r++) {
    if (!Array.isArray(grid[r]) || grid[r].length !== 9) return false;
    if (!has123456789(grid[r].map(Number))) return false;
  }
  for (let c = 0; c < 9; c++) if (!has123456789(grid.map((row) => Number(row[c])))) return false;
  for (let br = 0; br < 9; br += 3) for (let bc = 0; bc < 9; bc += 3) {
    const box = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) box.push(Number(grid[br + r][bc + c]));
    if (!has123456789(box)) return false;
  }
  return true;
}

module.exports = { generateSudoku, generateSolution, createPuzzle, isCompleteValidSudoku };
