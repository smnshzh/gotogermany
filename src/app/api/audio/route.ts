import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { text, voice = 'tongtong', speed = 0.9 } = await req.json();
    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }
    // Limit length
    const safe = text.slice(0, 1000);
    const zai = await ZAI.create();
    const response = await zai.audio.tts.create({
      input: safe,
      voice,
      speed,
      response_format: 'wav',
      stream: false,
    });
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));

    const audioDir = path.join(process.cwd(), 'public', 'audio');
    await fs.mkdir(audioDir, { recursive: true });
    const id = crypto.randomBytes(8).toString('hex');
    const filename = `${id}.wav`;
    const filepath = path.join(audioDir, filename);
    await fs.writeFile(filepath, buffer);

    return NextResponse.json({ url: `/audio/${filename}` });
  } catch (e) {
    console.error('TTS error', e);
    return NextResponse.json({ error: 'Failed to generate audio' }, { status: 500 });
  }
}
