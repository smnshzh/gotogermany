import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await db.category.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE category', e);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const updated = await db.category.update({
      where: { id },
      data: {
        name: body.name?.trim(),
        description: body.description?.trim() || null,
        color: body.color?.trim() || 'emerald',
      },
      include: { _count: { select: { words: true } } },
    });
    return NextResponse.json({ category: updated });
  } catch (e) {
    console.error('PUT category', e);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
