// Tutorial System - Feature #24
export interface TutorialStep {
  id: number;
  title: string;
  description: string;
  highlight: 'board' | 'numpad' | 'tools' | 'stats' | null;
  action: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  { id: 1, title: 'Welcome to Sudoku!', description: 'Let me show you how to play.', highlight: null, action: 'next' },
  { id: 2, title: 'The Board', description: 'Fill in numbers 1-9 in each row, column, and 3x3 box.', highlight: 'board', action: 'next' },
  { id: 3, title: 'Select a Cell', description: 'Tap any empty cell to select it.', highlight: 'board', action: 'tap_cell' },
  { id: 4, title: 'Enter a Number', description: 'Use the number pad to fill in your answer.', highlight: 'numpad', action: 'tap_number' },
  { id: 5, title: 'Use Notes', description: 'Toggle Notes mode to mark possible numbers.', highlight: 'tools', action: 'next' },
  { id: 6, title: 'Get Hints', description: 'Stuck? Use hints to reveal a cell (limited per game).', highlight: 'tools', action: 'next' },
  { id: 7, title: 'Watch Your Errors', description: '3 mistakes and the game is over!', highlight: 'stats', action: 'next' },
  { id: 8, title: 'Ready to Play!', description: 'Good luck and have fun!', highlight: null, action: 'finish' },
];
