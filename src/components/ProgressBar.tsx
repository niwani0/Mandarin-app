import { StyleSheet, View } from "react-native";

export function ProgressBar({ progress }: { progress: number }) {
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${clamped * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E7E5E4",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: "#16A34A",
    borderRadius: 4,
  },
});
