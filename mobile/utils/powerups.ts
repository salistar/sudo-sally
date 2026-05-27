// Power-ups System - Feature #23
export interface PowerUp {
  id: string;
  name: string;
  description: string;
  icon: string;
  price: number;
  quantity: number;
}

export const POWERUPS: PowerUp[] = [
  { id: 'hint', name: 'Extra Hint', description: 'Reveals one cell', icon: '💡', price: 20, quantity: 0 },
  { id: 'freeze', name: 'Time Freeze', description: 'Stops timer for 30s', icon: '❄️', price: 30, quantity: 0 },
  { id: 'check', name: 'Check Board', description: 'Highlights all errors', icon: '🔍', price: 25, quantity: 0 },
  { id: 'undo_all', name: 'Full Undo', description: 'Reset to start', icon: '⏪', price: 15, quantity: 0 },
  { id: 'auto_notes', name: 'Auto Notes', description: 'Fill all possible notes', icon: '📝', price: 40, quantity: 0 },
  { id: 'skip', name: 'Skip Level', description: 'Unlock next level', icon: '⏭️', price: 100, quantity: 0 },
];
