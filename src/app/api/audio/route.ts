import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, mkdir } from 'fs/promises';

const execFileAsync = promisify(execFile);

interface TtsOptions {
  text: string;
  lang?: string; // 'de' for German, 'fa' for Persian
  speed?: number; // 0.5 - 2.0
}

interface TtsResult {
  buffer: Buffer;
  format: 'mp3' | 'wav';
}

const SCRIPT_PATH = '/home/z/my-project/scripts/generate_tts.py';

/**
 * German (and other language) TTS using gTTS (Google Translate TTS) as the primary engine
 * with espeak-ng as offline fallback. Both produce proper German pronunciation.
 */
async function generateTts({ text, lang = 'de', speed = 1.0 }: TtsOptions): Promise<TtsResult> {
  const args = [SCRIPT_PATH, '--text', text, '--lang', lang, '--speed', String(speed)];
  try {
    const { stdout } = await execFileAsync('python3', args, {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
      timeout: 60000,
    });
    const match = stdout.match(/OUT:(\S+)/);
    if (!match) throw new Error('TTS script returned no output path');
    const outPath = match[1];
    const buffer = await fs.readFile(outPath);
    // cleanup
    await fs.unlink(outPath).catch(() => {});
    const isMp3 = outPath.toLowerCase().endsWith('.mp3');
    return { buffer, format: isMp3 ? 'mp3' : 'wav' };
  } catch (e) {
    console.error('TTS script error:', e);
    throw e;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { text, lang = 'de', speed = 0.95 } = await req.json();
    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }
    const safe = text.slice(0, 1000);
    const { buffer, format } = await generateTts({ text: safe, lang, speed });

    const audioDir = path.join(process.cwd(), 'public', 'audio');
    await mkdir(audioDir, { recursive: true });
    const id = crypto.randomBytes(8).toString('hex');
    const filename = `${id}.${format}`;
    const filepath = path.join(audioDir, filename);
    await writeFile(filepath, buffer);

    return NextResponse.json({ url: `/audio/${filename}` });
  } catch (e) {
    console.error('TTS error', e);
    return NextResponse.json({ error: 'Failed to generate audio' }, { status: 500 });
  }
}
