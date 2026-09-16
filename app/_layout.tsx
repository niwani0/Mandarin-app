import { Stack } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { DB_NAME } from "@/db/client";
import { migrateDbIfNeeded } from "@/db/schema";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SQLiteProvider databaseName={DB_NAME} onInit={migrateDbIfNeeded}>
          <Stack screenOptions={{ headerTitleAlign: "center" }}>
            <Stack.Screen name="index" options={{ title: "Mandarin Travel" }} />
            <Stack.Screen name="scenario/[id]" options={{ title: "Scenario" }} />
            <Stack.Screen name="characters/index" options={{ title: "Characters" }} />
            <Stack.Screen name="speaking/[wordId]" options={{ title: "Speaking Practice" }} />
            <Stack.Screen name="calibrate" options={{ title: "Calibration" }} />
            <Stack.Screen name="conversation/[scenarioId]" options={{ title: "Conversation" }} />
          </Stack>
        </SQLiteProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
