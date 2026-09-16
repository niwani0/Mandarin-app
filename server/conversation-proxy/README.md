# Conversation proxy

A one-file Cloudflare Worker that sits between the app and the Anthropic API. It exists
so the API key never has to live inside the mobile app's bundle — Cloudflare stores it
as an encrypted secret, and the Worker is the only thing that ever sees it.

## Deploy (one-time, ~5 minutes)

1. Get an Anthropic API key: https://console.anthropic.com/ (this is a paid API — usage
   is billed per request, separate from any claude.ai subscription).
2. Install the Cloudflare CLI and log in:
   ```sh
   cd server/conversation-proxy
   npm install
   npx wrangler login
   ```
3. Set the two secrets (you'll be prompted to paste each value):
   ```sh
   npx wrangler secret put ANTHROPIC_API_KEY
   npx wrangler secret put APP_SHARED_SECRET
   ```
   `APP_SHARED_SECRET` can be anything — generate one with
   `openssl rand -hex 24` — it just has to match what you put in the app's
   `src/config/conversationConfig.ts`. This isn't real authentication, it just stops a
   stranger who stumbles on your Worker URL from spending your Anthropic credits.
4. Deploy:
   ```sh
   npx wrangler deploy
   ```
   This prints your Worker's URL, something like
   `https://mandarin-travel-conversation-proxy.<your-subdomain>.workers.dev`.
5. Put that URL and your `APP_SHARED_SECRET` into
   `src/config/conversationConfig.ts` in the main app.

## Cost

Cloudflare Workers' free tier (100k requests/day) covers personal use with room to
spare. Anthropic API usage is billed separately, per request — a short conversation
turn is a few hundred input/output tokens, so this is cheap for personal use but not
free; check current pricing at https://www.anthropic.com/pricing before relying on it
heavily.

## Reachability from mainland China

Not verified from inside China in this build. Cloudflare's reachability there has been
inconsistent historically — this may just work, or may need the same VPN you'd already
be using while traveling. Test it there before counting on it mid-trip.

## Local testing

`npm run dev` runs the Worker locally via `wrangler dev` (needs the same two secrets in
a local `.dev.vars` file — see Wrangler's docs — never commit that file).
