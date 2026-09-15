import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";

import { allPatterns, getPatternsForScenario, scenarios } from "@/data/scenarios";
import { menuCharacters } from "@/data/characters/menuCharacters";
import { computeCompetence, computeTierCompetence, countDue, getReviewStates } from "@/db/repository";
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

interface ScenarioProgress {
  scenarioId: string;
  competence: number;
  due: number;
}

export default function HomeScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [scenarioProgress, setScenarioProgress] = useState<ScenarioProgress[]>([]);
  const [charCompetence, setCharCompetence] = useState(0);
  const [charDue, setCharDue] = useState(0);
  const [bestPatternMethod, setBestPatternMethod] = useState<string | null>(null);
  const [bestCharMethod, setBestCharMethod] = useState<string | null>(null);
  const [tierGapMessage, setTierGapMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const allPatternIds = allPatterns.map((p) => p.id);
        const charIds = menuCharacters.map((c) => c.id);

        const [allPatternReviews, charReviews, bestPattern, bestChar] = await Promise.all([
          getReviewStates(db, allPatternIds),
          getReviewStates(db, charIds),
          getBestMethod(db, "pattern"),
          getBestMethod(db, "character"),
        ]);

        if (cancelled) return;

        const progress = scenarios.map((s) => {
          const ids = getPatternsForScenario(s.id).map((p) => p.id);
          return {
            scenarioId: s.id,
            competence: computeCompetence(allPatternReviews, ids),
            due: countDue(allPatternReviews, ids),
          };
        });
        setScenarioProgress(progress);

        setCharCompetence(computeCompetence(charReviews, charIds));
        setCharDue(countDue(charReviews, charIds));
        setBestPatternMethod(bestPattern ? METHOD_LABELS[bestPattern.method] : null);
        setBestCharMethod(bestChar ? METHOD_LABELS[bestChar.method] : null);

        const tierCompetence = computeTierCompetence(allPatternReviews, allPatterns);
        const attempted = allPatternIds.some((id) => allPatternReviews.has(id));
        if (attempted && tierCompetence[1] < tierCompetence[3] - 0.15) {
          setTierGapMessage(
            `Your basics need attention: ${Math.round(tierCompetence[1] * 100)}% solid on the simplest, most essential phrases, vs ${Math.round(
              tierCompetence[3] * 100,
            )}% on rarer ones. Worth reviewing the fundamentals.`,
          );
        } else {
          setTierGapMessage(null);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [db]),
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>What you can handle right now</Text>

      {scenarios.map((scenario) => {
        const progress = scenarioProgress.find((p) => p.scenarioId === scenario.id);
        return (
          <Card key={scenario.id} onPress={() => router.push(`/scenario/${scenario.id}`)}>
            <Text style={styles.cardTitle}>
              {scenario.icon} {scenario.title}
            </Text>
            <Text style={styles.cardSubtitle}>{scenario.description}</Text>
            <ProgressBar progress={progress?.competence ?? 0} />
            <Text style={styles.cardMeta}>
              {Math.round((progress?.competence ?? 0) * 100)}% solid · {progress?.due ?? 0} due for review
            </Text>
          </Card>
        );
      })}

      <Card onPress={() => router.push("/characters")}>
        <Text style={styles.cardTitle}>📖 Menu &amp; Sign Characters</Text>
        <Text style={styles.cardSubtitle}>Build real reading via radical patterns.</Text>
        <ProgressBar progress={charCompetence} />
        <Text style={styles.cardMeta}>
          {Math.round(charCompetence * 100)}% solid · {charDue} due for review
        </Text>
      </Card>

      {tierGapMessage && (
        <View style={styles.gapBox}>
          <Text style={styles.gapTitle}>Patchy spot detected</Text>
          <Text style={styles.gapLine}>{tierGapMessage}</Text>
        </View>
      )}

      {(bestPatternMethod || bestCharMethod) && (
        <View style={styles.insightBox}>
          <Text style={styles.insightTitle}>What's working for you</Text>
          {bestPatternMethod && <Text style={styles.insightLine}>Sentences: {bestPatternMethod}</Text>}
          {bestCharMethod && <Text style={styles.insightLine}>Characters: {bestCharMethod}</Text>}
        </View>
      )}

      <Pressable style={styles.calibrateButton} onPress={() => router.push("/calibrate")}>
        <Text style={styles.calibrateButtonText}>Calibrate my level</Text>
      </Pressable>
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
  gapBox: { backgroundColor: "#FEF3C7", borderRadius: 12, padding: 16, gap: 4 },
  gapTitle: { fontWeight: "600", color: "#92400E", marginBottom: 4 },
  gapLine: { color: "#92400E", fontSize: 14 },
  calibrateButton: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D6D3D1",
    marginTop: 8,
  },
  calibrateButtonText: { color: "#57534E", fontSize: 14 },
});
