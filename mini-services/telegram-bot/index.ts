/**
 * Almoz Telegram Bot
 *
 * Connects the Almoz German vocabulary learning app to Telegram.
 * Polls Telegram for updates and responds to commands.
 *
 * Commands:
 *   /start           — Welcome + help
 *   /help             — Show help
 *   /add <word>       — Add a German word (AI enriches article, plural, IPA, Persian translation, example)
 *   /word <id|german>— Lookup a word by ID or German text
 *   /words [n]        — List last N words (default 10)
 *   /cats              — List all categories
 *   /audio <german>   — Send audio for a word
 *   /podcast <topic>  — Generate a short Persian podcast about a topic and send the audio
 *   /stats             — Show word/category/podcast counts
 *
 * Run: bun run dev (in mini-services/telegram-bot)
 */

import { PrismaClient } from '@prisma/client';
import ZAI from 'z-ai-web-dev-sdk';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const execFileAsync = promisify(execFile);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8734212330:AAEoG25st3LOq7rG23lCLs0XJV8Lk2NK5nQ';
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
const DB_URL = process.env.DATABASE_URL || 'file:/home/z/my-project/db/custom.db';
const PROJECT_ROOT = '/home/z/my-project';
const TTS_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'generate_tts.py');
const PYTHON_BIN = '/home/z/.venv/bin/python3';
const AUDIO_DIR = path.join(PROJECT_ROOT, 'public', 'audio');

// Set DATABASE_URL for Prisma
process.env.DATABASE_URL = DB_URL;

const db = new PrismaClient();

// === Telegram API helpers ===
async function tg(method: string, payload: Record<string, unknown> = {}): Promise<any> {
  const res = await fetch(`${API_BASE}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json() as any;
  if (!json.ok) {
    console.error(`Telegram API ${method} failed:`, json.description);
  }
  return json;
}

async function sendMessage(chatId: number | string, text: string, replyToId?: number) {
  return tg('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    reply_to_message_id: replyToId,
    disable_web_page_preview: true,
  });
}

async function sendAudio(chatId: number | string, audioPath: string, caption?: string) {
  // Use multipart/form-data for file upload
  const FormData = (await import('undici')).FormData;
  const Blob = (await import('undici')).Blob;
  const fileBuf = await fs.readFile(audioPath);
  const form = new FormData();
  form.append('chat_id', String(chatId));
  if (caption) form.append('caption', caption);
  form.append('audio', new Blob([fileBuf]), path.basename(audioPath));
  const res = await fetch(`${API_BASE}/sendAudio`, {
    method: 'POST',
    body: form,
  });
  return res.json();
}

// === AI enrichment ===
interface EnrichResult {
  article: string | null;
  plural: string | null;
  ipa: string | null;
  persian: string;
  example: string | null;
  exampleFa: string | null;
}

async function enrichWord(word: string): Promise<EnrichResult> {
  const SYSTEM = `You are an expert German lexicographer and Persian (Farsi) translator.
Given a German word, return ONLY a JSON object with keys:
- article: "der" | "die" | "das" or null for non-nouns
- plural: plural form without article, or null
- ipa: IPA transcription like "haʊs", or null
- persian: best Persian (Farsi) translation
- example: short German example sentence using the word
- exampleFa: Persian translation of the example
Return ONLY JSON, no markdown.`;

  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `German word: ${word}` },
    ],
    thinking: { type: 'disabled' },
  });
  const raw = completion.choices[0]?.message?.content || '';
  return parseJsonLoose(raw) as EnrichResult;
}

function parseJsonLoose(s: string): any {
  let t = s.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch {
    try {
      return JSON.parse(t.slice(start, end + 1).replace(/,(\s*[}\]])/g, '$1'));
    } catch {
      return null;
    }
  }
}

// === TTS ===
async function generateAudio(text: string, lang: string, voice: string = 'default', speed: number = 1.0): Promise<string> {
  const outDir = path.join(AUDIO_DIR);
  await fs.mkdir(outDir, { recursive: true });
  const id = crypto.randomBytes(8).toString('hex');

  // Run Python script
  const { stdout } = await execFileAsync(PYTHON_BIN, [
    TTS_SCRIPT, '--text', text.slice(0, 3000), '--lang', lang, '--speed', String(speed), '--voice', voice,
  ], { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024, timeout: 60000 });
  const m = stdout.match(/OUT:(\S+)/);
  if (!m) throw new Error('TTS produced no output');
  const tmpPath = m[1];
  const isMp3 = tmpPath.toLowerCase().endsWith('.mp3');
  const filename = `${id}.${isMp3 ? 'mp3' : 'wav'}`;
  const finalPath = path.join(outDir, filename);
  await fs.rename(tmpPath, finalPath);
  return `/audio/${filename}`;
}

// === Command handlers ===
async function handleStart(chatId: number) {
  const text = `سلام! 🇩🇪 به ربات <b>آلموز</b> خوش آمدید.

با این ربات می‌توانید:
• کلمات آلمانی را ثبت کنید — هوش مصنوعی مقاله (der/die/das)، جمع، تلفظ و ترجمه فارسی را خودکار پر می‌کند
• کلمات را جستجو و ببینید
• فایل صوتی تلفظ آلمانی دریافت کنید
• پادکست کوتاه درباره هر موضوعی بسازید

دستورات:
<code>/add &lt;کلمه&gt;</code> — افزودن کلمه آلمانی
<code>/word &lt;کلمه&gt;</code> — جستجوی کلمه
<code>/words</code> — فهرست آخرین کلمات
<code>/cats</code> — فهرست دسته‌بندی‌ها
<code>/audio &lt;کلمه&gt;</code> — دریافت فایل صوتی تلفظ
<code>/podcast &lt;موضوع&gt;</code> — ساخت پادکست کوتاه فارسی
<code>/stats</code> — آمار کلی

مثال:
<code>/add Haus</code>
<code>/audio Apfel</code>
<code>/podcast چرا یادگیری آلمانی مفید است</code>`;
  await sendMessage(chatId, text);
}

async function handleHelp(chatId: number) {
  return handleStart(chatId);
}

async function handleAdd(chatId: number, args: string) {
  const word = args.trim();
  if (!word) {
    await sendMessage(chatId, 'از این دستور استفاده کنید: <code>/add Haus</code>');
    return;
  }
  const cleaned = word.replace(/^(der|die|das)\s+/i, '');
  await sendMessage(chatId, `🔍 در حال تکمیل «${cleaned}» با هوش مصنوعی...`);

  try {
    const r = await enrichWord(cleaned);
    if (!r || !r.persian) {
      await sendMessage(chatId, '❌ هوش مصنوعی نتوانست این کلمه را تکمیل کند. دوباره امتحان کنید.');
      return;
    }

    // Save to DB
    const created = await db.word.create({
      data: {
        german: cleaned,
        article: r.article || null,
        plural: r.plural || null,
        ipa: r.ipa || null,
        persian: r.persian,
        example: r.example || null,
        exampleFa: r.exampleFa || null,
      },
    });

    const article = r.article ? `<b>${r.article}</b> ` : '';
    const plural = r.plural ? `\n🔹 جمع: <code>${r.plural}</code>` : '';
    const ipa = r.ipa ? `\n🔹 تلفظ: /${r.ipa}/` : '';
    const example = r.example ? `\n\n📝 مثال: <i>${r.example}</i>` : '';
    const exampleFa = r.exampleFa ? `\n${r.exampleFa}` : '';

    const text = `✅ کلمه ذخیره شد (#${created.id.slice(-6)})

${article}<b>${cleaned}</b>${plural}${ipa}
🔹 ترجمه: ${r.persian}${example}${exampleFa}

با <code>/audio ${cleaned}</code> فایل صوتی تلفظ را بگیرید.`;
    await sendMessage(chatId, text);
  } catch (e) {
    console.error('add error', e);
    await sendMessage(chatId, '❌ خطا در پردازش. دوباره امتحان کنید.');
  }
}

async function handleWord(chatId: number, args: string) {
  const q = args.trim();
  if (!q) {
    await sendMessage(chatId, 'از این دستور استفاده کنید: <code>/word Haus</code>');
    return;
  }
  const words = await db.word.findMany({
    where: {
      OR: [
        { german: { contains: q } },
        { persian: { contains: q } },
      ],
    },
    take: 5,
    orderBy: { createdAt: 'desc' },
  });
  if (words.length === 0) {
    await sendMessage(chatId, `کلمه‌ای برای «${q}» پیدا نشد.`);
    return;
  }
  for (const w of words) {
    const article = w.article ? `<b>${w.article}</b> ` : '';
    const plural = w.plural ? `\n🔹 جمع: <code>${w.plural}</code>` : '';
    const ipa = w.ipa ? `\n🔹 تلفظ: /${w.ipa}/` : '';
    const example = w.example ? `\n\n📝 مثال: <i>${w.example}</i>` : '';
    const exampleFa = w.exampleFa ? `\n${w.exampleFa}` : '';
    const text = `${article}<b>${w.german}</b>${plural}${ipa}\n🔹 ترجمه: ${w.persian}${example}${exampleFa}\n\nID: <code>${w.id}</code>`;
    await sendMessage(chatId, text);
  }
}

async function handleWords(chatId: number, args: string) {
  const n = parseInt(args.trim() || '10', 10);
  const limit = Math.max(1, Math.min(30, isNaN(n) ? 10 : n));
  const words = await db.word.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  if (words.length === 0) {
    await sendMessage(chatId, 'هنوز کلمه‌ای ثبت نشده. با <code>/add Haus</code> اولین کلمه را اضافه کنید.');
    return;
  }
  const lines = words.map((w, i) =>
    `${i + 1}. ${w.article ? `<b>${w.article}</b> ` : ''}<b>${w.german}</b> — ${w.persian}`
  );
  await sendMessage(chatId, `📚 آخرین ${words.length} کلمه:\n\n${lines.join('\n')}`);
}

async function handleCats(chatId: number) {
  const cats = await db.category.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { words: true } } },
  });
  if (cats.length === 0) {
    await sendMessage(chatId, 'هنوز دسته‌ای ساخته نشده. از سایت دسته بسازید.');
    return;
  }
  const lines = cats.map((c) => `📁 <b>${c.name}</b> — ${c._count.words} کلمه`);
  await sendMessage(chatId, `دسته‌بندی‌ها:\n\n${lines.join('\n')}`);
}

async function handleAudio(chatId: number, args: string) {
  const q = args.trim();
  if (!q) {
    await sendMessage(chatId, 'از این دستور استفاده کنید: <code>/audio Haus</code>');
    return;
  }
  const word = await db.word.findFirst({
    where: {
      OR: [
        { german: { contains: q, equals: q } },
        { german: { contains: q } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!word) {
    await sendMessage(chatId, `کلمه «${q}» پیدا نشد. اول با <code>/add ${q}</code> اضافه کنید.`);
    return;
  }
  await sendMessage(chatId, `🔊 در حال ساخت فایل صوتی برای «${word.german}»...`);
  try {
    const text = word.example || `${word.article || ''} ${word.german}`.trim();
    let audioUrl = word.audioUrl;
    if (!audioUrl) {
      audioUrl = await generateAudio(text, 'de', 'female', 0.95);
      await db.word.update({ where: { id: word.id }, data: { audioUrl } });
    }
    const filePath = path.join(PROJECT_ROOT, 'public', audioUrl);
    await sendAudio(chatId, filePath, `🔊 ${word.article ? word.article + ' ' : ''}${word.german} — ${word.persian}`);
  } catch (e) {
    console.error('audio error', e);
    await sendMessage(chatId, '❌ ساخت فایل صوتی ناموفق بود.');
  }
}

async function handlePodcast(chatId: number, args: string) {
  const topic = args.trim();
  if (!topic) {
    await sendMessage(chatId, 'از این دستور استفاده کنید: <code>/podcast چرا یادگیری آلمانی مفید است</code>');
    return;
  }
  await sendMessage(chatId, `🎙️ در حال نوشتن پادکست درباره «${topic}»...`);
  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `تو نویسنده‌ی پادکست فارسی هستی. یک متن پادکست کوتاه (حدود ۱۵۰ کلمه) به فارسی می‌نویسی. لحن گرم و صمیمی. خروجی فقط JSON با کلیدهای: {"title": "...", "script": "...", "duration": "..."} بدون ایموجی.`,
        },
        { role: 'user', content: `موضوع: ${topic}` },
      ],
      thinking: { type: 'disabled' },
    });
    const raw = completion.choices[0]?.message?.content || '';
    const parsed = parseJsonLoose(raw);
    if (!parsed || !parsed.title || !parsed.script) {
      await sendMessage(chatId, '❌ هوش مصنوعی نتوانست پادکست بسازد.');
      return;
    }

    await sendMessage(chatId, `📝 <b>${parsed.title}</b>\n\n${parsed.script}\n\n🔊 در حال ساخت صدا...`);

    const audioUrl = await generateAudio(parsed.script, 'fa', 'male', 1.0);
    const saved = await db.podcast.create({
      data: {
        topic,
        title: parsed.title,
        script: parsed.script,
        language: 'fa',
        duration: parsed.duration || '1-2 دقیقه',
        audioUrl,
      },
    });
    const filePath = path.join(PROJECT_ROOT, 'public', audioUrl);
    await sendAudio(chatId, filePath, `🎙️ ${parsed.title}`);
    await sendMessage(chatId, `✅ پادکست ذخیره شد. در سایت هم قابل مشاهده است.`);
  } catch (e) {
    console.error('podcast error', e);
    await sendMessage(chatId, '❌ ساخت پادکست ناموفق بود.');
  }
}

async function handleStats(chatId: number) {
  const [wordCount, catCount, podcastCount] = await Promise.all([
    db.word.count(),
    db.category.count(),
    db.podcast.count(),
  ]);
  await sendMessage(chatId, `📊 آمار:\n\n📚 کلمات: ${wordCount}\n📁 دسته‌ها: ${catCount}\n🎙️ پادکست‌ها: ${podcastCount}`);
}

// === Main polling loop ===
let lastUpdateId = 0;

async function processUpdate(update: any) {
  if (!update.message || !update.message.text) return;
  const msg = update.message;
  const chatId = msg.chat.id;
  const text: string = msg.text || '';
  const replyToId = msg.message_id;

  try {
    if (text === '/start' || text === '/help') {
      await handleStart(chatId);
    } else if (text.startsWith('/add ')) {
      await handleAdd(chatId, text.slice(5));
    } else if (text.startsWith('/word ')) {
      await handleWord(chatId, text.slice(6));
    } else if (text === '/words' || text.startsWith('/words ')) {
      await handleWords(chatId, text.slice(7));
    } else if (text === '/cats') {
      await handleCats(chatId);
    } else if (text.startsWith('/audio ')) {
      await handleAudio(chatId, text.slice(7));
    } else if (text.startsWith('/podcast ')) {
      await handlePodcast(chatId, text.slice(9));
    } else if (text === '/stats') {
      await handleStats(chatId);
    } else if (text.startsWith('/') && !text.startsWith('/add') && !text.startsWith('/word')) {
      await sendMessage(chatId, 'دستور ناشناخته. <code>/help</code> را بزنید.', replyToId);
    } else if (!text.startsWith('/')) {
      // Treat as /add for convenience
      await handleAdd(chatId, text);
    }
  } catch (e) {
    console.error('handler error', e);
    await sendMessage(chatId, 'خطایی رخ داد. دوباره امتحان کنید.').catch(() => {});
  }
}

async function pollOnce() {
  try {
    const res = await tg('getUpdates', {
      offset: lastUpdateId + 1,
      timeout: 30,
      limit: 50,
    });
    if (!res.ok) {
      console.error('getUpdates failed:', res.description);
      return;
    }
    const updates = res.result || [];
    for (const u of updates) {
      if (u.update_id > lastUpdateId) lastUpdateId = u.update_id;
      await processUpdate(u);
    }
  } catch (e) {
    console.error('polling error', e);
  }
}

async function main() {
  console.log('Starting Almoz Telegram bot...');
  const me = await tg('getMe');
  if (!me.ok) {
    console.error('Bot token invalid:', me.description);
    process.exit(1);
  }
  console.log(`Bot @${me.result.username} ready. Polling for updates...`);

  // Get current pending updates and discard them so we don't replay old commands
  const initial = await tg('getUpdates', { offset: -1, limit: 1 });
  if (initial.ok && initial.result && initial.result.length > 0) {
    lastUpdateId = initial.result[initial.result.length - 1].update_id;
    console.log(`Skipping up to update_id=${lastUpdateId}`);
  }

  // Poll loop
  for (;;) {
    await pollOnce();
  }
}

main().catch((e) => {
  console.error('Fatal error', e);
  process.exit(1);
});
