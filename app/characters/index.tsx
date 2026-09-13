import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import * as Speech from "expo-speech";

import { menuCharacters } from "@/data/characters/menuCharacters";
import type { CharacterItem, TeachingMethod } from "@/types/content";
import { buildSessionQueue, logAttempt } from "@/db/repository";
import { getMethodConfidence, recordMethodOutcome, selectMethod } from "@/engine/adaptiveEngine";
import { scheduleNextReview } from "@/engine/srs";

const SESSION_SIZE = 8;

export default function CharactersScreen() {
  const db = useSQLiteContext();
  const router = useRouter();

  const [queue, setQueue] = useState<string[] | null>(null);
  const [index, setIndex] = useState(0);
  const [method, setMethod] = useState<TeachingMethod | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [promptStartedAt, setPromptStartedAt] = useState(0);

  const currentItem: CharacterItem | undefined = queue ? menuCharacters.find((c) => c.id === queue[index]) : undefined;

  useEffect(() => {
    (async () => {
      const ids = menuCharacters.map((c) => c.id);
      setQueue(await buildSessionQueue(db, ids, SESSION_SIZE));
    })();
  }, [db]);

  const startPrompt = useCallback(async () => {
    if (!currentItem) return;
    const chosen = await selectMethod(db, "character");
    setMethod(chosen);
    setRevealed(false);
    setPromptStartedAt(Date.now());
  }, [db, currentItem]);

  useEffect(() => {
    if (currentItem) startPrompt();
  }, [currentItem, startPrompt]);

  if (!queue) {
    return (
      <View style={styles.center}>
        <Text>Loading session…</Text>
      </View>
    );
  }

  if (!currentItem || !method) {
    return (
      <View style={styles.center}>
        <Text style={styles.doneTitle}>Session complete</Text>
        <Text style={styles.doneSubtitle}>Nothing else due right now — come back later.</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.primaryButtonText}>Back to home</Text>
        </Pressable>
      </View>
    );
  }

  const speak = () => Speech.speak(currentItem.hanzi, { language: "zh-CN" });
  const handleReveal = () => setRevealed(true);

  const handleRate = async (correct: boolean) => {
    const latencyMs = Date.now() - promptStartedAt;
    await logAttempt(db, currentItem.id, "character", method, correct, latencyMs);
    await recordMethodOutcome(db, "character", method, correct, latencyMs);
    const confidence = await getMethodConfidence(db, "character", method);
    await scheduleNextReview(db, currentItem.id, "character", correct, method, confidence);

    if (index + 1 < queue.length) {
      setIndex(index + 1);
    } else {
      setQueue([]);
      setMethod(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.progressLabel}>
        {index + 1} / {queue.length}
      </Text>

      {method === "radical_decomposition" && (
        <>
          <Text style={styles.instruction}>Which character is built from these parts?</Text>
          {currentItem.radicals.map((r) => (
            <Text key={r.radical} style={styles.radicalLine}>
              {r.radical} — {r.meaning}
            </Text>
          ))}
        </>
      )}

      {method === "mnemonic_story" && (
        <>
          <Text style={styles.instruction}>Which character does this memory aid describe?</Text>
          <Text style={styles.mnemonic}>{currentItem.mnemonicNote}</Text>
        </>
      )}

      {method === "flashcard_standard" && (
        <>
          <Text style={styles.instruction}>What does this character mean?</Text>
          <Text style={styles.hanzi}>{currentItem.hanzi}</Text>
        </>
      )}

      {!revealed ? (
        <Pressable style={styles.primaryButton} onPress={handleReveal}>
          <Text style={styles.primaryButtonText}>Reveal</Text>
        </Pressable>
      ) : (
        <View style={styles.revealBox}>
          <Text style={styles.hanzi}>{currentItem.hanzi}</Text>
          <Text style={styles.pinyin}>{currentItem.pinyin}</Text>
          <Text style={styles.meaning}>{currentItem.meaning}</Text>
          {currentItem.radicals.map((r) => (
            <Text key={r.radical} style={styles.radicalLine}>
              {r.radical} — {r.meaning}
            </Text>
          ))}
          {currentItem.sharesRadicalWith && currentItem.sharesRadicalWith.length > 0 && (
            <Text style={styles.structureNote}>
              Shares a radical with:{" "}
              {currentItem.sharesRadicalWith
                .map((id) => menuCharacters.find((c) => c.id === id)?.hanzi)
                .filter(Boolean)
                .join(", ")}
            </Text>
          )}
          <Pressable style={styles.secondaryButton} onPress={speak}>
            <Text style={styles.secondaryButtonText}>🔊 Hear it</Text>
          </Pressable>

          <View style={styles.rateRow}>
            <Pressable style={[styles.rateButton, styles.rateWrong]} onPress={() => handleRate(false)}>
              <Text style={styles.rateButtonText}>Got it wrong</Text>
            </Pressable>
            <Pressable style={[styles.rateButton, styles.rateRight]} onPress={() => handleRate(true)}>
              <Text style={styles.rateButtonText}>Got it right</Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 16, alignItems: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  progressLabel: { alignSelf: "flex-start", color: "#78716C" },
  instruction: { fontSize: 15, color: "#57534E", textAlign: "center" },
  hanzi: { fontSize: 48, fontWeight: "700", color: "#1C1917" },
  pinyin: { fontSize: 18, color: "#44403C" },
  meaning: { fontSize: 18, color: "#1C1917", textAlign: "center" },
  structureNote: { fontSize: 13, color: "#78716C", textAlign: "center", marginTop: 4 },
  mnemonic: { fontSize: 17, color: "#1C1917", textAlign: "center", fontStyle: "italic" },
  radicalLine: { fontSize: 16, color: "#44403C" },
  primaryButton: {
    backgroundColor: "#16A34A",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 12,
  },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  secondaryButton: { marginTop: 8 },
  secondaryButtonText: { color: "#1D4ED8" },
  revealBox: { alignItems: "center", gap: 8, marginTop: 8 },
  rateRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  rateButton: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  rateWrong: { backgroundColor: "#FEE2E2" },
  rateRight: { backgroundColor: "#DCFCE7" },
  rateButtonText: { fontWeight: "600", color: "#1C1917" },
  doneTitle: { fontSize: 20, fontWeight: "700" },
  doneSubtitle: { color: "#57534E" },
});
