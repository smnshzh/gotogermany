#!/usr/bin/env node
/**
 * Regenerate audio for all words and podcasts using the new high-quality TTS.
 * - German words: Piper (offline neural, very natural Thorsten voice)
 * - Persian podcasts: edge-tts (Microsoft neural, Persian native voice)
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function regenerateWords() {
  const words = await db.word.findMany();
  console.log(`\n=== Found ${words.length} words ===`);
  for (const w of words) {
    const text = w.example?.trim() || `${w.article || ''} ${w.german}`.trim();
    if (!text) continue;
    console.log(`Regenerating German audio for: ${w.german} -> "${text.slice(0, 50)}"`);
    try {
      const r = await fetch('http://localhost:3000/api/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, lang: 'de', speed: 1.0, voice: 'default' }),
      });
      if (!r.ok) {
        console.error(`  FAILED: HTTP ${r.status}`);
        continue;
      }
      const data = (await r.json()) as { url?: string; error?: string };
      if (data.url) {
        await db.word.update({ where: { id: w.id }, data: { audioUrl: data.url } });
        console.log(`  ✓ saved ${data.url}`);
      } else {
        console.error(`  FAILED: ${data.error}`);
      }
    } catch (e) {
      console.error(`  ERROR: ${e}`);
    }
  }
}

async function regeneratePodcasts() {
  const podcasts = await db.podcast.findMany();
  console.log(`\n=== Found ${podcasts.length} podcasts ===`);
  for (const p of podcasts) {
    if (!p.script) continue;
    console.log(`Regenerating ${p.language || 'fa'} audio for podcast: "${p.title}"`);
    try {
      const r = await fetch('http://localhost:3000/api/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: p.script, lang: p.language || 'fa', speed: 1.0, voice: 'default' }),
      });
      if (!r.ok) {
        console.error(`  FAILED: HTTP ${r.status}`);
        continue;
      }
      const data = (await r.json()) as { url?: string; error?: string };
      if (data.url) {
        await db.podcast.update({ where: { id: p.id }, data: { audioUrl: data.url } });
        console.log(`  ✓ saved ${data.url}`);
      } else {
        console.error(`  FAILED: ${data.error}`);
      }
    } catch (e) {
      console.error(`  ERROR: ${e}`);
    }
  }
}

async function main() {
  await regenerateWords();
  await regeneratePodcasts();
  await db.$disconnect();
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
