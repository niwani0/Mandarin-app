import { useEffect, useRef, useState } from "react";
import { Stack, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import * as Speech from "expo-speech";

import { getPatternsForScenario, getScenario } from "@/data/scenarios";
import { getReviewStates } from "@/db/repository";
import { buildConversationSystemPrompt } from "@/engine/conversationPrompt";
import { CloudConversationService } from "@/services/conversationService";
import { conversationConfig } from "@/config/conversationConfig";
import type { ConversationTurn } from "@/types/content";

const service = new CloudConversationService(conversationConfig);

interface ParsedReply {
  mainLines: string[];
  english: string | null;
  note: string | null;
}

function parseReply(text: string): ParsedReply {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const mainLines: string[] = [];
  let english: string | null = null;
  let note: string | null = null;
  for (const line of lines) {
    if (line.startsWith("EN:")) english = line.slice(3).trim();
    else if (line.startsWith("Note:")) note = line.slice(5).trim();
    else mainLines.push(line);
  }
  return { mainLines, english, note };
}

function speakable(line: string): string {
  return line.replace(/\([^)]*\)/g, "").trim();
}

export default function ConversationScreen() {
  const { scenarioId } = useLocalSearchParams<{ scenarioId: string }>();
  const db = useSQLiteContext();
  const scenario = scenarioId ? getScenario(scenarioId) : undefined;

  const [messages, setMessages] = useState<ConversationTurn[]>([]);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!scenario) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const patterns = getPatternsForScenario(scenario.id);
        const reviewStates = await getReviewStates(db, patterns.map((p) => p.id));
        const systemPrompt = buildConversationSystemPrompt(scenario, patterns, reviewStates);
        const opening = await service.sendTurn(systemPrompt, [
          { role: "user", content: "[Begin the scene. Give your opening line now.]" },
        ]);
        setMessages([{ role: "assistant", content: opening }]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong starting the conversation.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioId]);

  if (!scenario) {
    return (
      <View style={styles.center}>
        <Text>Unknown scenario.</Text>
      </View>
    );
  }

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const nextMessages: ConversationTurn[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setLoading(true);
    setError(null);
    try {
      const patterns = getPatternsForScenario(scenario.id);
      const reviewStates = await getReviewStates(db, patterns.map((p) => p.id));
      const systemPrompt = buildConversationSystemPrompt(scenario, patterns, reviewStates);
      const reply = await service.sendTurn(systemPrompt, nextMessages);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong sending that.");
    } finally {
      setLoading(false);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: `${scenario.icon} ${scenario.title}` }} />

      <ScrollView ref={scrollRef} style={styles.thread} contentContainerStyle={styles.threadContent}>
        {messages.map((m, i) => {
          if (m.role === "user") {
            return (
              <View key={i} style={[styles.bubbleRow, styles.rowRight]}>
                <View style={[styles.bubble, styles.userBubble]}>
                  <Text style={styles.userText}>{m.content}</Text>
                </View>
              </View>
            );
          }
          const parsed = parseReply(m.content);
          const isRevealed = !!revealed[i];
          return (
            <View key={i} style={[styles.bubbleRow, styles.rowLeft]}>
              <View style={[styles.bubble, styles.aiBubble]}>
                {parsed.mainLines.map((line, li) => (
                  <Text key={li} style={styles.aiText}>
                    {line}
                  </Text>
                ))}
                <View style={styles.bubbleActions}>
                  <Pressable onPress={() => Speech.speak(speakable(parsed.mainLines.join(" ")), { language: "zh-CN" })}>
                    <Text style={styles.actionLink}>🔊</Text>
                  </Pressable>
                  {(parsed.english || parsed.note) && (
                    <Pressable onPress={() => setRevealed((r) => ({ ...r, [i]: !r[i] }))}>
                      <Text style={styles.actionLink}>{isRevealed ? "Hide" : "English"}</Text>
                    </Pressable>
                  )}
                </View>
                {isRevealed && (
                  <View style={styles.revealBox}>
                    {parsed.english && <Text style={styles.englishText}>{parsed.english}</Text>}
                    {parsed.note && <Text style={styles.noteText}>{parsed.note}</Text>}
                  </View>
                )}
              </View>
            </View>
          );
        })}
        {loading && (
          <View style={[styles.bubbleRow, styles.rowLeft]}>
            <ActivityIndicator color="#2E4AA0" />
          </View>
        )}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Couldn't reach the conversation service</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type your reply in Mandarin or pinyin…"
          placeholderTextColor="#9CA8A0"
          editable={!loading}
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <Pressable style={styles.sendButton} onPress={send} disabled={loading}>
          <Text style={styles.sendButtonText}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAF9" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  thread: { flex: 1 },
  threadContent: { padding: 16, gap: 10 },
  bubbleRow: { flexDirection: "row" },
  rowLeft: { justifyContent: "flex-start" },
  rowRight: { justifyContent: "flex-end" },
  bubble: { maxWidth: "82%", borderRadius: 14, padding: 12 },
  userBubble: { backgroundColor: "#2E4AA0" },
  userText: { color: "#fff", fontSize: 15 },
  aiBubble: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#DBE0D9" },
  aiText: { fontSize: 15, color: "#172420", lineHeight: 21 },
  bubbleActions: { flexDirection: "row", gap: 14, marginTop: 8 },
  actionLink: { fontSize: 12, color: "#2E4AA0", fontWeight: "600" },
  revealBox: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#DBE0D9", gap: 4 },
  englishText: { fontSize: 13, color: "#55635B" },
  noteText: { fontSize: 12, color: "#A9600D" },
  errorBox: { backgroundColor: "#F7E7E5", borderRadius: 12, padding: 14, gap: 4 },
  errorTitle: { fontWeight: "700", color: "#AC3B3B", fontSize: 13 },
  errorText: { fontSize: 12.5, color: "#AC3B3B", lineHeight: 18 },
  inputRow: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#DBE0D9",
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#DBE0D9",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: "#172420",
  },
  sendButton: {
    backgroundColor: "#2E4AA0",
    borderRadius: 20,
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  sendButtonText: { color: "#fff", fontWeight: "600" },
});
