import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

type Handlers = {
  selected: { row: number; col: number } | null;
  setSelected: (s: { row: number; col: number }) => void;
  onNumber: (n: number) => void;
  onErase: () => void;
  onHint?: () => void;
  onUndo?: () => void;
  onToggleNotes?: () => void;
  enabled?: boolean;   // false while paused / result shown — ignore keys
};

export function useBoardKeyboard(h: Handlers) {
  const ref = useRef(h);
  ref.current = h;
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const cur = ref.current;
      if (cur.enabled === false) return;
      // don't hijack typing in inputs/textareas (chat box etc.)
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const sel = cur.selected;
      const move = (dr: number, dc: number) => {
        const r = sel ? sel.row : 0, c = sel ? sel.col : 0;
        const nr = Math.max(0, Math.min(8, r + dr));
        const nc = Math.max(0, Math.min(8, c + dc));
        cur.setSelected({ row: nr, col: nc });
      };
      switch (e.key) {
        case 'ArrowUp': move(-1, 0); e.preventDefault(); break;
        case 'ArrowDown': move(1, 0); e.preventDefault(); break;
        case 'ArrowLeft': move(0, -1); e.preventDefault(); break;
        case 'ArrowRight': move(0, 1); e.preventDefault(); break;
        case 'Backspace': case 'Delete': case '0': cur.onErase(); e.preventDefault(); break;
        case 'h': case 'H': cur.onHint?.(); break;
        case 'u': case 'U': cur.onUndo?.(); break;
        case 'n': case 'N': cur.onToggleNotes?.(); break;
        default:
          if (e.key >= '1' && e.key <= '9') { cur.onNumber(parseInt(e.key, 10)); e.preventDefault(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}
