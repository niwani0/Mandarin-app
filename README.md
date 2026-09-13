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

## What's real vs. placeholder

Everything above is fully wired and working, including the local SQLite-backed adaptive
engine and spaced-repetition scheduler — verified with a clean `tsc --noEmit` and a
successful Metro bundle (`expo export`).

**Tone/pronunciation feedback is the one placeholder.** Real tone scoring needs
pitch-contour analysis against reference audio, not just speech-to-text, which means
picking an actual Mandarin pronunciation-assessment provider (Azure Speech, iFlytek, Baidu,
etc.) and wiring in real credentials. `src/services/toneFeedback.ts` defines the interface
and a `CloudToneFeedbackService` that throws until configured; until a provider is chosen,
the app uses `LocalHeuristicToneFeedbackService`, which is explicitly a placeholder — it
does not analyze the actual recording. Fill in `src/config/toneFeedbackConfig.ts` once a
provider is picked.

## Offline behavior

Everything except tone feedback works fully offline: the scenario/character content is
bundled in the app, the adaptive engine and SRS scheduler run against local SQLite, and
`expo-speech` text-to-speech uses the on-device engine. Tone feedback needs connectivity
once a real cloud provider is wired in.

## Running it

```sh
npm install
npm run start   # then open in Expo Go, or npm run ios / npm run android
```

## Project layout

```
app/                    expo-router screens (file-based routing)
src/db/                 SQLite schema + repository queries
src/engine/             adaptive method-selection + spaced-repetition scheduler
src/services/           pluggable tone-feedback interface
src/data/               seed content (Ordering Food scenario, menu characters)
src/types/              shared content types
```
