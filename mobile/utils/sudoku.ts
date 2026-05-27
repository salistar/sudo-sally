// Sudoku Generator with multiple difficulty levels
export type Board = (number | null)[][];
export type Notes = Set<number>[][];

export interface SudokuPuzzle {
  puzzle: Board;
  solution: Board;
  difficulty: string;
  level: number;
}

// Difficulty settings: [minClues, maxClues]
const DIFFICULTY_CLUES: Record<string, [number, number]> = {
  beginner: [45, 50], // Very easy
  easy: [36, 44],
  medium: [32, 35],
  hard: [28, 31],
  expert: [24, 27],
  master: [17, 23], // Minimum possible is 17
};

// Generate empty board
const createEmptyBoard = (): Board => 
  Array(9).fill(null).map(() => Array(9).fill(null));

// Check if number is valid in position
export const isValidPlacement = (board: Board, row: number, col: number, num: number): boolean => {
  // Check row
  for (let i = 0; i < 9; i++) {
    if (board[row][i] === num) return false;
  }
  
  // Check column
  for (let i = 0; i < 9; i++) {
    if (board[i][col] === num) return false;
  }
  
  // Check 3x3 box
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (board[boxRow + i][boxCol + j] === num) return false;
    }
  }
  
  return true;
};

// Shuffle array
const shuffle = <T>(array: T[]): T[] => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// Solve sudoku using backtracking
const solve = (board: Board): boolean => {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col] === null) {
        const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        for (const num of nums) {
          if (isValidPlacement(board, row, col, num)) {
            board[row][col] = num;
            if (solve(board)) return true;
            board[row][col] = null;
          }
        }
        return false;
      }
    }
  }
  return true;
};

// Count solutions (for uniqueness check)
const countSolutions = (board: Board, limit: number = 2): number => {
  let count = 0;
  
  const solveCount = (b: Board): void => {
    if (count >= limit) return;
    
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (b[row][col] === null) {
          for (let num = 1; num <= 9; num++) {
            if (isValidPlacement(b, row, col, num)) {
              b[row][col] = num;
              solveCount(b);
              b[row][col] = null;
            }
          }
          return;
        }
      }
    }
    count++;
  };
  
  const boardCopy = board.map(row => [...row]);
  solveCount(boardCopy);
  return count;
};

// Generate a complete valid sudoku
const generateSolution = (): Board => {
  const board = createEmptyBoard();
  solve(board);
  return board;
};

// Remove numbers to create puzzle
const createPuzzle = (solution: Board, difficulty: string): Board => {
  const puzzle = solution.map(row => [...row]);
  const [minClues, maxClues] = DIFFICULTY_CLUES[difficulty] || DIFFICULTY_CLUES.medium;
  const targetClues = minClues + Math.floor(Math.random() * (maxClues - minClues + 1));
  const cellsToRemove = 81 - targetClues;
  
  // Get all cell positions and shuffle
  const positions: [number, number][] = [];
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      positions.push([i, j]);
    }
  }
  const shuffledPositions = shuffle(positions);
  
  let removed = 0;
  for (const [row, col] of shuffledPositions) {
    if (removed >= cellsToRemove) break;
    
    const backup = puzzle[row][col];
    puzzle[row][col] = null;
    
    // Check if puzzle still has unique solution
    if (countSolutions(puzzle) !== 1) {
      puzzle[row][col] = backup; // Restore if not unique
    } else {
      removed++;
    }
  }
  
  return puzzle;
};

// Main generator function
export const generateSudoku = (level: number): SudokuPuzzle => {
  let difficulty: string;
  if (level <= 5) difficulty = 'beginner';
  else if (level <= 10) difficulty = 'easy';
  else if (level <= 15) difficulty = 'medium';
  else if (level <= 20) difficulty = 'hard';
  else if (level <= 25) difficulty = 'expert';
  else difficulty = 'master';
  
  const solution = generateSolution();
  const puzzle = createPuzzle(solution, difficulty);
  
  return { puzzle, solution, difficulty, level };
};

// Get hint for a cell
export const getHint = (puzzle: Board, solution: Board): { row: number; col: number; value: number } | null => {
  const emptyCells: { row: number; col: number }[] = [];
  
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (puzzle[i][j] === null) {
        emptyCells.push({ row: i, col: j });
      }
    }
  }
  
  if (emptyCells.length === 0) return null;
  
  const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  return {
    row: randomCell.row,
    col: randomCell.col,
    value: solution[randomCell.row][randomCell.col]!,
  };
};

// Check if board is complete
export const isBoardComplete = (board: Board, solution: Board): boolean => {
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (board[i][j] !== solution[i][j]) return false;
    }
  }
  return true;
};

// Get possible numbers for a cell
export const getPossibleNumbers = (board: Board, row: number, col: number): number[] => {
  const possible: number[] = [];
  for (let num = 1; num <= 9; num++) {
    if (isValidPlacement(board, row, col, num)) {
      possible.push(num);
    }
  }
  return possible;
};

// Create empty notes grid
export const createEmptyNotes = (): Notes => 
  Array(9).fill(null).map(() => 
    Array(9).fill(null).map(() => new Set<number>())
  );

// Auto-fill notes for empty cells
export const autoFillNotes = (board: Board): Notes => {
  const notes = createEmptyNotes();
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (board[i][j] === null) {
        const possible = getPossibleNumbers(board, i, j);
        possible.forEach(n => notes[i][j].add(n));
      }
    }
  }
  return notes;
};
