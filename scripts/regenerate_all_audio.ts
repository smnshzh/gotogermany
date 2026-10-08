#!/usr/bin/env node
/**
 * Regenerate German audio for all words in the database.
 * Calls the API endpoint so we exercise the real path.
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function regenerate() {
  const words = await db.word.findMany();
  console.log(`Found ${words.length} words`);

  for (const w of words) {
    const text = w.example?.trim() || `${w.article || ''} ${w.german}`.trim();
    if (!text) continue;
    console.log(`Generating German audio for: ${w.german} -> "${text}"`);
    try {
      const r = await fetch('http://localhost:3000/api/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, lang: 'de', speed: 0.95 }),
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
  await db.$disconnect();
  console.log('Done.');
}

regenerate().catch((e) => {
  console.error(e);
  process.exit(1);
});
