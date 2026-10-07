import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import type { Word } from '@/lib/types';

interface Body {
  topic: string;
  length?: 'short' | 'medium' | 'long';
  style?: 'narrative' | 'qa' | 'list' | 'story';
  words?: Word[];
}

const LENGTH_GUIDE = {
  short: 'حدود ۱۵۰ تا ۲۰۰ کلمه (حدود ۱ تا ۱.۵ دقیقه)',
  medium: 'حدود ۳۰۰ تا ۴۰۰ کلمه (حدود ۲ تا ۳ دقیقه)',
  long: 'حدود ۵۰۰ تا ۷۰۰ کلمه (حدود ۴ تا ۵ دقیقه)',
};

const STYLE_GUIDE = {
  narrative: 'ساختار: مقدمه کوتاه و جذاب، بحث اصلی با یک یا دو مثال، و جمع‌بندی',
  qa: 'ساختار: یک سؤال جالب در ابتدا، سپس پاسخ با توضیح، و نتیجه‌گیری',
  list: 'ساختار: مقدمه کوتاه، سپس ۳ تا ۵ نکته شماره‌گذاری‌شده، و جمع‌بندی',
  story: 'ساختار: یک داستان کوتاه با شخصیت و موقعیت، که درس پادکست از آن استخراج شود',
};

const SYSTEM_PROMPT = `تو یک نویسنده‌ی حرفه‌ای پادکست فارسی هستی.
یک متن پادکست کوتاه و جذاب به زبان فارسی می‌نویسی.
قوانین:
- لحن گرم، صمیمی و روان، مثل یک میزبان پادکست واقعی
- جمله‌ها کوتاه و مناسب خواندنِ صوتی باشند
- کلمات انگلیسی/آلمانی را با حروف فارسی بنویس (مثلاً «هائوس» نه «Haus») مگر آنکه آن کلمه هدف آموزش باشد
- اگر کلمه آلمانی هدف آموزش است، آن را به شکل «کلمه آلمانی (تلفظ فارسی) — معنی فارسی» وارد کن، مثلاً: «Haus (هائوس) — یعنی خانه»
- بدون ایموجی یا نمادهای گرافیکی
- بدون خط تیره یا ستاره در ابتدای خطوط (متن پیوسته باشد)
- شامل یک عنوان کوتاه و جذاب برای پادکست
- خروجی فقط و فقط به صورت JSON با کلیدهای: {"title": "...", "script": "...", "duration": "..."}
- فیلد duration را به فرمت مثل «۱ دقیقه» یا «۲-۳ دقیقه» بنویس`;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    if (!body.topic || !body.topic.trim()) {
      return NextResponse.json({ error: 'topic is required' }, { status: 400 });
    }
    const length = body.length ?? 'short';
    const style = body.style ?? 'narrative';

    let wordsHint = '';
    if (body.words && body.words.length > 0) {
      const ws = body.words.slice(0, 5).map((w) =>
        `${w.article ? w.article + ' ' : ''}${w.german}${w.persian ? ` (یعنی ${w.persian})` : ''}`
      );
      wordsHint = `\nهمچنین می‌توانی به این کلمات آلمانی هم اشاره کنی: ${ws.join('، ')}`;
    }

    const userPrompt = `موضوع پادکست: ${body.topic.trim()}

طول: ${LENGTH_GUIDE[length]}
ساختار: ${STYLE_GUIDE[style]}
${wordsHint}

متن را به فارسی بنویس و فقط JSON برگردان.`;

    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
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
      duration: String(parsed.duration || LENGTH_GUIDE[length]).trim(),
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
