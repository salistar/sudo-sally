/**
 * Challenge Game Screen - Dual Sudoku View
 * Shows both players' grids side by side in real-time
 */

import { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Alert, Modal, 
  Dimensions, ScrollView, ActivityIndicator 
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { socketService } from '../utils/socket';
import { useLang } from '../utils/LanguageContext';
import AppModal, { PopupData } from '../components/AppModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';

const { width } = Dimensions.get('window');
const CELL_SIZE = Math.floor((width - 60) / 9 / 2);

type Board = (number | null)[][];

interface Challenge {
  _id: string;
  puzzle: string;
  solution: string;
  difficulty: string;
  status: string;
  challenger: { _id: string; username: string; avatar: string };
  challenged: { _id: string; username: string; avatar: string };
  challengerProgress: { board: string; completed: boolean; errors: number; timeSpent: number; abandoned: boolean };
  challengedProgress: { board: string; completed: boolean; errors: number; timeSpent: number; abandoned: boolean };
  winner?: { _id: string; username: string };
}

// PRODUCTION API by default (works on any network, incl. 4G). Flip to local for dev.
const USE_LOCAL_BACKEND = false;
const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
const API_URL =
  (USE_LOCAL_BACKEND && devHost ? `http://${devHost}:3101` : 'https://api.sudoku.gowithsally.com') + '/api';

export default function ChallengeGame() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLang();
  const challengeId = id as string;

  // ============ STATE ============
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState<PopupData | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [solution, setSolution] = useState<Board>([]);
  const [myBoard, setMyBoard] = useState<Board>([]);
  const [opponentBoard, setOpponentBoard] = useState<Board>([]);
  const [initial, setInitial] = useState<boolean[][]>([]);
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const [myErrors, setMyErrors] = useState(0);
  const [opponentErrors, setOpponentErrors] = useState(0);
  const [myTime, setMyTime] = useState(0);
  const [opponentTime, setOpponentTime] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isChallenger, setIsChallenger] = useState(false);
  const [opponentCompleted, setOpponentCompleted] = useState(false);
  const [myCompleted, setMyCompleted] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const timerRef = useRef<NodeJS.Timeout>();

  // ============ INIT ============
  useEffect(() => {
    loadChallenge();
    setupSocketListeners();

    return () => {
      clearInterval(timerRef.current);
      socketService.leaveChallenge(challengeId);
      socketService.removeAllListeners('opponent:progress');
      socketService.removeAllListeners('player:completed');
      socketService.removeAllListeners('player:abandoned');
      socketService.removeAllListeners('challenge:result');
    };
  }, [challengeId]);

  // Timer
  useEffect(() => {
    if (!gameOver && !myCompleted && challenge?.status === 'playing') {
      timerRef.current = setInterval(() => setMyTime(t => t + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [gameOver, myCompleted, challenge?.status]);

  // ============ SOCKET LISTENERS ============
  const setupSocketListeners = () => {
    socketService.joinChallenge(challengeId);

    // Opponent progress
    socketService.on('opponent:progress', (data: any) => {
      if (data.board) {
        try {
          const board = typeof data.board === 'string' ? JSON.parse(data.board) : data.board;
          setOpponentBoard(board);
        } catch (e) {
          console.error('Error parsing opponent board:', e);
        }
      }
      if (data.errors !== undefined) setOpponentErrors(data.errors);
      if (data.timeSpent !== undefined) setOpponentTime(data.timeSpent);
    });

    // Opponent completed
    socketService.on('player:completed', (data: any) => {
      if (data.odcUserId !== currentUser?.id) {
        setOpponentCompleted(true);
        setOpponentTime(data.timeSpent);
        setOpponentErrors(data.errors);
        if (myCompleted) determineWinner();
      }
    });

    // Opponent abandoned
    socketService.on('player:abandoned', (data: any) => {
      if (data.odcUserId !== currentUser?.id) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setGameOver(true);
        setWinner(currentUser?.id ?? null); // ✅ FIX: Use ?? null
        setShowResult(true);
      }
    });

    // Final result
    socketService.on('challenge:result', (data: any) => {
      setGameOver(true);
      setWinner(data.winner ?? null); // ✅ FIX: Use ?? null
      setShowResult(true);
    });
  };

  // ============ LOAD CHALLENGE ============
  const loadChallenge = async () => {
    try {
      const userData = await AsyncStorage.getItem('sudoku_user');
      const user = userData ? JSON.parse(userData) : null;
      setCurrentUser(user);

      const token = await AsyncStorage.getItem('sudoku_token');
      const response = await fetch(`${API_URL}/challenges/${challengeId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();

      if (data.success) {
        const ch = data.challenge;
        setChallenge(ch);
        setIsChallenger(ch.challenger._id === user?.id);

        const puzzleBoard = JSON.parse(ch.puzzle);
        const solutionBoard = JSON.parse(ch.solution);
        
        setSolution(solutionBoard);
        setInitial(puzzleBoard.map((row: any[]) => row.map(cell => cell !== 0 && cell !== null)));

        const myProgress = ch.challenger._id === user?.id ? ch.challengerProgress : ch.challengedProgress;
        const oppProgress = ch.challenger._id === user?.id ? ch.challengedProgress : ch.challengerProgress;

        setMyBoard(myProgress?.board ? JSON.parse(myProgress.board) : puzzleBoard.map((r: any[]) => [...r]));
        setOpponentBoard(oppProgress?.board ? JSON.parse(oppProgress.board) : puzzleBoard.map((r: any[]) => [...r]));
        setMyErrors(myProgress?.errors || 0);
        setOpponentErrors(oppProgress?.errors || 0);
        setMyTime(myProgress?.timeSpent || 0);
        setOpponentTime(oppProgress?.timeSpent || 0);

        // Start if accepted
        if (ch.status === 'accepted') await startChallenge();
      }
    } catch (error) {
      console.error('Error loading challenge:', error);
      setPopup({ type: 'error', title: t('error'), message: t('failedLoadChallenge') });
    } finally {
      setLoading(false);
    }
  };

  const startChallenge = async () => {
    try {
      const token = await AsyncStorage.getItem('sudoku_token');
      await fetch(`${API_URL}/challenges/${challengeId}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      socketService.startGame(challengeId);
    } catch (error) {
      console.error('Error starting challenge:', error);
    }
  };

  // ============ GAME LOGIC ============
  const handleCellPress = (row: number, col: number) => {
    if (gameOver || myCompleted || initial[row]?.[col]) return;
    setSelected({ row, col });
    Haptics.selectionAsync();
  };

  const handleNumber = async (num: number) => {
    if (!selected || gameOver || myCompleted) return;
    const { row, col } = selected;
    if (initial[row][col]) return;

    const newBoard = myBoard.map(r => [...r]);
    newBoard[row][col] = num;
    setMyBoard(newBoard);

    // Check if correct
    if (num !== solution[row][col]) {
      const newErrors = myErrors + 1;
      setMyErrors(newErrors);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      // 3 errors = auto lose
      if (newErrors >= 3) {
        handleAbandon(true);
        return;
      }
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // Send progress to opponent
    socketService.sendProgress(
      challengeId,
      JSON.stringify(newBoard),
      myTime,
      myErrors,
      { row, col, value: num }
    );

    // Save to server
    await saveProgress(newBoard);

    // Check if completed
    if (isBoardComplete(newBoard)) {
      await handleComplete(newBoard);
    }
  };

  const handleErase = () => {
    if (!selected || initial[selected.row][selected.col] || gameOver || myCompleted) return;
    const newBoard = myBoard.map(r => [...r]);
    newBoard[selected.row][selected.col] = null;
    setMyBoard(newBoard);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const isBoardComplete = (board: Board): boolean => {
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        if (board[i][j] !== solution[i][j]) return false;
      }
    }
    return true;
  };

  const saveProgress = async (board: Board) => {
    try {
      const token = await AsyncStorage.getItem('sudoku_token');
      await fetch(`${API_URL}/challenges/${challengeId}/progress`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          board: JSON.stringify(board),
          timeSpent: myTime,
          errors: myErrors
        })
      });
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };

  const handleComplete = async (board: Board) => {
    setMyCompleted(true);
    clearInterval(timerRef.current);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const token = await AsyncStorage.getItem('sudoku_token');
      await fetch(`${API_URL}/challenges/${challengeId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          board: JSON.stringify(board),
          timeSpent: myTime,
          errors: myErrors
        })
      });

      socketService.notifyCompleted(challengeId, myTime, myErrors);

      if (opponentCompleted) {
        determineWinner();
      } else {
        setPopup({ type: 'success', title: t('completedExcl'), message: t('waitingOpponentFinish') });
      }
    } catch (error) {
      console.error('Error completing challenge:', error);
    }
  };

  const determineWinner = () => {
    const myScore = myTime + (myErrors * 30);
    const oppScore = opponentTime + (opponentErrors * 30);

    if (myScore < oppScore) {
      setWinner(currentUser?.id ?? null); // ✅ FIX: Use ?? null
    } else if (oppScore < myScore) {
      // ✅ FIX: Use ?? null for potentially undefined values
      const opponentId = isChallenger ? challenge?.challenged._id : challenge?.challenger._id;
      setWinner(opponentId ?? null);
    } else {
      setWinner(null); // Draw
    }

    setGameOver(true);
    setShowResult(true);
  };

  const handleAbandon = async (autoLoss: boolean = false) => {
    if (!autoLoss) {
      Alert.alert(
        `🏳️ ${t('abandonTitle')}`,
        t('abandonConfirm'),
        [
          { text: t('cancel'), style: 'cancel' },
          { text: t('abandon'), style: 'destructive', onPress: confirmAbandon }
        ]
      );
    } else {
      confirmAbandon();
    }
  };

  const confirmAbandon = async () => {
    try {
      clearInterval(timerRef.current);
      setGameOver(true);
      setMyBoard(solution); // Show corrected board

      const token = await AsyncStorage.getItem('sudoku_token');
      await fetch(`${API_URL}/challenges/${challengeId}/abandon`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      socketService.notifyAbandoned(challengeId);

      // ✅ FIX: Use ?? null for potentially undefined values
      const opponentId = isChallenger ? challenge?.challenged._id : challenge?.challenger._id;
      setWinner(opponentId ?? null);
      setShowResult(true);
    } catch (error) {
      console.error('Error abandoning:', error);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ============ RENDER BOARD ============
  const renderBoard = (board: Board, isOpponent: boolean = false) => {
    const size = isOpponent ? CELL_SIZE - 2 : CELL_SIZE;

    return (
      <View style={[styles.board, isOpponent && styles.opponentBoard]}>
        {board.map((row, i) => (
          <View key={i} style={styles.row}>
            {row.map((cell, j) => {
              const isSelected = !isOpponent && selected?.row === i && selected?.col === j;
              const isInitialCell = initial[i]?.[j];
              const isError = cell !== null && cell !== 0 && cell !== solution[i][j];

              return (
                <TouchableOpacity
                  key={j}
                  style={[
                    styles.cell,
                    { width: size, height: size },
                    isSelected && styles.selected,
                    isError && styles.errorCell,
                    j % 3 === 2 && j !== 8 && styles.borderRight,
                    i % 3 === 2 && i !== 8 && styles.borderBottom,
                  ]}
                  onPress={() => !isOpponent && handleCellPress(i, j)}
                  disabled={isOpponent || gameOver || myCompleted}
                >
                  {cell !== null && cell !== 0 && (
                    <Text style={[
                      styles.cellText,
                      { fontSize: size * 0.5 },
                      isInitialCell && styles.initialText,
                      isError && styles.errorText
                    ]}>
                      {cell}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  const opponent = challenge
    ? (isChallenger ? challenge.challenged : challenge.challenger)
    : { username: t('versus'), avatar: '👤' };

  // ============ LOADING ============
  if (loading) {
    return (
      <LinearGradient colors={['#0a0a1a', '#1a1a3a', '#0f0f2a']} style={styles.container}>
        <ActivityIndicator size="large" color="#4ade80" style={{ flex: 1 }} />
      </LinearGradient>
    );
  }

  // ============ RENDER ============
  return (
    <LinearGradient colors={['#0a0a1a', '#1a1a3a', '#0f0f2a']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← {t('back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>⚔️ {t('challenge')}</Text>
        <Text style={styles.diff}>{challenge?.difficulty?.toUpperCase()}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* VS Banner */}
        <View style={styles.vs}>
          <View style={styles.player}>
            <Text style={styles.playerAvatar}>{currentUser?.avatar || '👤'}</Text>
            <Text style={styles.playerName}>{t('you')}</Text>
            <Text style={styles.playerStats}>⏱️ {formatTime(myTime)} • ❌ {myErrors}</Text>
            {myCompleted && <Text style={styles.done}>✅ {t('completedExcl')}</Text>}
          </View>
          
          <Text style={styles.vsText}>VS</Text>
          
          <View style={styles.player}>
            <Text style={styles.playerAvatar}>{opponent.avatar}</Text>
            <Text style={styles.playerName}>{opponent.username}</Text>
            <Text style={styles.playerStats}>⏱️ {formatTime(opponentTime)} • ❌ {opponentErrors}</Text>
            {opponentCompleted && <Text style={styles.done}>✅ {t('completedExcl')}</Text>}
          </View>
        </View>

        {/* Dual Boards */}
        <View style={styles.boards}>
          <View style={styles.boardWrap}>
            <Text style={styles.boardLabel}>{t('yourGrid')}</Text>
            {renderBoard(myBoard, false)}
          </View>
          <View style={styles.boardWrap}>
            <Text style={styles.boardLabel}>{opponent.username}</Text>
            {renderBoard(opponentBoard, true)}
          </View>
        </View>

        {/* Numpad */}
        {!gameOver && !myCompleted && (
          <View style={styles.numpad}>
            {[1,2,3,4,5,6,7,8,9].map(num => (
              <TouchableOpacity key={num} style={styles.numBtn} onPress={() => handleNumber(num)}>
                <Text style={styles.numText}>{num}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Tools */}
        {!gameOver && !myCompleted && (
          <View style={styles.tools}>
            <TouchableOpacity style={styles.tool} onPress={handleErase}>
              <Text style={styles.toolIcon}>🧹</Text>
              <Text style={styles.toolLabel}>{t('erase')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tool, styles.abandonTool]} onPress={() => handleAbandon()}>
              <Text style={styles.toolIcon}>🏳️</Text>
              <Text style={styles.toolLabel}>{t('abandon')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Waiting */}
        {myCompleted && !gameOver && (
          <View style={styles.waiting}>
            <ActivityIndicator color="#4ade80" />
            <Text style={styles.waitingText}>{t('waitingForOpponent')} {opponent.username}...</Text>
          </View>
        )}
      </ScrollView>

      {/* Result Modal */}
      <Modal visible={showResult} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.resultModal}>
            <Text style={styles.resultEmoji}>
              {winner === currentUser?.id ? '🏆' : winner === null ? '🤝' : '😔'}
            </Text>
            <Text style={styles.resultTitle}>
              {winner === currentUser?.id ? t('victory') : winner === null ? t('draw') : t('defeated')}
            </Text>
            <Text style={styles.resultSub}>
              {winner === currentUser?.id
                ? t('youWonChallenge')
                : winner === null
                  ? t('itsATie')
                  : `${opponent.username} ${t('wonLabel')}`}
            </Text>

            <View style={styles.resultStats}>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>{t('yourTimeLabel')}:</Text>
                <Text style={styles.resultValue}>{formatTime(myTime)}</Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>{t('yourErrors')}:</Text>
                <Text style={styles.resultValue}>{myErrors}</Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>{t('opponentTime')}:</Text>
                <Text style={styles.resultValue}>{formatTime(opponentTime)}</Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>{t('opponentErrors')}:</Text>
                <Text style={styles.resultValue}>{opponentErrors}</Text>
              </View>
            </View>

            {winner === currentUser?.id && (
              <View style={styles.rewards}>
                <Text style={styles.rewardsTitle}>{t('rewards')}:</Text>
                <Text style={styles.rewardsText}>+100 XP • +50 🪙 • +3 ⭐</Text>
              </View>
            )}

            <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/challenges')}>
              <Text style={styles.backBtnText}>{t('backToLobby')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <AppModal popup={popup} onClose={() => setPopup(null)} buttonLabel={t('gotIt')} />
    </LinearGradient>
  );
}

// ============ STYLES ============
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, paddingTop: 50 },
  back: { color: '#64748b', fontSize: 16 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  diff: { color: '#fbbf24', fontSize: 11, backgroundColor: 'rgba(251,191,36,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },

  scroll: { padding: 10, paddingBottom: 30 },

  vs: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 14, marginBottom: 12 },
  player: { alignItems: 'center', flex: 1 },
  playerAvatar: { fontSize: 28 },
  playerName: { color: '#fff', fontSize: 12, fontWeight: '600', marginTop: 3 },
  playerStats: { color: '#64748b', fontSize: 10, marginTop: 2 },
  done: { color: '#4ade80', fontSize: 11, marginTop: 3, fontWeight: '600' },
  vsText: { color: '#ef4444', fontWeight: '800', fontSize: 14 },

  boards: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  boardWrap: { alignItems: 'center', flex: 1 },
  boardLabel: { color: '#64748b', fontSize: 11, marginBottom: 6 },
  board: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: 2 },
  opponentBoard: { opacity: 0.8 },
  row: { flexDirection: 'row' },
  cell: { justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: '#334155' },
  selected: { backgroundColor: 'rgba(59,130,246,0.4)' },
  errorCell: { backgroundColor: 'rgba(239,68,68,0.2)' },
  borderRight: { borderRightWidth: 2, borderRightColor: '#4ade80' },
  borderBottom: { borderBottomWidth: 2, borderBottomColor: '#4ade80' },
  cellText: { color: '#fff', fontWeight: '600' },
  initialText: { color: '#94a3b8' },
  errorText: { color: '#ef4444' },

  numpad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 5, marginBottom: 12 },
  numBtn: { width: 45, height: 45, backgroundColor: 'rgba(74,222,128,0.2)', borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#4ade80' },
  numText: { color: '#4ade80', fontSize: 20, fontWeight: '700' },

  tools: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  tool: { alignItems: 'center', padding: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, minWidth: 70 },
  abandonTool: { backgroundColor: 'rgba(239,68,68,0.2)' },
  toolIcon: { fontSize: 20 },
  toolLabel: { color: '#64748b', fontSize: 10, marginTop: 3 },

  waiting: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 15, backgroundColor: 'rgba(74,222,128,0.1)', borderRadius: 10, marginTop: 15 },
  waitingText: { color: '#4ade80', fontSize: 13 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  resultModal: { backgroundColor: '#1a1a3a', padding: 25, borderRadius: 20, alignItems: 'center', width: '85%' },
  resultEmoji: { fontSize: 60, marginBottom: 10 },
  resultTitle: { color: '#fff', fontSize: 26, fontWeight: '800' },
  resultSub: { color: '#94a3b8', fontSize: 14, marginTop: 5 },
  resultStats: { width: '100%', marginTop: 20, backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 10 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  resultLabel: { color: '#64748b', fontSize: 13 },
  resultValue: { color: '#fff', fontSize: 13, fontWeight: '600' },
  rewards: { marginTop: 15, backgroundColor: 'rgba(74,222,128,0.1)', padding: 12, borderRadius: 10, alignItems: 'center' },
  rewardsTitle: { color: '#4ade80', fontSize: 12 },
  rewardsText: { color: '#4ade80', fontSize: 16, fontWeight: '700', marginTop: 3 },
  backBtn: { marginTop: 20, backgroundColor: '#4ade80', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 10 },
  backBtnText: { color: '#000', fontSize: 14, fontWeight: '700' },
});