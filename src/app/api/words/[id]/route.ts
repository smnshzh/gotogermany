import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await db.word.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE word', e);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const updated = await db.word.update({
      where: { id },
      data: {
        german: body.german?.trim(),
        article: body.article?.trim() || null,
        plural: body.plural?.trim() || null,
        ipa: body.ipa?.trim() || null,
        persian: body.persian?.trim(),
        example: body.example?.trim() || null,
        exampleFa: body.exampleFa?.trim() || null,
        audioUrl: body.audioUrl?.trim() || null,
        note: body.note?.trim() || null,
        categoryId: body.categoryId || null,
      },
      include: { category: true },
    });
    return NextResponse.json({ word: updated });
  } catch (e) {
    console.error('PUT word', e);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
