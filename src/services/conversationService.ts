import type { ConversationTurn } from "@/types/content";

/**
 * A live AI conversation partner — the actual fix for "not extensive enough" phrase
 * coverage: infinite dialogue variety instead of a fixed hand-written list, tailored to
 * what the learner already knows via the system prompt (see conversationPrompt.ts).
 *
 * The API key never lives in this app: `CloudConversationService` talks to a small
 * Cloudflare Worker proxy (see /server/conversation-proxy) that holds the real
 * Anthropic key server-side. Until that proxy is deployed and configured, this throws a
 * clear error rather than pretending to work.
 */

export interface ConversationConfig {
  proxyUrl: string;
  appSecret: string;
}

export interface ConversationService {
  sendTurn(systemPrompt: string, history: ConversationTurn[]): Promise<string>;
}

export class CloudConversationService implements ConversationService {
  constructor(private config: ConversationConfig | null) {}

  async sendTurn(systemPrompt: string, history: ConversationTurn[]): Promise<string> {
    if (!this.config) {
      throw new Error(
        "Conversation practice isn't set up yet. Deploy server/conversation-proxy (see its " +
          "README), then fill in src/config/conversationConfig.ts with the deployed URL and " +
          "shared secret.",
      );
    }

    const response = await fetch(`${this.config.proxyUrl}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-App-Secret": this.config.appSecret,
      },
      body: JSON.stringify({ systemPrompt, messages: history }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Conversation proxy returned ${response.status}: ${body}`);
    }

    const data = (await response.json()) as { reply?: string; error?: string };
    if (data.error) throw new Error(data.error);
    if (!data.reply) throw new Error("Conversation proxy returned an empty reply.");
    return data.reply;
  }
}
