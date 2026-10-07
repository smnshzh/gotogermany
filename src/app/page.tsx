'use client';

import { useCallback, useEffect, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, FolderTree, GraduationCap, Brain, Sparkles, Mic, Loader2 } from 'lucide-react';
import { WordsTab } from '@/components/words-tab';
import { CategoriesTab } from '@/components/categories-tab';
import { LearnTab } from '@/components/learn-tab';
import { QuizTab } from '@/components/quiz-tab';
import { PodcastTab } from '@/components/podcast-tab';
import type { Category, Word, Podcast } from '@/lib/types';
import * as api from '@/lib/api';

export default function Home() {
  const [words, setWords] = useState<Word[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('words');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [w, c, p] = await Promise.all([api.fetchWords(), api.fetchCategories(), api.fetchPodcasts()]);
      setWords(w);
      setCategories(c);
      setPodcasts(p);
    } catch (e) {
      console.error('reload', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-emerald-50/30 to-background">
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-amber-500 grid place-items-center text-white shadow-md">
              <Sparkles size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">
                آلموز <span className="text-emerald-600">·</span> یادگیری هوشمند آلمانی
              </h1>
              <p className="text-xs text-muted-foreground">ثبت واژه با هوش مصنوعی، ترجمه، تلفظ و آزمون</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              {words.length} کلمه
            </Badge>
            <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">
              {categories.length} دسته
            </Badge>
            <Badge variant="secondary" className="bg-rose-50 text-rose-700 border-rose-200">
              {podcasts.length} پادکست
            </Badge>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 mb-6 h-auto">
            <TabsTrigger value="words" className="py-2">
              <BookOpen size={16} className="ml-1.5" />
              کلمات
            </TabsTrigger>
            <TabsTrigger value="categories" className="py-2">
              <FolderTree size={16} className="ml-1.5" />
              دسته‌بندی
            </TabsTrigger>
            <TabsTrigger value="learn" className="py-2">
              <GraduationCap size={16} className="ml-1.5" />
              یادگیری
            </TabsTrigger>
            <TabsTrigger value="quiz" className="py-2">
              <Brain size={16} className="ml-1.5" />
              آزمون
            </TabsTrigger>
            <TabsTrigger value="podcast" className="py-2">
              <Mic size={16} className="ml-1.5" />
              پادکست
            </TabsTrigger>
          </TabsList>

          <TabsContent value="words" className="mt-0">
            {loading && words.length === 0 ? (
              <Card><CardContent className="py-16 text-center text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="animate-spin" size={16} /> در حال بارگذاری...
              </CardContent></Card>
            ) : (
              <WordsTab words={words} categories={categories} loading={loading} onReload={reload} />
            )}
          </TabsContent>

          <TabsContent value="categories" className="mt-0">
            <CategoriesTab categories={categories} loading={loading} onReload={reload} />
          </TabsContent>

          <TabsContent value="learn" className="mt-0">
            <LearnTab words={words} categories={categories} />
          </TabsContent>

          <TabsContent value="quiz" className="mt-0">
            <QuizTab words={words} categories={categories} />
          </TabsContent>

          <TabsContent value="podcast" className="mt-0">
            <PodcastTab podcasts={podcasts} loading={loading} onReload={reload} />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t mt-8">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-xs text-muted-foreground">
          ساخته‌شده با Next.js و هوش مصنوعی Z.ai · همه‌ی داده‌ها روی همین مرورگر شما ذخیره می‌شوند.
        </div>
      </footer>
    </div>
  );
}
