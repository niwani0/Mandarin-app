# Mandarin Travel

A Mandarin app built for practical, day-to-day and travel use — not textbook Mandarin,
not Duolingo-style gamification. See design rationale below.

## Design principles

- **Production over recognition.** Reveal-then-self-rate replaces multiple-choice; the
  generation effect (recalling something yourself beats picking it from options) is why.
- **Situated content.** Vocabulary is tied to real scenarios (ordering food, transit,
  hotel, shopping), not decontextualized sentences.
- **Per-user adaptive method-matching.** `src/engine/adaptiveEngine.ts` implements a
  UCB1-style multi-armed bandit: it tries every teaching method (audio-first, context/story,
  active recall, standard flashcard, radical decomposition, mnemonic story), tracks an
  exponentially-weighted success rate per method, and shifts weight toward whichever one is
  actually producing correct, fast recall *for this user* — not a fixed pedagogy.
- **Personalized spacing.** `src/engine/srs.ts` is an SM-2-style scheduler, with intervals
  scaled by how much the just-used method is currently trusted for this user (a correct
  answer via your strongest method is trusted more than one via your weakest).
- **Character literacy via radicals.** `src/data/characters/menuCharacters.ts` decomposes
  each character into its real Kangxi radical(s), so recognition transfers across characters
  that share a component, instead of rote-memorizing each character independently.
- **No streaks, no guilt mechanics.** The home screen shows competence (% of items you've
  demonstrated durable recall on) rather than a streak counter.
- **Per-item calibration, not one global level.** Real skill is rarely a single number —
  someone can be solid on intermediate patterns and still blank on a basic one. Every item
  (`src/types/content.ts`'s `FrequencyTier`) is tagged 1 (essential) through 3 (situational),
  independent of when it was introduced. `/calibrate` lets you mark items you already know so
  the SRS queue starts from your actual baseline instead of zero, and new items are queued
  tier-first (`buildSessionQueue` in `src/db/repository.ts`) so a gap in something simple
  surfaces before rarer material. The home screen's "Patchy spot detected" card
  (`computeTierCompetence`) flags it directly when tier-1 competence lags behind tier-3 —
  the exact "good at some things, missing simple words" pattern this was built around.

- **Live AI conversation practice.** Fixed drilling has a ceiling — real conversational
  adequacy needs actual back-and-forth dialogue. `/conversation/[scenarioId]` runs a
  roleplay with an LLM partner via `src/services/conversationService.ts`. The system
  prompt (`src/engine/conversationPrompt.ts`) is built from the same review data as
  everything else: it tells the model what you're already solid on and what's shaky, so
  the conversation leans on known material and stretches gently instead of firehosing
  unfamiliar vocabulary. See "Conversation practice setup" below — this is the one
  feature that needs an API key and a deployed proxy.

## Scenarios

Ordering Food, Hotel, Transportation & Booking, and Small Talk — each a set of reusable
sentence-pattern templates (not fixed phrases) tagged by tier, in `src/data/scenarios/`.
Adding a new scenario is: a new file exporting a `Scenario` + `PatternItem[]`, registered in
`src/data/scenarios/index.ts`.

## What's real vs. placeholder

Everything above is fully wired and working, including the local SQLite-backed adaptive
engine and spaced-repetition scheduler — verified with a clean `tsc --noEmit` and a
successful Metro bundle (`expo export`).

**Tone/pronunciation feedback is one placeholder.** Real tone scoring needs
pitch-contour analysis against reference audio, not just speech-to-text, which means
picking an actual Mandarin pronunciation-assessment provider (Azure Speech, iFlytek, Baidu,
etc.) and wiring in real credentials. `src/services/toneFeedback.ts` defines the interface
and a `CloudToneFeedbackService` that throws until configured; until a provider is chosen,
the app uses `LocalHeuristicToneFeedbackService`, which is explicitly a placeholder — it
does not analyze the actual recording. Fill in `src/config/toneFeedbackConfig.ts` once a
provider is picked.

**Conversation practice is the other — it's built, but requires setup before it works.**
`src/config/conversationConfig.ts` is `null` by default, and the screen shows a clear
"not set up yet" error rather than crashing until you deploy the proxy and fill it in.
See "Conversation practice setup" below.

## Conversation practice setup

1. Deploy the Cloudflare Worker proxy — full steps in
   [`server/conversation-proxy/README.md`](./server/conversation-proxy/README.md). Takes
   about 5 minutes; needs an Anthropic API key (separate from any claude.ai subscription,
   billed per request).
2. Fill in `src/config/conversationConfig.ts` with the deployed Worker URL and the shared
   secret you set on it.
3. **Not verified reachable from mainland China in this build** — Cloudflare's history
   there is inconsistent. Test it from an actual China-based connection (with whatever
   VPN you'd normally use while traveling) before relying on it mid-trip. Everything else
   in the app doesn't have this problem, since it never leaves the phone.

## Offline behavior

Everything except tone feedback works fully offline: the scenario/character content is
bundled in the app, the adaptive engine and SRS scheduler run against local SQLite, and
`expo-speech` text-to-speech uses the on-device engine. Tone feedback needs connectivity
once a real cloud provider is wired in.

## Running it (personal use, no App Store)

This is not published anywhere and doesn't need to be — `app.json` sets a placeholder iOS
bundle identifier (`com.mandarintravel.personal`) which is enough for any of these paths.
Swap it for your own reverse-DNS string if you ever build a standalone binary.

**Fastest: Expo Go.** No Xcode, no Apple account needed.
```sh
npm install
npm run start   # scan the QR code with the Expo Go app on your iPhone
```
Everything in this app (expo-router, expo-sqlite, expo-audio, expo-speech) is part of the
standard Expo SDK, so it runs in Expo Go with no custom native code required.

**Standalone on your own phone, no App Store review:** `eas build --platform ios --profile
development` (or `preview` for ad-hoc) via `eas-cli`, with a free Apple ID for a 7-day
on-device install, or a paid Apple Developer Program membership ($99/yr) for ad-hoc
distribution that doesn't expire weekly. Only worth it once you want the app to have its own
icon instead of running inside Expo Go.

## Offline behavior on iOS

Recording uses `expo-audio`'s `AudioRecorder`; `NSMicrophoneUsageDescription` is set in
`app.json`. Text-to-speech (`expo-speech`) uses iOS's on-device voice — fully offline, no
data usage, works the same on a plane or with no SIM. SQLite (adaptive engine, SRS state,
calibration) is entirely local. The only thing that needs connectivity is cloud tone
feedback once that's wired in (see above) — everything else works with the phone in
airplane mode.

## Project layout

```
app/                    expo-router screens (file-based routing)
app/calibrate.tsx       placement flow — mark known items, seeds SRS baseline
app/conversation/       live AI roleplay chat screen
server/conversation-proxy/  Cloudflare Worker holding the Anthropic API key server-side
src/db/                 SQLite schema + repository queries
src/engine/             adaptive method-selection, SRS scheduler, conversation prompt builder
src/services/           pluggable tone-feedback + conversation-service interfaces
src/data/scenarios/     Ordering Food, Hotel, Transportation, Small Talk
src/data/characters/    menu/sign character radical-decomposition set
src/types/              shared content types (incl. FrequencyTier)
```
