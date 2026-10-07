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
