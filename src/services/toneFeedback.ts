/**
 * Tone/pronunciation feedback is intentionally pluggable behind this interface.
 *
 * Real tone scoring needs pitch-contour analysis against reference audio — not just
 * speech-to-text — and that means picking an actual provider with Mandarin tone
 * support (e.g. Azure Speech pronunciation assessment, iFlytek, Baidu) and wiring in
 * real API credentials. Nothing in this repo calls a real provider yet: `CloudToneFeedbackService`
 * throws until it's configured, and `LocalHeuristicToneFeedbackService` is a clearly-labeled
 * placeholder for development, not a substitute for real scoring.
 */

export interface ToneFeedbackResult {
  /** 0-1 overall confidence the recording matches the target tones/pronunciation. */
  score: number;
  /** Per-syllable breakdown when the provider supports it. */
  syllableFeedback?: { syllable: string; expectedTone: number; detectedTone: number | null; correct: boolean }[];
  summary: string;
}

export interface ToneFeedbackService {
  analyzeRecording(recordingUri: string, expectedPinyin: string): Promise<ToneFeedbackResult>;
}

export interface CloudToneFeedbackConfig {
  endpointUrl: string;
  apiKey: string;
}

export class CloudToneFeedbackService implements ToneFeedbackService {
  constructor(private config: CloudToneFeedbackConfig | null) {}

  async analyzeRecording(recordingUri: string, expectedPinyin: string): Promise<ToneFeedbackResult> {
    if (!this.config) {
      throw new Error(
        "Cloud tone feedback isn't configured yet. Pick a Mandarin pronunciation-assessment " +
          "provider, set its endpoint/API key (e.g. via app config or a secure store), and pass " +
          "them into CloudToneFeedbackConfig before this can run.",
      );
    }
    const body = new FormData();
    body.append("audio", { uri: recordingUri, name: "recording.m4a", type: "audio/m4a" } as unknown as Blob);
    body.append("expectedPinyin", expectedPinyin);

    const response = await fetch(this.config.endpointUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.apiKey}` },
      body,
    });
    if (!response.ok) {
      throw new Error(`Tone feedback provider returned ${response.status}`);
    }
    return (await response.json()) as ToneFeedbackResult;
  }
}

/**
 * Placeholder used until a real provider is wired up. Returns a plausible-looking
 * result so the UI/flow can be built and demoed end-to-end offline, but the score is
 * NOT derived from the actual recording — do not treat it as real feedback.
 */
export class LocalHeuristicToneFeedbackService implements ToneFeedbackService {
  async analyzeRecording(_recordingUri: string, expectedPinyin: string): Promise<ToneFeedbackResult> {
    const syllables = expectedPinyin.split(/\s+/).filter(Boolean);
    const score = 0.6 + Math.random() * 0.3;
    return {
      score,
      syllableFeedback: syllables.map((syllable) => ({
        syllable,
        expectedTone: Number(syllable.match(/[1-4]$/)?.[0] ?? 0),
        detectedTone: null,
        correct: Math.random() > 0.3,
      })),
      summary: "Placeholder feedback — cloud tone scoring isn't configured. See toneFeedback.ts.",
    };
  }
}
