import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import type { Word } from '@/lib/types';

interface Body {
  topic: string;
  language?: string;
  length?: 'short' | 'medium' | 'long';
  style?: 'narrative' | 'qa' | 'list' | 'story';
  words?: Word[];
}

const LENGTH_GUIDE = {
  short: { fa: 'حدود ۱۵۰ تا ۲۰۰ کلمه', de: 'ca. 150-200 Wörter', en: 'about 150-200 words', fr: 'environ 150-200 mots', es: 'aproximadamente 150-200 palabras', tr: 'yaklaşık 150-200 kelime', ar: 'حوالي 150-200 كلمة' },
  medium: { fa: 'حدود ۳۰۰ تا ۴۰۰ کلمه', de: 'ca. 300-400 Wörter', en: 'about 300-400 words', fr: 'environ 300-400 mots', es: 'aproximadamente 300-400 palabras', tr: 'yaklaşık 300-400 kelime', ar: 'حوالي 300-400 كلمة' },
  long: { fa: 'حدود ۵۰۰ تا ۷۰۰ کلمه', de: 'ca. 500-700 Wörter', en: 'about 500-700 words', fr: 'environ 500-700 mots', es: 'aproximadamente 500-700 palabras', tr: 'yaklaşık 500-700 kelime', ar: 'حوالي 500-700 كلمة' },
};

const STYLE_GUIDE = {
  narrative: { fa: 'ساختار: مقدمه کوتاه و جذاب، بحث اصلی با یک یا دو مثال، و جمع‌بندی', de: 'Struktur: kurze Einleitung, Hauptteil mit ein bis zwei Beispielen, Zusammenfassung', en: 'Structure: short intro, main body with one or two examples, conclusion', fr: 'Structure: intro courte, corps principal avec exemples, conclusion', es: 'Estructura: intro corta, cuerpo principal con ejemplos, conclusión', tr: 'Yapı: kısa giriş, ana bölüm örneklerle, sonuç', ar: 'الهيكل: مقدمة قصيرة، الموضوع الرئيسي بأمثلة، خاتمة' },
  qa: { fa: 'ساختار: یک سؤال جالب در ابتدا، سپس پاسخ با توضیح، و نتیجه‌گیری', de: 'Struktur: spannende Frage, ausführliche Antwort, Fazit', en: 'Structure: engaging question, detailed answer, takeaway', fr: 'Structure: question engageante, réponse détaillée, conclusion', es: 'Estructura: pregunta atractiva, respuesta detallada, conclusión', tr: 'Yapı: ilgi çekici soru, detaylı cevap, sonuç', ar: 'الهيكل: سؤال جذاب، إجابة مفصلة، خلاصة' },
  list: { fa: 'ساختار: مقدمه کوتاه، سپس ۳ تا ۵ نکته شماره‌گذاری‌شده، و جمع‌بندی', de: 'Struktur: kurze Einleitung, 3-5 nummerierte Punkte, Zusammenfassung', en: 'Structure: short intro, 3-5 numbered points, wrap-up', fr: 'Structure: intro courte, 3-5 points numérotés, conclusion', es: 'Estructura: intro corta, 3-5 puntos numerados, resumen', tr: 'Yapı: kısa giriş, 3-5 numaralı nokta, özet', ar: 'الهيكل: مقدمة قصيرة، 3-5 نقاط مرقمة، خلاصة' },
  story: { fa: 'ساختار: یک داستان کوتاه با شخصیت و موقعیت، که درس پادکست از آن استخراج شود', de: 'Struktur: kurze Geschichte mit Charakter und Situation, Lektion daraus', en: 'Structure: short story with character and setting, lesson extracted', fr: 'Structure: courte histoire avec personnage, leçon à tirer', es: 'Estructura: historia corta con personaje, lección extraída', tr: 'Yapı: karakter ve durumlu kısa hikaye, ders çıkarımı', ar: 'الهيكل: قصة قصيرة بشخصية وموقف، استخراج درس' },
};

// System prompts per language
const SYSTEM_PROMPTS: Record<string, string> = {
  fa: `تو یک نویسنده‌ی حرفه‌ای پادکست فارسی هستی. یک متن پادکست کوتاه و جذاب به زبان فارسی می‌نویسی.
قوانین:
- لحن گرم، صمیمی و روان، مثل یک میزبان پادکست واقعی
- جمله‌ها کوتاه و مناسب خواندنِ صوتی
- بدون ایموجی یا نمادهای گرافیکی یا ستاره یا خط تیره در ابتدای خطوط
- شامل یک عنوان کوتاه و جذاب
- خروجی فقط و فقط به صورت JSON با کلیدهای: {"title": "...", "script": "...", "duration": "..."}
- فیلد duration را به فرمت مثل «۱-۲ دقیقه» بنویس`,

  de: `Du bist ein professioneller deutschsprachiger Podcast-Autor. Du schreibst einen kurzen, ansprechenden Podcast-Text auf Deutsch.
Regeln:
- Warme, natürliche, fließende Sprache wie ein echter Podcast-Moderator
- Kurze Sätze, gut zum Vorlesen
- Keine Emojis, keine Sterne oder Striche am Zeilenanfang
- Inkludiere einen kurzen, ansprechenden Titel
- Ausgabe NUR als JSON mit den Schlüsseln: {"title": "...", "script": "...", "duration": "..."}
- Dauer im Format "1-2 Minuten" angeben`,

  en: `You are a professional English podcast writer. You write a short, engaging podcast script in English.
Rules:
- Warm, natural, conversational tone like a real podcast host
- Short sentences, easy to read aloud
- No emojis, no stars or dashes at the start of lines
- Include a short, catchy title
- Output ONLY as JSON with keys: {"title": "...", "script": "...", "duration": "..."}
- Duration in format like "1-2 minutes"`,

  fr: `Tu es un rédacteur de podcast professionnel francophone. Tu écris un court script de podcast en français.
Règles:
- Ton chaleureux, naturel et conversationnel comme un vrai animateur
- Phrases courtes, adaptées à la lecture orale
- Pas d'emojis, pas d'étoiles ou de tirets en début de ligne
- Inclus un titre court et accrocheur
- Sortie UNIQUEMENT en JSON avec les clés: {"title": "...", "script": "...", "duration": "..."}
- Durée au format "1-2 minutes"`,

  es: `Eres un redactor de podcast profesional hispanohablante. Escribe un guion corto de podcast en español.
Reglas:
- Tono cálido, natural y conversacional como un verdadero presentador
- Frases cortas, adecuadas para leer en voz alta
- Sin emojis, sin asteriscos ni guiones al inicio de líneas
- Incluye un título corto y atractivo
- Salida SOLO como JSON con claves: {"title": "...", "script": "...", "duration": "..."}
- Duración en formato "1-2 minutos"`,

  tr: `Sen profesyonel bir Türkçe podcast yazarısın. Türkçe olarak kısa, ilgi çekici bir podcast metni yazarsın.
Kurallar:
- Sıcak, doğal, akıcı bir ton, gerçek bir podcast sunucusu gibi
- Kısa cümleler, sesli okumaya uygun
- Emoji yıldız veya çizgi ile başlayan satırlar yok
- Kısa ve çekici bir başlık ekle
- Çıktı SADECE JSON olarak şu anahtarlarla: {"title": "...", "script": "...", "duration": "..."}
- Süre "1-2 dakika" formatında`,

  ar: `أنت كاتب بودكاست محترف باللغة العربية. تكتب نص بودكاست قصير وجذاب بالعربية.
القواعد:
- نبرة دافئة وطبيعية مثل مقدم بودكاست حقيقي
- جمل قصيرة مناسبة للقراءة الصوتية
- بلا رموز تعبيرية أو نجوم أو شرطات في بداية الأسطر
- ضمّ عنوانًا قصيرًا وجذابًا
- المخرجات فقط بصيغة JSON بمفاتيح: {"title": "...", "script": "...", "duration": "..."}
- المدة بصيغة مثل "1-2 دقيقة"`,
};

const DURATION_FALLBACK: Record<string, string> = {
  fa: '۱-۲ دقیقه',
  de: '1-2 Minuten',
  en: '1-2 minutes',
  fr: '1-2 minutes',
  es: '1-2 minutos',
  tr: '1-2 dakika',
  ar: '1-2 دقيقة',
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    if (!body.topic || !body.topic.trim()) {
      return NextResponse.json({ error: 'topic is required' }, { status: 400 });
    }
    const language = (body.language || 'fa').toLowerCase();
    const length = body.length ?? 'short';
    const style = body.style ?? 'narrative';

    const systemPrompt = SYSTEM_PROMPTS[language] || SYSTEM_PROMPTS.en;
    const lengthGuide = (LENGTH_GUIDE[length] || LENGTH_GUIDE.short)[language] || LENGTH_GUIDE.short.en;
    const styleGuide = (STYLE_GUIDE[style] || STYLE_GUIDE.narrative)[language] || STYLE_GUIDE.narrative.en;

    let wordsHint = '';
    if (body.words && body.words.length > 0) {
      const ws = body.words.slice(0, 5).map((w) =>
        `${w.article ? w.article + ' ' : ''}${w.german}${w.persian ? ` (${w.persian})` : ''}`
      );
      wordsHint = `\nYou may also reference these German words: ${ws.join(', ')}`;
    }

    const userPrompt = `Topic: ${body.topic.trim()}

Length: ${lengthGuide}
Style: ${styleGuide}${wordsHint}

Write the script in ${language.toUpperCase()} and return ONLY JSON.`;

    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'disabled' },
    });

    const raw = completion.choices[0]?.message?.content || '';
    const parsed = parseJsonLoose(raw);
    if (!parsed || !parsed.title || !parsed.script) {
      return NextResponse.json(
        { error: 'AI failed to generate podcast. Try again.' },
        { status: 502 }
      );
    }
    return NextResponse.json({
      title: String(parsed.title).trim(),
      script: String(parsed.script).trim(),
      duration: String(parsed.duration || DURATION_FALLBACK[language] || '1-2 minutes').trim(),
      language,
    });
  } catch (e) {
    console.error('AI podcast error', e);
    return NextResponse.json({ error: 'AI podcast generation failed' }, { status: 500 });
  }
}

function parseJsonLoose(s: string): Record<string, unknown> | null {
  if (!s) return null;
  let t = s.trim();
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  const slice = t.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    try {
      return JSON.parse(slice.replace(/,(\s*[}\]])/g, '$1'));
    } catch {
      return null;
    }
  }
}
