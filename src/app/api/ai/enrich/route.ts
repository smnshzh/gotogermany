import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

interface EnrichResult {
  article: string | null;
  plural: string | null;
  ipa: string | null;
  persian: string;
  example: string | null;
  exampleFa: string | null;
  gender?: string | null;
}

const SYSTEM_PROMPT = `You are an expert German lexicographer and Persian (Farsi) translator.
Given a German word from the user, return ONLY a valid JSON object with these keys:
- "article": the definite article for nouns ("der" | "die" | "das"). If not a noun, return null.
- "plural": the plural form of the noun (without article). If not a noun, return null.
- "ipa": International Phonetic Alphabet transcription of the German word, e.g. "ˈhaʊs". If unsure, return null.
- "persian": the best Persian (Farsi) translation. Use proper Persian script. Multiple synonyms separated by "، ".
- "example": one short, natural German example sentence using the word. If it is a noun, include the definite article.
- "exampleFa": Persian translation of the example sentence.
Return ONLY the JSON object, no markdown, no explanation.`;

export async function POST(req: NextRequest) {
  try {
    const { word } = await req.json();
    if (!word || typeof word !== 'string' || !word.trim()) {
      return NextResponse.json({ error: 'word is required' }, { status: 400 });
    }
    const cleaned = word.trim().replace(/^(der|die|das)\s+/i, '');

    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `German word: ${cleaned}` },
      ],
      thinking: { type: 'disabled' },
    });

    const raw = completion.choices[0]?.message?.content || '';
    const parsed = parseJsonLoose(raw);

    if (!parsed || !parsed.persian) {
      return NextResponse.json(
        { error: 'AI failed to enrich word. Try again.' },
        { status: 502 }
      );
    }

    const result: EnrichResult = {
      article: typeof parsed.article === 'string' && ['der', 'die', 'das'].includes(parsed.article.toLowerCase())
        ? parsed.article.toLowerCase()
        : null,
      plural: typeof parsed.plural === 'string' && parsed.plural.trim() ? parsed.plural.trim() : null,
      ipa: typeof parsed.ipa === 'string' && parsed.ipa.trim() ? parsed.ipa.trim() : null,
      persian: parsed.persian.trim(),
      example: typeof parsed.example === 'string' && parsed.example.trim() ? parsed.example.trim() : null,
      exampleFa: typeof parsed.exampleFa === 'string' && parsed.exampleFa.trim() ? parsed.exampleFa.trim() : null,
    };

    return NextResponse.json({ word: cleaned, ...result });
  } catch (e) {
    console.error('AI enrich error', e);
    return NextResponse.json({ error: 'AI enrichment failed' }, { status: 500 });
  }
}

function parseJsonLoose(s: string): Record<string, unknown> | null {
  if (!s) return null;
  // Strip code fences
  let t = s.trim();
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  // Find first { ... } block
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  const slice = t.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    // try to remove trailing commas
    try {
      return JSON.parse(slice.replace(/,(\s*[}\]])/g, '$1'));
    } catch {
      return null;
    }
  }
}
