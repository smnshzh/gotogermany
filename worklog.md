# Worklog

---
Task ID: main
Agent: main (Super Z)
Task: Build an interactive German vocabulary learning website with AI enrichment, Persian translation, TTS audio, categories, sequential learning, and quizzes.

Work Log:
- Initialized Next.js 16 + Tailwind 4 + shadcn/ui project (fullstack-dev skill)
- Designed Prisma schema: Category (name, description, color), Word (german, article, plural, ipa, persian, example, exampleFa, audioUrl, note, categoryId)
- Built API routes:
  - `/api/words` (GET list, POST create)
  - `/api/words/[id]` (PUT update, DELETE)
  - `/api/categories` (GET list, POST create)
  - `/api/categories/[id]` (PUT, DELETE)
  - `/api/ai/enrich` — Uses Z.ai LLM to detect article (der/die/das), plural, IPA, Persian translation, German example sentence + Persian translation
  - `/api/audio` — Uses Z.ai TTS (wav format, voice: tongtong, speed 0.9) to generate audio files saved in `public/audio/`
- Built 4-tab RTL Persian UI:
  1. Words tab: Add-word form with "تکمیل هوشمند" (AI enrich) button + audio generation + word list with edit/delete/category quick-assign
  2. Categories tab: Create categories with color picker, list with delete
  3. Learn tab: Sequential flashcard mode with auto-play, prev/next, reveal toggle, audio auto-generation
  4. Quiz tab: Two modes — translation (German → Persian 4-choice) and pronunciation (audio → German 4-choice), score tracking, results screen
- Added Vazirmatn font for Persian, RTL layout, emerald/amber color scheme
- Fixed effect state-management issues using refs to track in-flight audio generation without causing effect cleanups
- Verified all flows with Agent Browser: AI enrichment, audio generation, word save, category creation/assignment, learning navigation, translation quiz, pronunciation quiz

Stage Summary:
- Project is fully functional at http://localhost:3000
- All 8 sample words (Haus, Apfel, Hund, Schule, Buch, Wasser, Freund, Stadt, Blume) successfully enriched with AI
- Audio files generated and stored in public/audio/
- Categories can be created and assigned to words inline
- Quiz mode correctly displays questions, accepts answers, shows correct/incorrect feedback, tracks score
- Lint passes cleanly

---
Task ID: audio-fix
Agent: main (Super Z)
Task: Fix TTS pronunciation — words were being read in English/Chinese instead of German.

Work Log:
- Diagnosed: Z.ai's TTS API only supports Chinese/English voices (tongtong, jam, etc.). No German voice available.
- Solution: Replace Z.ai TTS with proper German TTS engine:
  - Primary: gTTS (Google Translate TTS) via Python — high quality, native German pronunciation, requires internet
  - Fallback: espeak-ng (offline) with German voice `de`
  - Both produce mp3 output via ffmpeg when available
- Created `/home/z/my-project/scripts/generate_tts.py` that runs gTTS first, then espeak-ng fallback
- Rewrote `/home/z/my-project/src/app/api/audio/route.ts` to spawn the Python script via execFile
- Updated signature to accept `lang` (default 'de') and `speed` (default 0.95) instead of voice
- Updated client `api.generateAudio` and all callers (words-tab, learn-tab, quiz-tab) to pass `lang: 'de'`
- Created `/home/z/my-project/scripts/regenerate_all_audio.ts` to bulk-regenerate audio for existing words
- Cleared all old audio files in /public/audio/
- Regenerated audio for all 9 existing words (Haus, Apfel, Hund, Schule, Buch, Wasser, Freund, Stadt, Blume) — all now proper German pronunciation
- Verified with Agent Browser: audio plays correctly in Learn tab and Quiz tab (pronunciation mode)

Stage Summary:
- All words now play with correct German pronunciation (Google Translate TTS voice)
- Files saved as .mp3 instead of .wav (smaller, better browser support)
- The system gracefully falls back to offline espeak-ng German voice if gTTS is unavailable
- Lint passes cleanly

---
Task ID: podcast-feature
Agent: main (Super Z)
Task: Add AI-powered podcast generation feature (Persian script + Persian audio).

Work Log:
- Installed `edge-tts` (Microsoft Edge Neural TTS) — supports both Persian (fa-IR) and German (de-DE) with native pronunciation
  - Persian voices: fa-IR-DilaraNeural (female), fa-IR-FaridNeural (male)
  - German voices: de-DE-ConradNeural, de-DE-AmalaNeural, etc.
- Rewrote `/home/z/my-project/scripts/generate_tts.py` to try edge-tts first, then gTTS (non-Persian only), then espeak-ng as last resort
- Updated `/api/audio` route to accept `voice` parameter ('default' | 'male' | 'female')
- Added `Podcast` model to Prisma schema (topic, title, script, duration, audioUrl)
- Created API routes:
  - `/api/podcasts` (GET list, POST create)
  - `/api/podcasts/[id]` (PUT update, DELETE)
  - `/api/ai/podcast` — uses Z.ai LLM with custom Persian system prompt to generate podcast script with title, body, duration. Supports length (short/medium/long), style (narrative/qa/list/story), and optional word hints from the user's vocabulary list.
- Built PodcastTab component with:
  - Topic input + length + style selection
  - Generate button that calls LLM
  - Editable generated title/script
  - Voice gender selector (default/male/female)
  - Audio generation with play/pause controls and download link
  - Save button to persist to database
  - Saved podcasts list with audio player and regenerate-audio action
- Added "پادکست" tab to main page (5th tab)
- Verified end-to-end with Agent Browser: topic entry → AI script generation → audio generation → save → list display

Stage Summary:
- Persian TTS now uses native Persian voice (Farid male or Dilara female) instead of fallback English/Chinese
- German TTS now also uses edge-tts neural voice (much better quality than gTTS)
- Podcast feature is fully functional: input topic → AI writes script → AI generates Persian audio → save/list/replay
- All lint checks pass
- Existing word audio may still use old gTTS mp3s; new words/podcasts will use the better edge-tts voices

---
Task ID: multilang-podcast-and-telegram-bot
Agent: main (Super Z)
Task: (1) Make podcasts work in multiple languages (not just Persian). (2) Connect the site to Telegram via the user-provided bot token.

Work Log:
- Added `language` field to the Podcast Prisma model (fa/de/en/fr/es/tr/ar), default 'fa'
- Rewrote `/api/ai/podcast/route.ts` with per-language system prompts, length guides, style guides, and duration fallback strings for 7 languages
- Updated `Podcast` type, `generatePodcastScript` API client, `/api/podcasts` POST and PUT routes to accept and persist `language`
- Updated `PodcastTab` UI:
  - 7-language selector grid with flags (🇮🇷 🇩🇪 🇬🇧 🇫🇷 🇪🇸 🇹🇷 🇸🇦)
  - Generated script keeps the chosen language (genLanguage state)
  - Audio generation uses the chosen language
  - Saved podcasts show a colored language badge (purple)
- The TTS engine (edge-tts via `generate_tts.py`) already supports all 7 languages natively — no script changes needed
- Verified end-to-end with Agent Browser: German podcast generated + German audio produced
- Telegram bot setup:
  - Verified bot token — bot is `@germanlearn2_bot`
  - Created `mini-services/telegram-bot/` with its own `package.json` and `index.ts`
  - Uses the project's Prisma client + SQLite database (no separate DB)
  - Uses `z-ai-web-dev-sdk` for AI enrichment and podcast script generation
  - Calls the existing `generate_tts.py` script for audio
  - Long-polls Telegram for updates (no webhook/port needed)
  - Commands implemented:
    - `/start`, `/help` — Persian welcome + command list
    - `/add <word>` — AI-enriches German word (article, plural, IPA, Persian translation, example) and saves to DB
    - `/word <german>` — lookup by German or Persian
    - `/words [n]` — list last N words
    - `/cats` — list categories
    - `/audio <german>` — sends German TTS audio file
    - `/podcast <topic>` — generates Persian podcast script + audio, sends both, saves to DB
    - `/stats` — word/category/podcast counts
  - Plain text messages (without `/`) are treated as `/add <text>` for convenience
- Bot started in background with `setsid nohup bun run index.ts`

Stage Summary:
- Podcasts now work in 7 languages: Persian, German, English, French, Spanish, Turkish, Arabic — each with native TTS voice
- Telegram bot `@germanlearn2_bot` is live and responds to commands; it shares the same database as the web app
- All lint checks pass
