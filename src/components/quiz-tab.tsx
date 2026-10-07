'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Volume2, Check, X, RefreshCw, Trophy, Brain, Headphones, Loader2, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import type { Category, Word } from '@/lib/types';
import * as api from '@/lib/api';

interface Props {
  words: Word[];
  categories: Category[];
}

type Mode = 'translation' | 'pronunciation';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Question {
  word: Word;
  options: string[]; // persian for translation, german for pronunciation
  correct: string;
}

function buildQuestions(pool: Word[], mode: Mode, count: number): Question[] {
  if (pool.length === 0) return [];
  const selected = shuffle(pool).slice(0, Math.min(count, pool.length));
  return selected.map((w) => {
    const distractors = shuffle(pool.filter((x) => x.id !== w.id)).slice(0, 3);
    const correct = mode === 'translation' ? w.persian : w.german;
    const options = shuffle([
      correct,
      ...distractors.map((d) => (mode === 'translation' ? d.persian : d.german)),
    ]);
    return { word: w, options, correct };
  });
}

export function QuizTab({ words, categories }: Props) {
  const [mode, setMode] = useState<Mode>('translation');
  const [categoryId, setCategoryId] = useState<string>('all');
  const [count, setCount] = useState<number>(10);
  const [started, setStarted] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [answer, setAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [audioPlayed, setAudioPlayed] = useState(false);
  const [generatingIds, setGeneratingIds] = useState<Record<string, true>>({});
  const generatingRef = useRef<Record<string, boolean>>({});
  const currentWordId = questions[current]?.word.id;
  const audioUrl = questions[current]?.word.audioUrl || generatedUrl;
  const generating = currentWordId ? !!generatingIds[currentWordId] : false;

  const pool = useMemo(() => {
    if (categoryId === 'all') return words;
    return words.filter((w) => w.categoryId === categoryId);
  }, [words, categoryId]);

  const start = () => {
    if (pool.length < 2) {
      toast.error('برای آزمون حداقل به ۲ کلمه نیاز است');
      return;
    }
    if (pool.length < 4) {
      toast.warning('بهتر است حداقل ۴ کلمه داشته باشید تا گزینه‌ها معنادار باشند');
    }
    const qs = buildQuestions(pool, mode, count);
    setQuestions(qs);
    setCurrent(0);
    setScore(0);
    setAnsweredCount(0);
    setAnswer(null);
    setShowResult(false);
    setStarted(true);
    setAudioPlayed(false);
  };

  const reset = () => {
    setStarted(false);
    setShowResult(false);
    setQuestions([]);
    setCurrent(0);
    setAnswer(null);
    setScore(0);
    setAnsweredCount(0);
    setGeneratedUrl(null);
  };

  // Load audio for pronunciation mode
  useEffect(() => {
    if (!started || mode !== 'pronunciation') return;
    const q = questions[current];
    if (!q) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAudioPlayed(false);
    if (q.word.audioUrl) return;
    if (generatingRef.current[q.word.id]) return;
    generatingRef.current[q.word.id] = true;
    setGeneratingIds((s) => ({ ...s, [q.word.id]: true }));
    let cancelled = false;
    const text = q.word.example || `${q.word.article || ''} ${q.word.german}`.trim();
    api.generateAudio(text).then((url) => {
      if (cancelled || !url) return;
      setGeneratedUrl(url);
      api.updateWord(q.word.id, { audioUrl: url }).catch(() => {});
    }).catch(() => {}).finally(() => {
      generatingRef.current[q.word.id] = false;
      if (!cancelled) setGeneratingIds((s) => {
        const next = { ...s };
        delete next[q.word.id];
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [started, mode, current, questions]);

  const playAudio = async () => {
    const a = document.getElementById('quiz-audio') as HTMLAudioElement | null;
    if (!a) return;
    a.currentTime = 0;
    try {
      await a.play();
      setAudioPlayed(true);
    } catch (e) {
      console.warn(e);
    }
  };

  const submit = (value: string) => {
    if (answer) return; // already answered
    const q = questions[current];
    if (!q) return;
    setAnswer(value);
    setAnsweredCount((c) => c + 1);
    if (value === q.correct) {
      setScore((s) => s + 1);
      toast.success('درست!');
    } else {
      toast.error(`نادرست. پاسخ درست: ${q.correct}`);
    }
  };

  const nextQuestion = () => {
    if (current + 1 >= questions.length) {
      setShowResult(true);
      return;
    }
    setCurrent((c) => c + 1);
    setAnswer(null);
    setAudioPlayed(false);
  };

  if (words.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          <Brain size={32} className="mx-auto mb-2 opacity-50" />
          <p>ابتدا چند کلمه اضافه کنید تا آزمون شروع شود.</p>
        </CardContent>
      </Card>
    );
  }

  if (!started) {
    return (
      <Card className="max-w-xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-700">
            <Brain size={18} /> تنظیمات آزمون
          </CardTitle>
          <CardDescription>نوع آزمون، دسته و تعداد سؤال را انتخاب کنید.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode('translation')}
              className={`rounded-lg border p-4 text-right transition ${mode === 'translation' ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/30' : 'hover:bg-muted/40'}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Brain size={18} className="text-emerald-600" />
                <span className="font-medium">آزمون ترجمه</span>
              </div>
              <p className="text-xs text-muted-foreground">کلمه آلمانی نمایش داده می‌شود، ترجمه فارسی صحیح را انتخاب کنید.</p>
            </button>
            <button
              type="button"
              onClick={() => setMode('pronunciation')}
              className={`rounded-lg border p-4 text-right transition ${mode === 'pronunciation' ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/30' : 'hover:bg-muted/40'}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Headphones size={18} className="text-amber-600" />
                <span className="font-medium">آزمون تلفظ</span>
              </div>
              <p className="text-xs text-muted-foreground">صدا را می‌شنوید و باید کلمه آلمانی درست را انتخاب کنید.</p>
            </button>
          </div>

          <div>
            <Label>دسته</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه کلمات ({words.length})</SelectItem>
                {categories.map((c) => {
                  const n = words.filter((w) => w.categoryId === c.id).length;
                  return (
                    <SelectItem key={c.id} value={c.id}>{c.name} ({n})</SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>تعداد سؤال</Label>
            <Select value={String(count)} onValueChange={(v) => setCount(Number(v))}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[5, 10, 15, 20].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} سؤال</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">حداکثر {Math.min(count, pool.length)} سؤال از مجموع {pool.length} کلمه.</p>
          </div>

          <Button
            type="button"
            onClick={start}
            disabled={pool.length < 2}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            شروع آزمون
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (showResult) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <Card className="max-w-xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-700">
            <Trophy size={18} /> نتیجه آزمون
          </CardTitle>
          <CardDescription>{mode === 'translation' ? 'آزمون ترجمه' : 'آزمون تلفظ'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <div className="py-6">
            <p className="text-6xl font-bold text-emerald-600">{pct}%</p>
            <p className="mt-2 text-lg">{score} از {questions.length} درست</p>
          </div>
          <Progress value={pct} className="h-2" />
          <div className="grid grid-cols-3 gap-2 mt-4 text-sm">
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-2xl font-bold text-emerald-600">{score}</p>
              <p className="text-xs text-muted-foreground">درست</p>
            </div>
            <div className="rounded-lg bg-rose-50 p-3">
              <p className="text-2xl font-bold text-rose-600">{questions.length - score}</p>
              <p className="text-xs text-muted-foreground">نادرست</p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-2xl font-bold">{questions.length}</p>
              <p className="text-xs text-muted-foreground">کل</p>
            </div>
          </div>
          <div className="flex gap-2 pt-4">
            <Button variant="outline" className="flex-1" onClick={start}>
              <RefreshCw size={14} className="mr-1" /> آزمون دوباره
            </Button>
            <Button variant="ghost" className="flex-1" onClick={reset}>
              تنظیمات
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const q = questions[current];
  if (!q) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground px-2">
        <span>سؤال {current + 1} از {questions.length}</span>
        <Badge variant="secondary">امتیاز: {score}</Badge>
      </div>
      <Progress value={(current + 1) / questions.length * 100} className="h-1.5" />

      <Card>
        <CardHeader className="pb-3">
          <CardDescription>
            {mode === 'translation' ? 'ترجمه فارسی درست را انتخاب کنید' : 'با شنیدن صدا، کلمه آلمانی درست را انتخاب کنید'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {mode === 'translation' ? (
            <div className="text-center py-4">
              {q.word.article && (
                <Badge variant="outline" className="text-sm mb-2 bg-emerald-50 text-emerald-700 border-emerald-200">
                  {q.word.article}
                </Badge>
              )}
              <h2 className="text-4xl font-bold" dir="ltr">{q.word.german}</h2>
              {q.word.ipa && (
                <p className="text-sm text-muted-foreground font-mono mt-1" dir="ltr">/{q.word.ipa}/</p>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <Button
                type="button"
                size="lg"
                onClick={playAudio}
                disabled={!audioUrl || generating}
                className="rounded-full h-24 w-24 bg-amber-500 hover:bg-amber-600 text-white shadow-lg"
              >
                {generating ? <Loader2 className="animate-spin" size={36} /> : <Volume2 size={36} />}
              </Button>
              <p className="text-sm text-muted-foreground mt-3">
                {generating ? 'در حال ساخت صدا...' : audioPlayed ? 'دوباره گوش بده' : 'برای شنیدن تلفظ کلیک کنید'}
              </p>
              <audio id="quiz-audio" src={audioUrl || undefined} className="hidden" />
            </div>
          )}

          <RadioGroup value={answer ?? ''} onValueChange={submit} className="grid gap-2">
            {q.options.map((opt) => {
              const isCorrect = opt === q.correct;
              const isChosen = answer === opt;
              let cls = 'border-border hover:bg-muted/40';
              if (answer) {
                if (isCorrect) cls = 'border-emerald-500 bg-emerald-50 text-emerald-700';
                else if (isChosen) cls = 'border-rose-500 bg-rose-50 text-rose-700';
                else cls = 'border-muted opacity-60';
              }
              return (
                <label
                  key={opt}
                  className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition ${cls} ${answer ? 'cursor-default' : ''}`}
                >
                  <RadioGroupItem value={opt} disabled={!!answer} />
                  <span className="flex-1 text-base" dir={mode === 'translation' ? 'rtl' : 'ltr'}>
                    {opt}
                  </span>
                  {answer && isCorrect && <Check className="text-emerald-600" size={18} />}
                  {answer && isChosen && !isCorrect && <X className="text-rose-600" size={18} />}
                </label>
              );
            })}
          </RadioGroup>

          {answer && (
            <div className="flex items-center justify-between pt-2">
              <div className="text-sm">
                <span className="text-muted-foreground">پاسخ درست: </span>
                <span className="font-medium text-emerald-700">{q.correct}</span>
              </div>
              <Button onClick={nextQuestion}>
                {current + 1 >= questions.length ? 'مشاهده نتیجه' : 'سؤال بعدی'}
                <ChevronLeft className="mr-1" size={14} />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-center">
        <Button variant="ghost" size="sm" onClick={reset}>خروج از آزمون</Button>
      </div>
    </div>
  );
}
