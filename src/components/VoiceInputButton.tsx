import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, ActivityIndicator,
} from 'react-native';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { colors, typography, spacing, radius } from '../lib/theme';

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function VoiceInputButton({
  onTranscript,
  disabled = false,
  placeholder = 'Bonyeza kurekodi kwa sauti',
}: VoiceInputButtonProps) {
  const {
    voiceState,
    transcript,
    error,
    recordingDuration,
    startRecording,
    stopRecording,
    clearTranscript,
  } = useVoiceInput();

  // Pulse animation for recording state
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnims = useRef([
    new Animated.Value(0.3),
    new Animated.Value(0.6),
    new Animated.Value(1.0),
    new Animated.Value(0.6),
    new Animated.Value(0.3),
  ]).current;

  useEffect(() => {
    if (voiceState === 'recording') {
      // Outer pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0,  duration: 600, useNativeDriver: true }),
        ])
      ).start();

      // Waveform bars
      waveAnims.forEach((anim, i) => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, { toValue: Math.random() * 0.8 + 0.2, duration: 200 + i * 80, useNativeDriver: true }),
            Animated.timing(anim, { toValue: Math.random() * 0.5 + 0.1, duration: 200 + i * 60, useNativeDriver: true }),
          ])
        ).start();
      });
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      waveAnims.forEach(a => { a.stopAnimation(); a.setValue(0.3); });
    }
  }, [voiceState]);

  // Auto-send transcript when done
  useEffect(() => {
    if (voiceState === 'done' && transcript) {
      onTranscript(transcript);
    }
  }, [voiceState, transcript]);

  function formatDuration(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  const isRecording    = voiceState === 'recording';
  const isTranscribing = voiceState === 'transcribing';
  const isDone         = voiceState === 'done';
  const isError        = voiceState === 'error';

  return (
    <View style={styles.container}>
      {/* Main mic button */}
      <View style={styles.buttonRow}>
        <Animated.View style={[
          styles.pulseRing,
          isRecording && styles.pulseRingActive,
          { transform: [{ scale: isRecording ? pulseAnim : 1 }] },
        ]}>
          <TouchableOpacity
            style={[
              styles.micButton,
              isRecording    && styles.micButtonRecording,
              isTranscribing && styles.micButtonTranscribing,
              disabled       && styles.micButtonDisabled,
            ]}
            onPress={isRecording ? stopRecording : startRecording}
            disabled={disabled || isTranscribing || isDone}
            activeOpacity={0.8}
          >
            {isTranscribing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.micIcon}>
                {isRecording ? '⏹' : '🎙'}
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Waveform (visible during recording) */}
        {isRecording && (
          <View style={styles.waveform}>
            {waveAnims.map((anim, i) => (
              <Animated.View
                key={i}
                style={[styles.waveBar, { transform: [{ scaleY: anim }] }]}
              />
            ))}
          </View>
        )}

        {/* Duration */}
        {isRecording && (
          <View style={styles.durationBadge}>
            <View style={styles.recordingDot} />
            <Text style={styles.durationText}>{formatDuration(recordingDuration)}</Text>
          </View>
        )}

        {/* Transcribing label */}
        {isTranscribing && (
          <Text style={styles.transcribingLabel}>Inabadilisha sauti...</Text>
        )}
      </View>

      {/* State label */}
      {!isRecording && !isTranscribing && !isDone && !isError && (
        <Text style={styles.placeholder}>{placeholder}</Text>
      )}

      {/* Transcript result */}
      {isDone && transcript && (
        <View style={styles.transcriptBox}>
          <View style={styles.transcriptHeader}>
            <Text style={styles.transcriptLabel}>✓ Imerekodiwa</Text>
            <TouchableOpacity onPress={() => { clearTranscript(); }}>
              <Text style={styles.clearBtn}>Futa</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.transcriptText}>{transcript}</Text>
        </View>
      )}

      {/* Error */}
      {isError && error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
          <TouchableOpacity onPress={() => clearTranscript()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Jaribu Tena</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Instruction */}
      {voiceState === 'idle' && (
        <Text style={styles.instruction}>
          Zungumza kwa Kiswahili · Bonyeza ⏹ kumaliza
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: spacing.md },
  buttonRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.md, marginBottom: spacing.sm,
  },
  pulseRing: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 2, borderColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },
  pulseRingActive: {
    borderColor: colors.emergency + '40',
    backgroundColor: colors.emergency + '08',
  },
  micButton: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.green,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  micButtonRecording: {
    backgroundColor: colors.emergency,
    shadowColor: colors.emergency,
  },
  micButtonTranscribing: {
    backgroundColor: colors.info,
    shadowColor: colors.info,
  },
  micButtonDisabled: {
    backgroundColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  micIcon: { fontSize: 26 },
  waveform: {
    flexDirection: 'row', alignItems: 'center',
    gap: 3, height: 32,
  },
  waveBar: {
    width: 4, height: 28, borderRadius: 2,
    backgroundColor: colors.emergency,
  },
  durationBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: colors.emergencyBg, borderRadius: radius.full,
  },
  recordingDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.emergency,
  },
  durationText: { color: colors.emergency, fontWeight: '700', fontSize: 14 },
  transcribingLabel: { ...typography.caption, color: colors.info },
  placeholder: { ...typography.caption, color: colors.inkDim, textAlign: 'center' },
  instruction: { ...typography.caption, color: colors.inkDim, textAlign: 'center', marginTop: 2 },
  transcriptBox: {
    width: '100%', backgroundColor: colors.greenLight,
    borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.green + '40',
    marginTop: spacing.sm,
  },
  transcriptHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  transcriptLabel: { ...typography.label, color: colors.greenDark },
  clearBtn: { ...typography.caption, color: colors.emergency, fontWeight: '700' },
  transcriptText: { ...typography.body, color: colors.greenDark, lineHeight: 22 },
  errorBox: {
    width: '100%', backgroundColor: colors.emergencyBg,
    borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.emergency + '40',
    marginTop: spacing.sm, alignItems: 'center',
  },
  errorText: { ...typography.caption, color: colors.emergency, textAlign: 'center', lineHeight: 18 },
  retryBtn: {
    marginTop: spacing.sm, paddingHorizontal: 20, paddingVertical: 8,
    backgroundColor: colors.surface, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.emergency,
  },
  retryText: { color: colors.emergency, fontWeight: '700', fontSize: 13 },
});
