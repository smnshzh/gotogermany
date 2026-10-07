'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight, Play, Pause, RotateCcw, Volume2, Loader2, Eye, EyeOff } from 'lucide-react';
import { AudioButton } from '@/components/audio-button';
import type { Category, Word } from '@/lib/types';
import * as api from '@/lib/api';

interface Props {
  words: Word[];
  categories: Category[];
}

export function LearnTab({ words, categories }: Props) {
  const [categoryId, setCategoryId] = useState<string>('all');
  const [autoPlay, setAutoPlay] = useState(true);
  const [showPersian, setShowPersian] = useState(true);
  const [showExample, setShowExample] = useState(true);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reveal, setReveal] = useState(true);

  const list = useMemo(() => {
    if (categoryId === 'all') return words;
    return words.filter((w) => w.categoryId === categoryId);
  }, [words, categoryId]);

  const current = list[index];

  // Use ref to track in-flight audio generation per wordId so it doesn't trigger effect cleanups
  const [generatedAudio, setGeneratedAudio] = useState<{ wordId: string; url: string } | null>(null);
  const [generatingIds, setGeneratingIds] = useState<Record<string, true>>({});
  const generatingIdRef = useRef<Record<string, boolean>>({});

  const audioUrl = current?.audioUrl || (generatedAudio?.wordId === current?.id ? generatedAudio.url : null);
  const generating = !!generatingIds[current?.id || ''];

  const handleCategoryChange = (v: string) => {
    setCategoryId(v);
    setIndex(0);
    setReveal(true);
    setGeneratedAudio(null);
    setGeneratingIds({});
    generatingIdRef.current = {};
  };

  // Generate audio for current word if missing
  useEffect(() => {
    if (!current) return;
    if (current.audioUrl) return;
    if (generatedAudio?.wordId === current.id) return;
    if (generatingIdRef.current[current.id]) return;
    generatingIdRef.current[current.id] = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGeneratingIds((s) => ({ ...s, [current.id]: true }));
    let cancelled = false;
    const text = current.example || `${current.article || ''} ${current.german}`.trim();
    api.generateAudio(text).then((url) => {
      if (cancelled || !url) return;
      setGeneratedAudio({ wordId: current.id, url });
      api.updateWord(current.id, { audioUrl: url }).catch(() => {});
    }).catch(() => {}).finally(() => {
      generatingIdRef.current[current.id] = false;
      if (!cancelled) setGeneratingIds((s) => {
        const next = { ...s };
        delete next[current.id];
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [current, generatedAudio]);

  // Play audio when index changes (if autoPlay)
  useEffect(() => {
    if (!current || !autoPlay) return;
    const t = setTimeout(() => {
      const a = document.getElementById('learn-audio') as HTMLAudioElement | null;
      if (a) {
        a.currentTime = 0;
        a.play().catch(() => {});
      }
    }, 400);
    return () => clearTimeout(t);
  }, [index, current, autoPlay, audioUrl]);

  const next = () => {
    setReveal(true);
    setIndex((i) => Math.min(list.length - 1, i + 1));
  };
  const prev = () => {
    setReveal(true);
    setIndex((i) => Math.max(0, i - 1));
  };
  const restart = () => {
    setReveal(true);
    setIndex(0);
  };
  const togglePlay = () => {
    const a = document.getElementById('learn-audio') as HTMLAudioElement | null;
    if (!a) return;
    if (a.paused) {
      a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  if (words.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          <Volume2 size={32} className="mx-auto mb-2 opacity-50" />
          <p>ابتدا چند کلمه اضافه کنید تا یادگیری شروع شود.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 grid gap-4 md:grid-cols-4">
          <div className="md:col-span-1">
            <Label>دسته</Label>
            <Select value={categoryId} onValueChange={handleCategoryChange}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه کلمات</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 md:col-span-3 self-end flex-wrap">
            <div className="flex items-center gap-2">
              <Switch checked={autoPlay} onCheckedChange={setAutoPlay} id="autoplay" />
              <Label htmlFor="autoplay" className="text-sm">پخش خودکار</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={showPersian} onCheckedChange={setShowPersian} id="show-fa" />
              <Label htmlFor="show-fa" className="text-sm">نمایش ترجمه</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={showExample} onCheckedChange={setShowExample} id="show-ex" />
              <Label htmlFor="show-ex" className="text-sm">نمایش مثال</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {list.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <p>در این دسته کلمه‌ای نیست.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between text-sm text-muted-foreground px-2">
            <span>کلمه {index + 1} از {list.length}</span>
            <Progress value={(index + 1) / list.length * 100} className="flex-1 mx-3 h-1.5" />
            <span>{Math.round((index + 1) / list.length * 100)}%</span>
          </div>

          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-br from-emerald-50 to-amber-50 pb-4">
              <CardTitle className="flex items-center justify-between gap-2">
                <span>یادگیری متوالی</span>
                <Button size="sm" variant="ghost" onClick={() => setReveal(!reveal)}>
                  {reveal ? <EyeOff size={14} /> : <Eye size={14} />}
                  <span className="mr-1 text-xs">{reveal ? 'پنهان کن' : 'نشان بده'}</span>
                </Button>
              </CardTitle>
              <CardDescription>به ترتیب کلمات را می‌بیند و می‌شنوید.</CardDescription>
            </CardHeader>
            <CardContent className="py-6">
              {current && (
                <div className="space-y-5">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-3 flex-wrap mb-2">
                      {current.article && (
                        <Badge variant="outline" className="text-base px-3 py-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                          {current.article}
                        </Badge>
                      )}
                      <h2 className="text-5xl font-bold tracking-tight" dir="ltr">{current.german}</h2>
                    </div>
                    {current.ipa && (
                      <p className="text-sm text-muted-foreground font-mono" dir="ltr">/{current.ipa}/</p>
                    )}
                    {current.plural && (
                      <p className="text-xs text-muted-foreground mt-1" dir="ltr">
                        جمع: <span className="font-mono">{current.plural}</span>
                      </p>
                    )}
                  </div>

                  {showPersian && (
                    <div className={`text-center transition ${reveal ? '' : 'opacity-0'}`}>
                      <p className="text-2xl font-medium text-emerald-700">{current.persian}</p>
                    </div>
                  )}

                  {showExample && current.example && (
                    <div className={`rounded-lg border bg-muted/30 p-4 transition ${reveal ? '' : 'opacity-0'}`}>
                      <p className="text-center italic text-base" dir="ltr">«{current.example}»</p>
                      {current.exampleFa && (
                        <p className="text-center text-sm text-muted-foreground mt-1">{current.exampleFa}</p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-center gap-3">
                    <Button variant="outline" size="sm" onClick={togglePlay} disabled={!audioUrl || generating}>
                      {generating ? <Loader2 className="animate-spin mr-1" size={14} /> : playing ? <Pause size={14} /> : <Play size={14} />}
                      <span>{generating ? 'در حال ساخت صدا...' : playing ? 'توقف' : 'پخش'}</span>
                    </Button>
                    <AudioButton url={audioUrl} text={current.german} size="md" />
                  </div>

                  <audio
                    id="learn-audio"
                    src={audioUrl || undefined}
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                    onEnded={() => setPlaying(false)}
                    className="hidden"
                  />

                  {current.category && (
                    <div className="text-center">
                      <Badge variant="secondary">{current.category.name}</Badge>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" onClick={prev} disabled={index === 0}>
              <ChevronRight className="mr-1" size={16} /> قبلی
            </Button>
            <Button variant="ghost" size="sm" onClick={restart} disabled={index === 0}>
              <RotateCcw size={14} className="mr-1" /> شروع دوباره
            </Button>
            <Button variant="outline" onClick={next} disabled={index === list.length - 1}>
              بعدی <ChevronLeft className="mr-1" size={16} />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
