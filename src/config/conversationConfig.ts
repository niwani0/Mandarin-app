import type { ConversationConfig } from "@/services/conversationService";

/**
 * Fill this in once server/conversation-proxy is deployed (see its README).
 *
 * - proxyUrl: the Worker URL `wrangler deploy` prints, e.g.
 *   "https://mandarin-travel-conversation-proxy.YOUR-SUBDOMAIN.workers.dev"
 * - appSecret: must match whatever value you set with `wrangler secret put
 *   APP_SHARED_SECRET` on the proxy — not the Anthropic key itself.
 *
 * Treat this file as sensitive once filled in and avoid committing real values if this
 * repo is ever made public.
 */
export const conversationConfig: ConversationConfig | null = null;
