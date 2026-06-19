import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal, ScrollView, Platform, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { generateSudoku, isValidPlacement, isBoardComplete, getHint, Board } from '../utils/sudoku';
import { storage, formatTime, calculateStars, calculateXP, type Achievement } from '../utils/storage';
import { useLang } from '../utils/LanguageContext';
import { useBoardKeyboard } from '../utils/useBoardKeyboard';
import * as Haptics from 'expo-haptics';
import ConfettiCannon from 'react-native-confetti-cannon';

const FILE_NAME = '📁 [Game.tsx]';

// Gap between numpad buttons (also used inside styles below).
const NUM_GAP = 6;

export default function Game() {
  console.log(`${FILE_NAME} 🚀 Component mounting...`);
  
  const { level } = useLocalSearchParams<{ level: string }>();
  const router = useRouter();
  const { t, lang } = useLang() as any;
  const levelNum = parseInt(level || '1');

  // v3.9.0 — responsive sizing. The previous Dimensions.get('window') at module
  // scope froze the cell size at JS-load time. On desktop web that produced a
  // huge board sized for the FULL window — ignoring the 260 px sidebar — and
  // never reflowed when the window changed. useWindowDimensions re-renders on
  // resize, so the board adapts to the actual content area.
  const { width: winW, height: winH } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && winW >= 1024;
  // Effective inner area inside WebShell (sidebar 260 + paddings ~96 px).
  // Capped to keep the board from dominating a 4K monitor.
  const BOARD_W = isDesktopWeb
    ? Math.min(540, Math.max(420, winH - 220))
    : winW - 32;
  const CELL = Math.floor((BOARD_W - 16) / 9);
  // Numpad: 1 row on phone, 3×3 grid on desktop.
  const NUM_BTN = isDesktopWeb ? 76 : Math.floor((winW - 36 - NUM_GAP * 8) / 9);
  
  console.log(`${FILE_NAME} 📊 Route params - level: ${level}, parsed levelNum: ${levelNum}`);
  
  const [board, setBoard] = useState<Board>([]);
  const [solution, setSolution] = useState<Board>([]);
  const [initial, setInitial] = useState<boolean[][]>([]);
  const [selected, setSelected] = useState<{row: number; col: number} | null>(null);
  const [errors, setErrors] = useState(0);
  const [hints, setHints] = useState(3);
  const [time, setTime] = useState(0);
  const [paused, setPaused] = useState(false);
  const [notesMode, setNotesMode] = useState(false);
  const [notes, setNotes] = useState<Set<number>[][]>([]);
  const [history, setHistory] = useState<{board: Board; row: number; col: number}[]>([]);
  const [result, setResult] = useState<{ type: 'win' | 'gameover'; time: number; stars: number; xp: number; leveledUpTo?: number; unlocked?: Achievement[] } | null>(null);
  const timerRef = useRef<NodeJS.Timeout>();

  console.log(`${FILE_NAME} 📊 State initialized - errors: ${errors}, hints: ${hints}, time: ${time}, paused: ${paused}, notesMode: ${notesMode}`);

  const getDifficulty = useCallback((lvl: number): string => {
    if (lvl <= 5) return 'beginner';
    if (lvl <= 10) return 'easy';
    if (lvl <= 15) return 'medium';
    if (lvl <= 20) return 'hard';
    if (lvl <= 25) return 'expert';
    return 'master';
  }, []);

  const getDifficultyColor = useCallback((difficulty: string): readonly [string, string] => {
    switch (difficulty) {
      case 'beginner': return ['#4ade80', '#22c55e'] as const;
      case 'easy': return ['#60a5fa', '#3b82f6'] as const;
      case 'medium': return ['#fbbf24', '#f59e0b'] as const;
      case 'hard': return ['#f97316', '#ea580c'] as const;
      case 'expert': return ['#f87171', '#ef4444'] as const;
      case 'master': return ['#a78bfa', '#8b5cf6'] as const;
      default: return ['#4ade80', '#22c55e'] as const;
    }
  }, []);

  useEffect(() => {
    console.log(`${FILE_NAME} 🔧 useEffect() - Initializing game for level ${levelNum}...`);
    
    const difficulty = getDifficulty(levelNum);
    console.log(`${FILE_NAME} 🎯 useEffect() - Difficulty: ${difficulty}`);
    
    console.log(`${FILE_NAME} 🧩 useEffect() - Generating sudoku puzzle...`);
    const puzzle = generateSudoku(levelNum);
    console.log(`${FILE_NAME} ✅ useEffect() - Puzzle generated successfully`);
    
    setBoard(puzzle.puzzle);
    setSolution(puzzle.solution);
    setInitial(puzzle.puzzle.map(row => row.map(cell => cell !== null)));
    setNotes(Array(9).fill(null).map(() => Array(9).fill(null).map(() => new Set())));
    
    console.log(`${FILE_NAME} ⏱️ useEffect() - Starting game timer...`);
    timerRef.current = setInterval(() => {
      if (!paused) setTime(t => t + 1);
    }, 1000);
    
    return () => {
      console.log(`${FILE_NAME} 🧹 useEffect() cleanup - Clearing timer`);
      clearInterval(timerRef.current);
    };
  }, [levelNum, getDifficulty]);

  const handleCell = (row: number, col: number) => {
    console.log(`${FILE_NAME} 👆 handleCell() - Cell tapped at [${row}][${col}]`);
    
    if (!initial[row]?.[col]) {
      console.log(`${FILE_NAME} ✅ handleCell() - Cell is editable, selecting...`);
      setSelected({ row, col });
      Haptics.selectionAsync();
    } else {
      console.log(`${FILE_NAME} 🚫 handleCell() - Cell is initial/locked, ignoring`);
    }
  };

  const handleNumber = (num: number) => {
    console.log(`${FILE_NAME} 🔢 handleNumber() - Number ${num} pressed`);
    
    if (!selected || paused) {
      console.log(`${FILE_NAME} ⚠️ handleNumber() - No cell selected or game paused, ignoring`);
      return;
    }
    
    const { row, col } = selected;
    console.log(`${FILE_NAME} 📍 handleNumber() - Target cell: [${row}][${col}]`);
    
    if (initial[row][col]) {
      console.log(`${FILE_NAME} 🚫 handleNumber() - Cell is initial/locked, ignoring`);
      return;
    }

    if (notesMode) {
      console.log(`${FILE_NAME} 📝 handleNumber() - Notes mode active, toggling note ${num}`);
      const newNotes = notes.map(r => r.map(c => new Set(c)));
      if (newNotes[row][col].has(num)) {
        newNotes[row][col].delete(num);
        console.log(`${FILE_NAME} ➖ handleNumber() - Removed note ${num}`);
      } else {
        newNotes[row][col].add(num);
        console.log(`${FILE_NAME} ➕ handleNumber() - Added note ${num}`);
      }
      setNotes(newNotes);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }

    console.log(`${FILE_NAME} 💾 handleNumber() - Saving to history...`);
    setHistory([...history, { board: board.map(r => [...r]), row, col }]);
    
    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = num;
    setBoard(newBoard);
    
    // Clear notes for this cell
    const newNotes = notes.map(r => r.map(c => new Set(c)));
    newNotes[row][col].clear();
    setNotes(newNotes);

    const isCorrect = num === solution[row][col];
    console.log(`${FILE_NAME} ${isCorrect ? '✅' : '❌'} handleNumber() - Answer is ${isCorrect ? 'CORRECT' : 'WRONG'} (expected: ${solution[row][col]})`);

    if (!isCorrect) {
      const newErrors = errors + 1;
      setErrors(newErrors);
      console.log(`${FILE_NAME} 💥 handleNumber() - Error count: ${newErrors}/3`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      if (newErrors >= 3) {
        console.log(`${FILE_NAME} 💀 handleNumber() - GAME OVER! Too many errors`);
        clearInterval(timerRef.current);
        setResult({ type: 'gameover', time, stars: 0, xp: 0 });
      }
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      if (isBoardComplete(newBoard, solution)) {
        console.log(`${FILE_NAME} 🎉 handleNumber() - PUZZLE COMPLETE!`);
        clearInterval(timerRef.current);
        handleWin();
      }
    }
  };

  const handleWin = async () => {
    console.log(`${FILE_NAME} 🏆 handleWin() - Processing victory...`);
    
    const difficulty = getDifficulty(levelNum);
    console.log(`${FILE_NAME} 📊 handleWin() - Difficulty: ${difficulty}, Time: ${time}s, Errors: ${errors}`);
    
    const stars = calculateStars(time, difficulty, errors);
    const xp = calculateXP(stars, difficulty);
    console.log(`${FILE_NAME} ⭐ handleWin() - Stars earned: ${stars}, XP earned: ${xp}`);
    
    console.log(`${FILE_NAME} 💾 handleWin() - Saving level progress...`);
    await storage.updateLevel(levelNum, { completed: true, stars, bestTime: time, hintsUsed: 3 - hints });
    
    console.log(`${FILE_NAME} 📈 handleWin() - Updating stats...`);
    const stats = await storage.getStats();
    await storage.updateStats({
      gamesPlayed: stats.gamesPlayed + 1,
      gamesWon: stats.gamesWon + 1,
      totalTime: stats.totalTime + time,
      currentStreak: stats.currentStreak + 1,
      bestStreak: Math.max(stats.bestStreak, stats.currentStreak + 1),
      perfectGames: errors === 0 ? stats.perfectGames + 1 : stats.perfectGames,
    });
    console.log(`${FILE_NAME} ✅ handleWin() - Stats updated`);
    
    console.log(`${FILE_NAME} 👤 handleWin() - Updating user profile...`);
    const user = await storage.getUser();
    // sprint-23 — detect a level-up by comparing the derived level (floor(xp/100)+1)
    // before vs after the XP gain, so we can celebrate crossing a 100-XP boundary.
    let leveledUpTo: number | undefined;
    if (user) {
      const prevLevel = Math.floor((user.xp || 0) / 100) + 1;
      user.xp += xp;
      user.stars += stars;
      user.coins += stars * 10;
      const newLevel = Math.floor(user.xp / 100) + 1;
      if (newLevel > prevLevel) leveledUpTo = newLevel;
      await storage.setUser(user);
      console.log(`${FILE_NAME} ✅ handleWin() - User now has ${user.xp} XP, ${user.stars} stars, ${user.coins} coins${leveledUpTo ? ` — LEVEL UP to ${leveledUpTo}` : ''}`);
    }

    // sprint-24 — evaluate achievement conditions now that stats/user/levels
    // are updated, and unlock any that just hit their target. This is the first
    // place achievements actually unlock at runtime.
    let unlocked: Achievement[] = [];
    try {
      unlocked = await storage.checkAchievements({ win: true, timeThisGame: time, hintsThisGame: 3 - hints });
      // On web, also surface each unlock as a global toast (ToastHost seam).
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        unlocked.forEach(a => window.dispatchEvent(new CustomEvent('sally-toast', {
          detail: { kind: 'achievement', name: a.title?.[lang] || a.title?.en, icon: a.icon },
        })));
      }
    } catch (e) { console.log(`${FILE_NAME} achievement check failed`, e); }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setResult({ type: 'win', time, stars, xp, leveledUpTo, unlocked });
  };

  const handleHint = () => {
    console.log(`${FILE_NAME} 💡 handleHint() - Hint requested, remaining: ${hints}`);
    
    if (hints <= 0) {
      console.log(`${FILE_NAME} ⚠️ handleHint() - No hints remaining`);
      return;
    }
    if (paused) {
      console.log(`${FILE_NAME} ⚠️ handleHint() - Game is paused`);
      return;
    }
    
    const hint = getHint(board, solution);
    if (hint) {
      console.log(`${FILE_NAME} ✅ handleHint() - Hint found: [${hint.row}][${hint.col}] = ${hint.value}`);
      setHistory([...history, { board: board.map(r => [...r]), row: hint.row, col: hint.col }]);
      const newBoard = board.map(r => [...r]);
      newBoard[hint.row][hint.col] = hint.value;
      setBoard(newBoard);
      setHints(h => h - 1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      if (isBoardComplete(newBoard, solution)) {
        clearInterval(timerRef.current);
        handleWin();
      }
    } else {
      console.log(`${FILE_NAME} ⚠️ handleHint() - No hint available`);
    }
  };

  // Unlimited "reveal one cell" — fills a correct number on each press until solved.
  const handleReveal = () => {
    console.log(`${FILE_NAME} 🪄 handleReveal() - Reveal one cell`);
    if (paused) return;
    const hint = getHint(board, solution);
    if (!hint) {
      console.log(`${FILE_NAME} ⚠️ handleReveal() - Board already full`);
      return;
    }
    setHistory([...history, { board: board.map(r => [...r]), row: hint.row, col: hint.col }]);
    const newBoard = board.map(r => [...r]);
    newBoard[hint.row][hint.col] = hint.value;
    setBoard(newBoard);
    // clear notes for that cell
    const newNotes = notes.map(r => r.map(c => new Set(c)));
    newNotes[hint.row][hint.col].clear();
    setNotes(newNotes);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isBoardComplete(newBoard, solution)) {
      console.log(`${FILE_NAME} 🎉 handleReveal() - PUZZLE COMPLETE!`);
      clearInterval(timerRef.current);
      handleWin();
    }
  };

  const handleUndo = () => {
    console.log(`${FILE_NAME} ↩️ handleUndo() - Undo requested, history length: ${history.length}`);
    
    if (history.length === 0) {
      console.log(`${FILE_NAME} ⚠️ handleUndo() - Nothing to undo`);
      return;
    }
    
    const last = history[history.length - 1];
    console.log(`${FILE_NAME} ✅ handleUndo() - Restoring previous state at [${last.row}][${last.col}]`);
    setBoard(last.board);
    setHistory(history.slice(0, -1));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleErase = () => {
    console.log(`${FILE_NAME} 🧹 handleErase() - Erase requested`);
    
    if (!selected) {
      console.log(`${FILE_NAME} ⚠️ handleErase() - No cell selected`);
      return;
    }
    if (initial[selected.row][selected.col]) {
      console.log(`${FILE_NAME} 🚫 handleErase() - Cannot erase initial cell`);
      return;
    }
    
    console.log(`${FILE_NAME} ✅ handleErase() - Erasing cell [${selected.row}][${selected.col}]`);
    setHistory([...history, { board: board.map(r => [...r]), row: selected.row, col: selected.col }]);
    const newBoard = board.map(r => [...r]);
    newBoard[selected.row][selected.col] = null;
    setBoard(newBoard);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePause = () => {
    console.log(`${FILE_NAME} ⏸️ handlePause() - Pausing game`);
    setPaused(true);
  };

  const handleResume = () => {
    console.log(`${FILE_NAME} ▶️ handleResume() - Resuming game`);
    setPaused(false);
  };

  const handleRestart = () => {
    console.log(`${FILE_NAME} 🔄 handleRestart() - Restarting level ${levelNum}`);
    router.replace(`/game?level=${levelNum}`);
  };

  const handleQuit = () => {
    console.log(`${FILE_NAME} 🏠 handleQuit() - Quitting to levels menu`);
    router.replace('/levels');
  };

  const handleBack = () => {
    console.log(`${FILE_NAME} 🔙 handleBack() - Navigating back`);
    router.back();
  };

  const toggleNotesMode = () => {
    setNotesMode((prev) => {
      console.log(`${FILE_NAME} 📝 toggleNotesMode() - Notes mode: ${!prev}`);
      return !prev;
    });
  };

  // Web-only keyboard shortcuts (no-op on native). Wired to the existing
  // handlers above; arrows move the selection, 1-9 place, Backspace/Delete/0
  // erase, H = hint, U = undo, N = toggle notes. Ignored while paused or the
  // result modal is up.
  useBoardKeyboard({
    selected,
    setSelected,
    onNumber: handleNumber,
    onErase: handleErase,
    onHint: handleHint,
    onUndo: handleUndo,
    onToggleNotes: toggleNotesMode,
    enabled: !paused && !result,
  });

  console.log(`${FILE_NAME} 🖼️ Rendering - board length: ${board.length}`);

  if (board.length === 0) {
    console.log(`${FILE_NAME} ⏳ Rendering loading state...`);
    return (
      <LinearGradient colors={['#0a0a1a', '#1a1a3a', '#0f0f2a']} style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>🧩 Loading puzzle...</Text>
        </View>
      </LinearGradient>
    );
  }

  const difficulty = getDifficulty(levelNum);
  const difficultyColors = getDifficultyColor(difficulty);

  return (
    <LinearGradient
      colors={['#0a0a1a', '#1a1a3a', '#0f0f2a']}
      style={[styles.container, isDesktopWeb && { paddingTop: 0, paddingHorizontal: 0 }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <LinearGradient
            colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
            style={styles.backButtonGradient}
          >
            <Text style={styles.backIcon}>←</Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.levelContainer}>
          <LinearGradient
            colors={difficultyColors}
            style={styles.levelBadge}
          >
            <Text style={styles.levelText}>{t('level')} {levelNum}</Text>
          </LinearGradient>
          <Text style={styles.difficultyText}>{t(difficulty as any).toUpperCase()}</Text>
        </View>

        <TouchableOpacity onPress={handlePause} style={styles.pauseButton}>
          <LinearGradient
            colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
            style={styles.pauseButtonGradient}
          >
            <Text style={styles.pauseIcon}>⏸️</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* v3.9.0 — desktop web: 2-col layout (board left, control panel right).
          Mobile/narrow: stays a single column. */}
      <View style={isDesktopWeb ? styles.desktopRow : undefined}>
      <View style={isDesktopWeb ? styles.desktopLeftCol : undefined}>
      {/* Stats Bar — horizontal row on phone, vertical column on desktop right pane */}
      <View style={styles.statsBar}>
        <LinearGradient
          colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']}
          style={[styles.statsBarGradient, isDesktopWeb && styles.statsBarGradientDesktop]}
        >
          <View style={[styles.stat, isDesktopWeb && styles.statDesktop]}>
            <Text style={styles.statIcon}>⏱️</Text>
            <Text style={styles.statValue}>{formatTime(time)}</Text>
            <Text style={styles.statLabel}>{t('time').toUpperCase()}</Text>
          </View>

          <View style={[styles.statDivider, isDesktopWeb && styles.statDividerDesktop]} />

          <View style={[styles.stat, isDesktopWeb && styles.statDesktop]}>
            <Text style={styles.statIcon}>❌</Text>
            <Text style={[styles.statValue, errors > 0 && styles.statValueError]}>
              {errors}/3
            </Text>
            <Text style={styles.statLabel}>{t('errors').toUpperCase()}</Text>
          </View>

          <View style={[styles.statDivider, isDesktopWeb && styles.statDividerDesktop]} />

          <View style={[styles.stat, isDesktopWeb && styles.statDesktop]}>
            <Text style={styles.statIcon}>💡</Text>
            <Text style={[styles.statValue, hints === 0 && styles.statValueDisabled]}>
              {hints}
            </Text>
            <Text style={styles.statLabel}>{t('hints').toUpperCase()}</Text>
          </View>
        </LinearGradient>
      </View>

      {/* Board — premium green glow on desktop web */}
      <View
        style={[
          styles.boardContainer,
          isDesktopWeb && ({ boxShadow: '0 0 32px 0 rgba(74,222,128,0.25), 0 8px 40px -6px rgba(0,0,0,0.6)' } as any),
        ]}
      >
        <LinearGradient
          colors={['rgba(74, 222, 128, 0.1)', 'rgba(74, 222, 128, 0.02)']}
          style={styles.boardGradient}
        >
          <View style={styles.board}>
            {board.map((row, i) => (
              <View key={i} style={styles.row}>
                {row.map((cell, j) => {
                  const isSelected = selected?.row === i && selected?.col === j;
                  const isSameNumber = selected && cell !== null && board[selected.row][selected.col] === cell;
                  const isHighlight = selected && (
                    selected.row === i || 
                    selected.col === j || 
                    (Math.floor(selected.row/3) === Math.floor(i/3) && Math.floor(selected.col/3) === Math.floor(j/3))
                  );
                  const isError = cell !== null && cell !== solution[i][j];
                  const cellNotes = notes[i]?.[j];
                  
                  return (
                    <TouchableOpacity
                      key={j}
                      style={[
                        styles.cell,
                        { width: CELL, height: CELL },
                        isHighlight && !isSelected && styles.cellHighlight,
                        isSameNumber && !isSelected && styles.cellSameNumber,
                        isSelected && styles.cellSelected,
                        isError && styles.cellError,
                        j % 3 === 2 && j !== 8 && styles.cellBorderRight,
                        i % 3 === 2 && i !== 8 && styles.cellBorderBottom,
                      ]} 
                      onPress={() => handleCell(i, j)}
                      activeOpacity={0.7}
                    >
                      {cell ? (
                        <Text style={[
                          styles.cellText, 
                          initial[i][j] && styles.cellTextInitial,
                          !initial[i][j] && styles.cellTextUser,
                          isError && styles.cellTextError,
                          isSelected && styles.cellTextSelected,
                        ]}>
                          {cell}
                        </Text>
                      ) : cellNotes && cellNotes.size > 0 ? (
                        <View style={[styles.notesGrid, { width: CELL, height: CELL }]}>
                          {[1,2,3,4,5,6,7,8,9].map(n => (
                            <Text key={n} style={[styles.noteText, { width: CELL / 3, height: CELL / 3, lineHeight: CELL / 3 }]}>
                              {cellNotes.has(n) ? n : ''}
                            </Text>
                          ))}
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </LinearGradient>
      </View>

      </View>
      {/* RIGHT column on desktop, in-flow on mobile */}
      <View style={isDesktopWeb ? styles.desktopRightCol : undefined}>
      {/* Tools */}
      <View style={[styles.toolsContainer, isDesktopWeb && styles.toolsContainerDesktop]}>
        <TouchableOpacity 
          style={[styles.tool, history.length === 0 && styles.toolDisabled]} 
          onPress={handleUndo}
          activeOpacity={0.7}
        >
          <View style={styles.toolIconContainer}>
            <Text style={styles.toolIcon}>↩️</Text>
          </View>
          <Text style={styles.toolText}>{t('undo')}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tool, (!selected || (selected && initial[selected.row][selected.col])) && styles.toolDisabled]} 
          onPress={handleErase}
          activeOpacity={0.7}
        >
          <View style={styles.toolIconContainer}>
            <Text style={styles.toolIcon}>🧹</Text>
          </View>
          <Text style={styles.toolText}>{t('erase')}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tool, notesMode && styles.toolActive]} 
          onPress={toggleNotesMode}
          activeOpacity={0.7}
        >
          <View style={[styles.toolIconContainer, notesMode && styles.toolIconActive]}>
            <Text style={styles.toolIcon}>📝</Text>
          </View>
          <Text style={[styles.toolText, notesMode && styles.toolTextActive]}>{t('notes')}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tool, hints === 0 && styles.toolDisabled]} 
          onPress={handleHint}
          activeOpacity={0.7}
        >
          <View style={[styles.toolIconContainer, hints > 0 && styles.toolIconHint]}>
            <Text style={styles.toolIcon}>💡</Text>
          </View>
          <Text style={styles.toolText}>{t('hint')} ({hints})</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tool}
          onPress={handleReveal}
          activeOpacity={0.7}
        >
          <View style={[styles.toolIconContainer, styles.toolIconReveal]}>
            <Text style={styles.toolIcon}>🪄</Text>
          </View>
          <Text style={styles.toolText}>{t('reveal')}</Text>
        </TouchableOpacity>
      </View>

      {/* Numpad — 1 row on phone, 3×3 grid on desktop web */}
      <View style={[styles.numpadContainer, isDesktopWeb && styles.numpadContainerDesktop]}>
        {[1,2,3,4,5,6,7,8,9].map(num => {
          // Count how many of this number are placed
          const count = board.flat().filter(c => c === num).length;
          const isComplete = count >= 9;
          
          return (
            <TouchableOpacity
              key={num}
              style={[styles.numBtn, { width: NUM_BTN, height: NUM_BTN }, isComplete && styles.numBtnComplete]}
              onPress={() => handleNumber(num)}
              activeOpacity={0.7}
              disabled={isComplete}
            >
              <LinearGradient
                colors={isComplete ? ['rgba(100,100,100,0.2)', 'rgba(100,100,100,0.1)'] : ['rgba(74,222,128,0.25)', 'rgba(74,222,128,0.1)']}
                style={styles.numBtnGradient}
              >
                <Text style={[styles.numText, isComplete && styles.numTextComplete]}>{num}</Text>
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
      </View>
      </View>{/* /right column */}
      </View>{/* /desktop row */}

      </ScrollView>

      {/* Pause Modal */}
      <Modal visible={paused} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <LinearGradient
              colors={['#1e1e3f', '#1a1a3a']}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalIcon}>⏸️</Text>
                <Text style={styles.modalTitle}>{t('pause')}</Text>
              </View>
              
              <View style={styles.modalStats}>
                <View style={styles.modalStatItem}>
                  <Text style={styles.modalStatValue}>{formatTime(time)}</Text>
                  <Text style={styles.modalStatLabel}>{t('time')}</Text>
                </View>
                <View style={styles.modalStatDivider} />
                <View style={styles.modalStatItem}>
                  <Text style={styles.modalStatValue}>{errors}/3</Text>
                  <Text style={styles.modalStatLabel}>{t('errors')}</Text>
                </View>
                <View style={styles.modalStatDivider} />
                <View style={styles.modalStatItem}>
                  <Text style={styles.modalStatValue}>{hints}</Text>
                  <Text style={styles.modalStatLabel}>{t('hints')}</Text>
                </View>
              </View>
              
              <TouchableOpacity style={styles.modalBtnPrimary} onPress={handleResume}>
                <LinearGradient
                  colors={['#4ade80', '#22c55e']}
                  style={styles.modalBtnGradient}
                >
                  <Text style={styles.modalBtnIcon}>▶️</Text>
                  <Text style={styles.modalBtnPrimaryText}>{t('resume')}</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.modalBtnSecondary} onPress={handleRestart}>
                <Text style={styles.modalBtnSecondaryIcon}>🔄</Text>
                <Text style={styles.modalBtnSecondaryText}>{t('restart')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.modalBtnSecondary} onPress={handleQuit}>
                <Text style={styles.modalBtnSecondaryIcon}>🏠</Text>
                <Text style={styles.modalBtnSecondaryText}>{t('quit')}</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* v3.4 — Confetti rain on win. Renders behind the modal card so the
          ★ ★ ★ stars come through. autoStart=true fires immediately when
          the modal mounts. */}
      {result?.type === 'win' && (
        <ConfettiCannon
          count={150}
          origin={{ x: -10, y: 0 }}
          autoStart
          fallSpeed={3500}
          fadeOut
          colors={['#4ade80', '#22c55e', '#fbbf24', '#60a5fa', '#a855f7', '#f97316']}
        />
      )}
      {/* Result Modal — distinct design per type (win / game over) */}
      <Modal visible={!!result} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          {result?.type === 'win' ? (
            <View style={styles.resultContainer}>
              <LinearGradient colors={['#16331f', '#0d2417']} style={[styles.resultCard, styles.resultCardWin]}>
                <View style={styles.resultBadgeWin}>
                  <Text style={styles.resultEmoji}>🏆</Text>
                </View>
                <Text style={styles.resultTitleWin}>{t('levelComplete')}</Text>
                {!!result.leveledUpTo && (
                  <View style={styles.levelUpBanner}>
                    <Text style={styles.levelUpText}>🎉 {t('levelUp')}  ·  {t('level')} {result.leveledUpTo}</Text>
                  </View>
                )}
                <View style={styles.starsRow}>
                  {[1, 2, 3].map((s) => (
                    <Text key={s} style={[styles.bigStar, s > result.stars && styles.bigStarEmpty]}>
                      {s <= result.stars ? '⭐' : '☆'}
                    </Text>
                  ))}
                </View>
                <View style={styles.resultStatsRow}>
                  <View style={styles.resultStat}>
                    <Text style={styles.resultStatValue}>{formatTime(result.time)}</Text>
                    <Text style={styles.resultStatLabel}>{t('time')}</Text>
                  </View>
                  <View style={styles.resultStatDivider} />
                  <View style={styles.resultStat}>
                    <Text style={[styles.resultStatValue, { color: '#4ade80' }]}>+{result.xp}</Text>
                    <Text style={styles.resultStatLabel}>{t('xp')}</Text>
                  </View>
                  <View style={styles.resultStatDivider} />
                  <View style={styles.resultStat}>
                    <Text style={[styles.resultStatValue, { color: '#fbbf24' }]}>+{result.stars * 10}</Text>
                    <Text style={styles.resultStatLabel}>🪙 {t('coins')}</Text>
                  </View>
                </View>
                {!!result.unlocked?.length && (
                  <View style={styles.achUnlockBox}>
                    <Text style={styles.achUnlockTitle}>🏅 {t('achievementUnlocked')}</Text>
                    {result.unlocked.map((a) => (
                      <View key={a.id} style={styles.achUnlockRow}>
                        <Text style={styles.achUnlockIcon}>{a.icon}</Text>
                        <Text style={styles.achUnlockName} numberOfLines={1}>{a.title?.[lang] || a.title?.en}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <TouchableOpacity style={styles.resultBtnPrimary} onPress={() => router.replace(`/game?level=${levelNum + 1}`)}>
                  <LinearGradient colors={['#4ade80', '#22c55e']} style={styles.resultBtnGrad}>
                    <Text style={styles.resultBtnPrimaryText}>▶️  {t('nextLevel')}</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <View style={styles.resultBtnRow}>
                  <TouchableOpacity style={styles.resultBtnSecondary} onPress={() => router.replace(`/game?level=${levelNum}`)}>
                    <Text style={styles.resultBtnSecondaryText}>🔄 {t('replay')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.resultBtnSecondary} onPress={() => router.replace('/levels')}>
                    <Text style={styles.resultBtnSecondaryText}>🏠 {t('menu')}</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </View>
          ) : result?.type === 'gameover' ? (
            <View style={styles.resultContainer}>
              <LinearGradient colors={['#3a1620', '#280f15']} style={[styles.resultCard, styles.resultCardLose]}>
                <View style={styles.resultBadgeLose}>
                  <Text style={styles.resultEmoji}>💀</Text>
                </View>
                <Text style={styles.resultTitleLose}>{t('gameOver')}</Text>
                <Text style={styles.resultSubtitle}>{t('levelFailed')}</Text>
                <View style={styles.resultStatsRow}>
                  <View style={styles.resultStat}>
                    <Text style={styles.resultStatValue}>{formatTime(result.time)}</Text>
                    <Text style={styles.resultStatLabel}>{t('time')}</Text>
                  </View>
                  <View style={styles.resultStatDivider} />
                  <View style={styles.resultStat}>
                    <Text style={[styles.resultStatValue, { color: '#ef4444' }]}>3/3</Text>
                    <Text style={styles.resultStatLabel}>{t('errors')}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.resultBtnPrimary} onPress={() => router.replace(`/game?level=${levelNum}`)}>
                  <LinearGradient colors={['#f97316', '#ef4444']} style={styles.resultBtnGrad}>
                    <Text style={styles.resultBtnPrimaryText}>🔄  {t('retry')}</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.resultBtnSecondary, { alignSelf: 'stretch' }]} onPress={() => router.replace('/levels')}>
                  <Text style={styles.resultBtnSecondaryText}>🏠 {t('menu')}</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          ) : null}
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 50,
  },
  scrollContent: {
    paddingBottom: 48,
  },
  
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#64748b',
    fontSize: 18,
  },
  
  // Header
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
  },
  backButtonGradient: {
    flex: 1,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  backIcon: { 
    color: '#94a3b8', 
    fontSize: 20,
    fontWeight: '600',
  },
  levelContainer: {
    alignItems: 'center',
  },
  levelBadge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 12,
  },
  levelText: { 
    color: '#000', 
    fontSize: 18, 
    fontWeight: '800',
  },
  difficultyText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    letterSpacing: 1,
  },
  pauseButton: {
    width: 44,
    height: 44,
  },
  pauseButtonGradient: {
    flex: 1,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  pauseIcon: { 
    fontSize: 20,
  },
  
  // Stats Bar
  statsBar: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  statsBarGradient: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statIconError: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  statIconDisabled: {
    opacity: 0.4,
  },
  statIcon: {
    fontSize: 22,
  },
  statLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
  },
  statValue: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '800',
  },
  statValueError: {
    color: '#ef4444',
  },
  statValueDisabled: {
    color: '#64748b',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  
  // Board
  boardContainer: {
    alignSelf: 'center',
    borderRadius: 16,
    overflow: 'hidden',
  },
  boardGradient: {
    padding: 8,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  board: { 
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  row: { 
    flexDirection: 'row',
  },
  cell: { 
    width: 38, 
    height: 38, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 0.5, 
    borderColor: 'rgba(100, 116, 139, 0.3)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  cellSelected: {
    // Brighter blue + thin glow ring on the selected cell itself
    backgroundColor: 'rgba(59, 130, 246, 0.65)',
  },
  cellHighlight: {
    // v3.9.1 — bumped 0.15 -> 0.32 so the row/col/box trace is actually visible
    backgroundColor: 'rgba(59, 130, 246, 0.32)',
  },
  cellSameNumber: {
    // v3.9.1 — bumped 0.20 -> 0.38 to make matching-number guidance pop
    backgroundColor: 'rgba(74, 222, 128, 0.38)',
  },
  cellError: { 
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
  },
  cellBorderRight: { 
    borderRightWidth: 2, 
    borderRightColor: 'rgba(74, 222, 128, 0.6)',
  },
  cellBorderBottom: { 
    borderBottomWidth: 2, 
    borderBottomColor: 'rgba(74, 222, 128, 0.6)',
  },
  cellText: { 
    fontSize: 22, 
    fontWeight: '600',
  },
  cellTextInitial: { 
    color: '#94a3b8',
  },
  cellTextUser: {
    color: '#60a5fa',
  },
  cellTextError: { 
    color: '#ef4444',
  },
  cellTextSelected: {
    color: '#fff',
  },
  notesGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    width: 36, 
    height: 36,
  },
  noteText: {
    width: 12,
    height: 12,
    fontSize: 9,
    color: '#93c5fd',
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 12,
  },
  
  // Tools
  toolsContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    marginTop: 20, 
    marginBottom: 16,
  },
  tool: { 
    alignItems: 'center',
  },
  toolDisabled: { 
    opacity: 0.35,
  },
  toolActive: {},
  toolIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  toolIconActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    borderColor: 'rgba(59, 130, 246, 0.5)',
  },
  toolIconHint: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  toolIconReveal: {
    backgroundColor: 'rgba(168, 139, 250, 0.18)',
    borderColor: 'rgba(168, 139, 250, 0.4)',
  },
  toolIcon: { 
    fontSize: 24,
  },
  toolText: { 
    color: '#64748b', 
    fontSize: 11, 
    marginTop: 6,
    fontWeight: '500',
  },
  toolTextActive: {
    color: '#60a5fa',
  },
  
  // v3.9.0 — Desktop web 2-col layout. On phone / narrow web these are no-ops
  // because the wrapping Views drop the desktop styles entirely.
  desktopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 28,
    marginTop: 4,
  },
  // v3.9.1 — vertical stats column inside the right pane (replaces the wide
  // 3-up row that wasted horizontal room in the narrow right column).
  statsBarGradientDesktop: {
    flexDirection: 'column',
    paddingVertical: 18,
    paddingHorizontal: 18,
    gap: 14,
    alignItems: 'stretch',
  },
  statDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 12,
    paddingVertical: 4,
  },
  statDividerDesktop: {
    width: '100%',
    height: 1,
  },
  desktopLeftCol: {
    flexShrink: 0,
  },
  desktopRightCol: {
    flex: 1,
    minWidth: 260,
    gap: 16,
  },
  toolsContainerDesktop: {
    flexWrap: 'wrap',
    gap: 14,
    justifyContent: 'flex-start',
    marginTop: 0,
    marginBottom: 8,
  },
  numpadContainerDesktop: {
    flexWrap: 'wrap',
    maxWidth: 76 * 3 + 6 * 2,  // 3 buttons × 76 px + 2 gaps of 6 px
    alignSelf: 'flex-start',
    justifyContent: 'flex-start',
  },

  // Numpad
  numpadContainer: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'center',
    gap: NUM_GAP,
  },
  numBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  numBtnComplete: {
    opacity: 0.4,
  },
  numBtnGradient: {
    flex: 1,
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.4)',
    borderRadius: 14,
    position: 'relative',
  },
  numText: {
    color: '#4ade80',
    fontSize: 20,
    fontWeight: '700',
  },
  numTextComplete: {
    color: '#64748b',
  },
  numCount: {
    position: 'absolute',
    top: 4,
    right: 6,
    color: '#64748b',
    fontSize: 10,
    fontWeight: '600',
  },
  
  // Modal
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.85)', 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    borderRadius: 24,
    overflow: 'hidden',
  },
  modalGradient: { 
    padding: 28,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  modalTitle: { 
    fontSize: 26, 
    color: '#fff',
    fontWeight: '700',
  },
  modalStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  modalStatItem: {
    alignItems: 'center',
  },
  modalStatValue: {
    color: '#4ade80',
    fontSize: 24,
    fontWeight: '700',
  },
  modalStatLabel: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
  },
  modalStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  modalBtnPrimary: { 
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  modalBtnGradient: {
    flexDirection: 'row',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  modalBtnIcon: {
    fontSize: 20,
  },
  modalBtnPrimaryText: { 
    color: '#000', 
    fontSize: 18, 
    fontWeight: '700',
  },
  modalBtnSecondary: { 
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalBtnSecondaryIcon: {
    fontSize: 18,
  },
  modalBtnSecondaryText: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
  },

  // ── Result modals (win / game over) ──────────────────────────────
  resultContainer: {
    width: '86%',
  },
  resultCard: {
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  resultCardWin: {
    borderColor: 'rgba(74,222,128,0.5)',
    shadowColor: '#4ade80',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
  },
  resultCardLose: {
    borderColor: 'rgba(239,68,68,0.5)',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
  },
  resultBadgeWin: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(74,222,128,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(74,222,128,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  resultBadgeLose: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(239,68,68,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  resultEmoji: {
    fontSize: 44,
  },
  resultTitleWin: {
    fontSize: 26,
    fontWeight: '900',
    color: '#4ade80',
    letterSpacing: 0.5,
  },
  resultTitleLose: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ef4444',
    letterSpacing: 0.5,
  },
  resultSubtitle: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 6,
  },
  levelUpBanner: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(229,181,103,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(229,181,103,0.5)',
  },
  levelUpText: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  achUnlockBox: {
    alignSelf: 'stretch',
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(124,92,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(124,92,255,0.4)',
    gap: 6,
  },
  achUnlockTitle: {
    color: '#c4b5fd',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  achUnlockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  achUnlockIcon: { fontSize: 20 },
  achUnlockName: { color: '#e2e8f0', fontSize: 14, fontWeight: '700', flex: 1 },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  bigStar: {
    fontSize: 38,
  },
  bigStarEmpty: {
    opacity: 0.3,
  },
  resultStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 20,
    marginBottom: 22,
  },
  resultStat: {
    alignItems: 'center',
    flex: 1,
    gap: 3,
  },
  resultStatValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  resultStatLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  resultStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  resultBtnPrimary: {
    alignSelf: 'stretch',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  resultBtnGrad: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultBtnPrimaryText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '800',
  },
  resultBtnRow: {
    flexDirection: 'row',
    gap: 12,
    alignSelf: 'stretch',
  },
  resultBtnSecondary: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  resultBtnSecondaryText: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700',
  },
});