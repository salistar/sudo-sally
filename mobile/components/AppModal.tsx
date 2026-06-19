/**
 * AppModal - a beautifully designed, theme-matching popup that replaces
 * the basic native Alert.alert() for single-button info/success/error/coming-soon dialogs.
 *
 * Different popup TYPE -> different color + emoji:
 *   success     -> green  (🎉)
 *   error       -> red    (⚠️)
 *   info / soon -> purple (🚀)
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export type PopupType = 'success' | 'error' | 'info';

export interface PopupData {
  type: PopupType;
  title: string;
  message?: string;
  tag?: string;
  /** When set, a second (primary) button is shown and this runs on confirm. */
  confirmLabel?: string;
  onConfirm?: () => void;
}

interface AppModalProps {
  popup: PopupData | null;
  onClose: () => void;
  buttonLabel: string;
}

const THEME: Record<
  PopupType,
  {
    emoji: string;
    card: readonly [string, string];
    button: readonly [string, string];
    border: string;
    shadow: string;
    badgeBg: string;
    badgeBorder: string;
  }
> = {
  success: {
    emoji: '🎉',
    card: ['#10241b', '#0f2018'],
    button: ['#7c5cff', '#2dd4db'],
    border: 'rgba(124,92,255,0.5)',
    shadow: '#2dd4db',
    badgeBg: 'rgba(124,92,255,0.15)',
    badgeBorder: 'rgba(124,92,255,0.4)',
  },
  error: {
    emoji: '⚠️',
    card: ['#2a1717', '#241313'],
    button: ['#f97316', '#ef4444'],
    border: 'rgba(239,68,68,0.5)',
    shadow: '#ef4444',
    badgeBg: 'rgba(239,68,68,0.15)',
    badgeBorder: 'rgba(239,68,68,0.4)',
  },
  info: {
    emoji: '🚀',
    card: ['#241b3d', '#1a1430'],
    button: ['#a78bfa', '#8b5cf6'],
    border: 'rgba(167,139,250,0.5)',
    shadow: '#8b5cf6',
    badgeBg: 'rgba(167,139,250,0.15)',
    badgeBorder: 'rgba(167,139,250,0.4)',
  },
};

export default function AppModal({ popup, onClose, buttonLabel }: AppModalProps) {
  const theme = popup ? THEME[popup.type] : THEME.info;

  return (
    <Modal visible={!!popup} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.wrapper}>
          <LinearGradient
            colors={theme.card}
            style={[styles.card, { borderColor: theme.border, shadowColor: theme.shadow }]}
          >
            <View
              style={[
                styles.badge,
                { backgroundColor: theme.badgeBg, borderColor: theme.badgeBorder },
              ]}
            >
              <Text style={styles.emoji}>{theme.emoji}</Text>
            </View>

            <Text style={styles.title}>{popup?.title}</Text>

            {!!popup?.tag && (
              <View style={[styles.tag, { backgroundColor: theme.badgeBg }]}>
                <Text style={styles.tagText}>{popup.tag}</Text>
              </View>
            )}

            {!!popup?.message && <Text style={styles.message}>{popup.message}</Text>}

            {popup?.confirmLabel ? (
              // Two-button (destructive confirmation): Cancel + Confirm
              <View style={styles.row}>
                <TouchableOpacity style={styles.btnCancel} onPress={onClose} activeOpacity={0.8}>
                  <Text style={styles.btnCancelText}>{buttonLabel}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.btnConfirm}
                  activeOpacity={0.9}
                  onPress={() => {
                    // Run the confirm action first so handlers can mark "handled"
                    // before our onClose runs (decline-vs-accept differentiation).
                    popup.onConfirm?.();
                    onClose();
                  }}
                >
                  <LinearGradient
                    colors={theme.button}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.buttonGrad}
                  >
                    <Text style={styles.buttonText}>{popup.confirmLabel}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.button} onPress={onClose} activeOpacity={0.9}>
                <LinearGradient
                  colors={theme.button}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.buttonGrad}
                >
                  <Text style={styles.buttonText}>{buttonLabel}</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  wrapper: {
    width: '100%',
    maxWidth: 360,
  },
  card: {
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 18,
  },
  badge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emoji: {
    fontSize: 44,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  tag: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  tagText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  message: {
    color: '#cbd5e1',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 14,
  },
  button: {
    alignSelf: 'stretch',
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 24,
  },
  row: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 12,
    marginTop: 24,
  },
  btnCancel: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  btnCancelText: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '700',
  },
  btnConfirm: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  buttonGrad: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
});
