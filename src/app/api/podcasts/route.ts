import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const podcasts = await db.podcast.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ podcasts });
  } catch (e) {
    console.error('GET podcasts', e);
    return NextResponse.json({ error: 'Failed to load podcasts' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.title?.trim() || !body.script?.trim()) {
      return NextResponse.json({ error: 'title and script are required' }, { status: 400 });
    }
    const created = await db.podcast.create({
      data: {
        topic: body.topic?.trim() || '',
        title: body.title.trim(),
        script: body.script.trim(),
        language: body.language?.trim() || 'fa',
        duration: body.duration?.trim() || null,
        audioUrl: body.audioUrl || null,
      },
    });
    return NextResponse.json({ podcast: created });
  } catch (e) {
    console.error('POST podcast', e);
    return NextResponse.json({ error: 'Failed to create podcast' }, { status: 500 });
  }
}
