import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const cats = await db.category.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { words: true } } },
    });
    return NextResponse.json({ categories: cats });
  } catch (e) {
    console.error('GET categories', e);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const created = await db.category.create({
      data: {
        name: body.name?.trim(),
        description: body.description?.trim() || null,
        color: body.color?.trim() || 'emerald',
      },
      include: { _count: { select: { words: true } } },
    });
    return NextResponse.json({ category: created });
  } catch (e) {
    console.error('POST categories', e);
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}
