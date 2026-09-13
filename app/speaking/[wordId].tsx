import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Speech from "expo-speech";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";

import { orderingFoodPatterns } from "@/data/scenarios/orderingFood";
import { cloudToneFeedbackConfig } from "@/config/toneFeedbackConfig";
import {
  CloudToneFeedbackService,
  LocalHeuristicToneFeedbackService,
  type ToneFeedbackResult,
} from "@/services/toneFeedback";

const toneFeedbackService = cloudToneFeedbackConfig
  ? new CloudToneFeedbackService(cloudToneFeedbackConfig)
  : new LocalHeuristicToneFeedbackService();

export default function SpeakingPracticeScreen() {
  const { wordId } = useLocalSearchParams<{ wordId: string }>();
  const item = orderingFoodPatterns.find((p) => p.id === wordId);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [result, setResult] = useState<ToneFeedbackResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const permission = await requestRecordingPermissionsAsync();
      setPermissionGranted(permission.granted);
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    })();
  }, []);

  if (!item) {
    return (
      <View style={styles.center}>
        <Text>Item not found.</Text>
      </View>
    );
  }

  const speak = () => Speech.speak(item.hanzi, { language: "zh-CN" });

  const startRecording = async () => {
    setResult(null);
    setError(null);
    await recorder.prepareToRecordAsync();
    recorder.record();
  };

  const stopAndAnalyze = async () => {
    await recorder.stop();
    if (!recorder.uri) {
      setError("No recording captured — try again.");
      return;
    }
    setAnalyzing(true);
    try {
      const feedback = await toneFeedbackService.analyzeRecording(recorder.uri, item.pinyin);
      setResult(feedback);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't analyze that recording.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.hanzi}>{item.hanzi}</Text>
      <Text style={styles.pinyin}>{item.pinyin}</Text>
      <Text style={styles.meaning}>{item.meaning}</Text>

      <Pressable style={styles.secondaryButton} onPress={speak}>
        <Text style={styles.secondaryButtonText}>🔊 Hear native pronunciation</Text>
      </Pressable>

      {!permissionGranted ? (
        <Text style={styles.warning}>Microphone permission is needed to practice speaking.</Text>
      ) : (
        <>
          {!recorderState.isRecording ? (
            <Pressable style={styles.recordButton} onPress={startRecording}>
              <Text style={styles.recordButtonText}>🎙️ Start recording</Text>
            </Pressable>
          ) : (
            <Pressable style={[styles.recordButton, styles.recordingActive]} onPress={stopAndAnalyze}>
              <Text style={styles.recordButtonText}>■ Stop &amp; check</Text>
            </Pressable>
          )}
        </>
      )}

      {analyzing && <Text style={styles.warning}>Analyzing…</Text>}
      {error && <Text style={styles.error}>{error}</Text>}

      {result && (
        <View style={styles.resultBox}>
          <Text style={styles.resultScore}>{Math.round(result.score * 100)}% match</Text>
          <Text style={styles.resultSummary}>{result.summary}</Text>
          {result.syllableFeedback?.map((s, i) => (
            <Text key={i} style={s.correct ? styles.syllableOk : styles.syllableOff}>
              {s.syllable} {s.correct ? "✓" : "revisit"}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12, alignItems: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  hanzi: { fontSize: 44, fontWeight: "700", color: "#1C1917" },
  pinyin: { fontSize: 18, color: "#44403C" },
  meaning: { fontSize: 16, color: "#57534E", marginBottom: 8 },
  secondaryButton: { marginBottom: 16 },
  secondaryButtonText: { color: "#1D4ED8", fontSize: 15 },
  recordButton: {
    backgroundColor: "#DC2626",
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 40,
  },
  recordingActive: { backgroundColor: "#7F1D1D" },
  recordButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  warning: { color: "#B45309", marginTop: 12, textAlign: "center" },
  error: { color: "#DC2626", marginTop: 12, textAlign: "center" },
  resultBox: { marginTop: 20, alignItems: "center", gap: 6 },
  resultScore: { fontSize: 24, fontWeight: "700", color: "#1C1917" },
  resultSummary: { fontSize: 13, color: "#78716C", textAlign: "center" },
  syllableOk: { color: "#16A34A" },
  syllableOff: { color: "#DC2626" },
});
