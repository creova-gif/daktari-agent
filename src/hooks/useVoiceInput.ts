import { useState, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

// ─── Types ────────────────────────────────────────────────────────────────────

export type VoiceState = 'idle' | 'recording' | 'transcribing' | 'done' | 'error';

export interface VoiceTranscript {
  text: string;
  language: string;
  duration_s: number;
}

// ─── Whisper API call ─────────────────────────────────────────────────────────
// Uses OpenAI Whisper endpoint — swap for local Whisper when deploying on-device
async function transcribeAudio(fileUri: string): Promise<VoiceTranscript> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_OPENAI_API_KEY not set');

  // Read audio file as base64
  const base64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Build multipart/form-data manually (React Native fetch doesn't support FormData with files cleanly)
  const boundary = `----FormBoundary${Date.now()}`;
  const filename  = 'recording.m4a';
  const mimeType  = 'audio/m4a';

  // Encode form fields
  const fileHeader =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`;

  const modelField =
    `\r\n--${boundary}\r\n` +
    `Content-Disposition: form-data; name="model"\r\n\r\n` +
    `whisper-1`;

  // Language hint: Swahili for Tanzania
  const langField =
    `\r\n--${boundary}\r\n` +
    `Content-Disposition: form-data; name="language"\r\n\r\n` +
    `sw`;

  const promptField =
    `\r\n--${boundary}\r\n` +
    `Content-Disposition: form-data; name="prompt"\r\n\r\n` +
    `Mazungumzo ya kliniki Tanzania. Maumivu, homa, malaria, TB, watoto.`;

  const footer = `\r\n--${boundary}--\r\n`;

  // Upload via FileSystem.uploadAsync for proper binary handling
  const response = await FileSystem.uploadAsync(
    'https://api.openai.com/v1/audio/transcriptions',
    fileUri,
    {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType,
      parameters: {
        model: 'whisper-1',
        language: 'sw',
        prompt: 'Mazungumzo ya kliniki Tanzania. Maumivu, homa, malaria, TB, watoto.',
      },
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );

  if (response.status !== 200) {
    throw new Error(`Whisper API error: ${response.status} ${response.body}`);
  }

  const data = JSON.parse(response.body);
  return {
    text: data.text ?? '',
    language: data.language ?? 'sw',
    duration_s: 0, // Whisper doesn't return duration in basic transcription
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseVoiceInputReturn {
  voiceState: VoiceState;
  transcript: string;
  error: string | null;
  recordingDuration: number;  // seconds
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  clearTranscript: () => void;
}

export function useVoiceInput(): UseVoiceInputReturn {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const startRecording = useCallback(async () => {
    try {
      setError(null);

      // Request permissions
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        setError('Ruhusa ya maikrofoni inahitajika. Tafadhali ruhusu katika mipangilio.');
        return;
      }

      // Configure audio session
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      // Start recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      startTimeRef.current = Date.now();
      setRecordingDuration(0);
      setVoiceState('recording');

      // Duration counter
      timerRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch (err) {
      console.error('[Voice] Start recording error:', err);
      setError('Imeshindwa kuanza kurekodi. Jaribu tena.');
      setVoiceState('error');
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return;

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      setVoiceState('transcribing');

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      // Reset audio mode
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      if (!uri) throw new Error('Hakuna faili la sauti');

      // Transcribe
      const result = await transcribeAudio(uri);
      setTranscript(result.text);
      setVoiceState('done');

      // Cleanup temp file
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch (err) {
      console.error('[Voice] Stop/transcribe error:', err);
      setError('Imeshindwa kubadilisha sauti kuwa maandishi. Jaribu kuandika.');
      setVoiceState('error');
      recordingRef.current = null;
    }
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setVoiceState('idle');
    setError(null);
    setRecordingDuration(0);
  }, []);

  return {
    voiceState,
    transcript,
    error,
    recordingDuration,
    startRecording,
    stopRecording,
    clearTranscript,
  };
}
