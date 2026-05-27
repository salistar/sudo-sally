// Theme System - Feature #21
export interface Theme {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  background: [string, string, string];
  cell: string;
  cellSelected: string;
  text: string;
  accent: string;
  locked: boolean;
  price: number;
}

export const THEMES: Theme[] = [
  { id: 'default', name: 'Classic Green', primary: '#4ade80', secondary: '#22c55e', background: ['#0a0a1a', '#1a1a3a', '#0f0f2a'], cell: 'rgba(255,255,255,0.05)', cellSelected: 'rgba(59,130,246,0.4)', text: '#fff', accent: '#4ade80', locked: false, price: 0 },
  { id: 'ocean', name: 'Ocean Blue', primary: '#3b82f6', secondary: '#2563eb', background: ['#0a1628', '#1e3a5f', '#0f2744'], cell: 'rgba(59,130,246,0.1)', cellSelected: 'rgba(59,130,246,0.4)', text: '#fff', accent: '#60a5fa', locked: false, price: 0 },
  { id: 'sunset', name: 'Sunset Orange', primary: '#f97316', secondary: '#ea580c', background: ['#1a0a0a', '#3a1a1a', '#2a0f0f'], cell: 'rgba(249,115,22,0.1)', cellSelected: 'rgba(249,115,22,0.3)', text: '#fff', accent: '#fb923c', locked: true, price: 100 },
  { id: 'purple', name: 'Royal Purple', primary: '#a855f7', secondary: '#9333ea', background: ['#0f0a1a', '#1f1a3a', '#150f2a'], cell: 'rgba(168,85,247,0.1)', cellSelected: 'rgba(168,85,247,0.3)', text: '#fff', accent: '#c084fc', locked: true, price: 150 },
  { id: 'gold', name: 'Golden', primary: '#eab308', secondary: '#ca8a04', background: ['#1a1a0a', '#3a3a1a', '#2a2a0f'], cell: 'rgba(234,179,8,0.1)', cellSelected: 'rgba(234,179,8,0.3)', text: '#fff', accent: '#fbbf24', locked: true, price: 200 },
  { id: 'neon', name: 'Neon Nights', primary: '#f0abfc', secondary: '#e879f9', background: ['#0a0a1a', '#1a0a2a', '#0f0a1f'], cell: 'rgba(240,171,252,0.1)', cellSelected: 'rgba(240,171,252,0.3)', text: '#fff', accent: '#f0abfc', locked: true, price: 300 },
];
