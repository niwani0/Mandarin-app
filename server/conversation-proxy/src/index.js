/**
 * Minimal proxy in front of the Anthropic Messages API.
 *
 * Exists for one reason: a mobile app's bundle is not a secure place to store an API
 * key — anyone can decompile the app and pull it out. This Worker holds the key as a
 * Cloudflare secret, and the app calls this instead of Anthropic directly.
 *
 * A second secret (APP_SHARED_SECRET) gates the endpoint so a stranger who finds the
 * Worker URL can't run up your Anthropic bill — it's not real auth, just enough friction
 * for a single-user personal app.
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
// Pinned to Sonnet 5 as of this build — check https://docs.claude.com/en/docs/about-claude/models
// for the current model ID before deploying, since these strings change over time.
const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 400;

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (request.method !== "POST" || new URL(request.url).pathname !== "/chat") {
      return json({ error: "Not found" }, 404);
    }

    const appSecret = request.headers.get("X-App-Secret");
    if (!env.APP_SHARED_SECRET || appSecret !== env.APP_SHARED_SECRET) {
      return json({ error: "Unauthorized" }, 401);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const { systemPrompt, messages } = body;
    if (typeof systemPrompt !== "string" || !Array.isArray(messages)) {
      return json({ error: "Expected { systemPrompt: string, messages: {role, content}[] }" }, 400);
    }

    const anthropicRes = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return json({ error: `Anthropic API error (${anthropicRes.status}): ${errText}` }, 502);
    }

    const data = await anthropicRes.json();
    const reply = (data.content || [])
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return json({ reply });
  },
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-App-Secret",
  };
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "content-type": "application/json", ...corsHeaders() },
  });
}
