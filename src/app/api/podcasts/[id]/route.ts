import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await db.podcast.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE podcast', e);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const updated = await db.podcast.update({
      where: { id },
      data: {
        topic: body.topic?.trim() ?? undefined,
        title: body.title?.trim() ?? undefined,
        script: body.script?.trim() ?? undefined,
        language: body.language?.trim() ?? undefined,
        duration: body.duration?.trim() ?? undefined,
        audioUrl: body.audioUrl ?? undefined,
      },
    });
    return NextResponse.json({ podcast: updated });
  } catch (e) {
    console.error('PUT podcast', e);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
