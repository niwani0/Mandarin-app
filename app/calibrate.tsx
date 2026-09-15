import { useMemo, useState } from "react";
import { Stack, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";

import { allPatterns } from "@/data/scenarios";
import { markCalibrated } from "@/db/repository";

/**
 * A quick placement pass across tiers and scenarios. This is what "calibrated from my
 * level" means here: instead of assuming a single global level, each item gets its own
 * known/unknown baseline, so a genuinely patchy profile (solid on some patterns, shaky on
 * basics) is captured item-by-item rather than flattened into one difficulty setting.
 */
function buildCalibrationSet() {
  const byTier = (tier: number) => allPatterns.filter((p) => p.tier === tier);
  return [...byTier(1).slice(0, 6), ...byTier(2).slice(0, 6), ...byTier(3).slice(0, 4)];
}

export default function CalibrateScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const items = useMemo(buildCalibrationSet, []);
  const [index, setIndex] = useState(0);
  const [knownCount, setKnownCount] = useState(0);

  const currentItem = items[index];

  const handleAnswer = async (known: boolean) => {
    await markCalibrated(db, currentItem.id, "pattern", known);
    if (known) setKnownCount((c) => c + 1);
    setIndex(index + 1);
  };

  if (!currentItem) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Calibration" }} />
        <Text style={styles.doneTitle}>Calibration complete</Text>
        <Text style={styles.doneSubtitle}>
          You already knew {knownCount} of {items.length}. Everything else is queued up, starting
          with the simplest gaps first.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => router.replace("/")}>
          <Text style={styles.primaryButtonText}>Back to home</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: "Calibration" }} />
      <Text style={styles.progressLabel}>
        {index + 1} / {items.length}
      </Text>
      <Text style={styles.instruction}>Do you already know this?</Text>
      <Text style={styles.hanzi}>{currentItem.hanzi}</Text>
      <Text style={styles.pinyin}>{currentItem.pinyin}</Text>
      <Text style={styles.meaning}>{currentItem.meaning}</Text>

      <View style={styles.rateRow}>
        <Pressable style={[styles.rateButton, styles.rateWrong]} onPress={() => handleAnswer(false)}>
          <Text style={styles.rateButtonText}>Not yet</Text>
        </Pressable>
        <Pressable style={[styles.rateButton, styles.rateRight]} onPress={() => handleAnswer(true)}>
          <Text style={styles.rateButtonText}>I know this</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 16, alignItems: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  progressLabel: { alignSelf: "flex-start", color: "#78716C" },
  instruction: { fontSize: 15, color: "#57534E" },
  hanzi: { fontSize: 40, fontWeight: "700", color: "#1C1917" },
  pinyin: { fontSize: 18, color: "#44403C" },
  meaning: { fontSize: 18, color: "#1C1917", textAlign: "center" },
  rateRow: { flexDirection: "row", gap: 12, marginTop: 24 },
  rateButton: { paddingVertical: 14, paddingHorizontal: 22, borderRadius: 10 },
  rateWrong: { backgroundColor: "#F3F4F6" },
  rateRight: { backgroundColor: "#DCFCE7" },
  rateButtonText: { fontWeight: "600", color: "#1C1917" },
  primaryButton: {
    backgroundColor: "#16A34A",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 12,
  },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  doneTitle: { fontSize: 20, fontWeight: "700" },
  doneSubtitle: { color: "#57534E", textAlign: "center" },
});
