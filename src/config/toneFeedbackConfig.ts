import type { CloudToneFeedbackConfig } from "@/services/toneFeedback";

/**
 * Fill this in once a Mandarin pronunciation-assessment provider is chosen
 * (e.g. Azure Speech, iFlytek, Baidu). Until then this stays null and the app
 * falls back to the local placeholder scorer — see services/toneFeedback.ts.
 */
export const cloudToneFeedbackConfig: CloudToneFeedbackConfig | null = null;
