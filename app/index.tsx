import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";

import { orderingFoodPatterns, orderingFoodScenario } from "@/data/scenarios/orderingFood";
import { menuCharacters } from "@/data/characters/menuCharacters";
import { computeCompetence, countDue, getReviewStates } from "@/db/repository";
import { getBestMethod } from "@/engine/adaptiveEngine";
import { Card } from "@/components/Card";
import { ProgressBar } from "@/components/ProgressBar";

const METHOD_LABELS: Record<string, string> = {
  audio_first: "Audio-first",
  context_story: "Context / story",
  production_recall: "Active recall",
  flashcard_standard: "Standard flashcard",
  radical_decomposition: "Radical decomposition",
  mnemonic_story: "Mnemonic story",
};

export default function HomeScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [patternCompetence, setPatternCompetence] = useState(0);
  const [patternDue, setPatternDue] = useState(0);
  const [charCompetence, setCharCompetence] = useState(0);
  const [charDue, setCharDue] = useState(0);
  const [bestPatternMethod, setBestPatternMethod] = useState<string | null>(null);
  const [bestCharMethod, setBestCharMethod] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const patternIds = orderingFoodPatterns.map((p) => p.id);
        const charIds = menuCharacters.map((c) => c.id);

        const [patternReviews, charReviews, bestPattern, bestChar] = await Promise.all([
          getReviewStates(db, patternIds),
          getReviewStates(db, charIds),
          getBestMethod(db, "pattern"),
          getBestMethod(db, "character"),
        ]);

        if (cancelled) return;
        setPatternCompetence(computeCompetence(patternReviews, patternIds));
        setPatternDue(countDue(patternReviews, patternIds));
        setCharCompetence(computeCompetence(charReviews, charIds));
        setCharDue(countDue(charReviews, charIds));
        setBestPatternMethod(bestPattern ? METHOD_LABELS[bestPattern.method] : null);
        setBestCharMethod(bestChar ? METHOD_LABELS[bestChar.method] : null);
      })();
      return () => {
        cancelled = true;
      };
    }, [db]),
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>What you can handle right now</Text>

      <Card onPress={() => router.push(`/scenario/${orderingFoodScenario.id}`)}>
        <Text style={styles.cardTitle}>{orderingFoodScenario.title}</Text>
        <Text style={styles.cardSubtitle}>{orderingFoodScenario.description}</Text>
        <ProgressBar progress={patternCompetence} />
        <Text style={styles.cardMeta}>
          {Math.round(patternCompetence * 100)}% solid · {patternDue} due for review
        </Text>
      </Card>

      <Card onPress={() => router.push("/characters")}>
        <Text style={styles.cardTitle}>Menu &amp; Sign Characters</Text>
        <Text style={styles.cardSubtitle}>Build real reading via radical patterns.</Text>
        <ProgressBar progress={charCompetence} />
        <Text style={styles.cardMeta}>
          {Math.round(charCompetence * 100)}% solid · {charDue} due for review
        </Text>
      </Card>

      {(bestPatternMethod || bestCharMethod) && (
        <View style={styles.insightBox}>
          <Text style={styles.insightTitle}>What's working for you</Text>
          {bestPatternMethod && <Text style={styles.insightLine}>Sentences: {bestPatternMethod}</Text>}
          {bestCharMethod && <Text style={styles.insightLine}>Characters: {bestCharMethod}</Text>}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAF9" },
  content: { padding: 20, gap: 16 },
  heading: { fontSize: 22, fontWeight: "700", color: "#1C1917", marginBottom: 4 },
  cardTitle: { fontSize: 18, fontWeight: "600", color: "#1C1917" },
  cardSubtitle: { fontSize: 14, color: "#57534E", marginTop: 2, marginBottom: 12 },
  cardMeta: { fontSize: 13, color: "#78716C", marginTop: 8 },
  insightBox: { backgroundColor: "#EFF6FF", borderRadius: 12, padding: 16, gap: 4 },
  insightTitle: { fontWeight: "600", color: "#1E3A8A", marginBottom: 4 },
  insightLine: { color: "#1E40AF", fontSize: 14 },
});
