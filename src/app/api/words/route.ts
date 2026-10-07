import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get('categoryId');
    const q = searchParams.get('q');

    const where: Record<string, unknown> = {};
    if (categoryId && categoryId !== 'all') {
      where.categoryId = categoryId;
    }
    if (q && q.trim()) {
      // SQLite doesn't support mode: insensitive well, fallback simple contains
      where.OR = [
        { german: { contains: q } },
        { persian: { contains: q } },
        { article: { contains: q } },
      ];
    }

    const words = await db.word.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { category: true },
    });
    return NextResponse.json({ words });
  } catch (e) {
    console.error('GET /api/words', e);
    return NextResponse.json({ error: 'Failed to load words' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // body: { german, article, plural, ipa, persian, example, exampleFa, audioUrl, categoryId, note }
    const created = await db.word.create({
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
    return NextResponse.json({ word: created });
  } catch (e) {
    console.error('POST /api/words', e);
    return NextResponse.json({ error: 'Failed to create word' }, { status: 500 });
  }
}
