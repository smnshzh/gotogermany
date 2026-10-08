'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Sparkles, Loader2, Plus, Trash2, Search, Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { AudioButton } from '@/components/audio-button';
import type { Category, Word } from '@/lib/types';
import * as api from '@/lib/api';

interface Props {
  words: Word[];
  categories: Category[];
  loading: boolean;
  onReload: () => void;
}

const ARTICLE_COLORS: Record<string, string> = {
  der: 'bg-sky-100 text-sky-700 border-sky-200',
  die: 'bg-rose-100 text-rose-700 border-rose-200',
  das: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

export function WordsTab({ words, categories, loading, onReload }: Props) {
  const [german, setGerman] = useState('');
  const [categoryId, setCategoryId] = useState<string>('none');
  const [article, setArticle] = useState('');
  const [plural, setPlural] = useState('');
  const [ipa, setIpa] = useState('');
  const [persian, setPersian] = useState('');
  const [example, setExample] = useState('');
  const [exampleFa, setExampleFa] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCatId, setEditCatId] = useState<string>('none');

  const resetForm = () => {
    setGerman('');
    setArticle('');
    setPlural('');
    setIpa('');
    setPersian('');
    setExample('');
    setExampleFa('');
    setAudioUrl(null);
    setCategoryId('none');
  };

  const handleEnrich = async () => {
    if (!german.trim()) {
      toast.error('یک کلمه آلمانی وارد کنید');
      return;
    }
    setEnriching(true);
    try {
      const r = await api.enrichWord(german.trim());
      setArticle(r.article || '');
      setPlural(r.plural || '');
      setIpa(r.ipa || '');
      setPersian(r.persian || '');
      setExample(r.example || '');
      setExampleFa(r.exampleFa || '');
      setGerman(r.word);
      setAudioUrl(null);
      toast.success('هوش مصنوعی کلمه را تکمیل کرد');
    } catch (e) {
      console.error(e);
      toast.error('خطا در تکمیل با هوش مصنوعی');
    } finally {
      setEnriching(false);
    }
  };

  const handleGenerateAudio = async (text?: string): Promise<string | null> => {
    const t = (text || example || german).trim();
    if (!t) {
      toast.error('متنی برای تبدیل به صدا وجود ندارد');
      return null;
    }
    try {
      const url = await api.generateAudio(t, { lang: 'de', speed: 0.95 });
      if (!text) setAudioUrl(url); // store on form state if form audio
      toast.success('فایل صوتی ساخته شد');
      return url;
    } catch (e) {
      console.error(e);
      toast.error('ساخت صدا ناموفق بود');
      return null;
    }
  };

  const handleSave = async () => {
    if (!german.trim() || !persian.trim()) {
      toast.error('کلمه آلمانی و ترجمه فارسی الزامی است');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        german: german.trim(),
        article: article.trim() || null,
        plural: plural.trim() || null,
        ipa: ipa.trim() || null,
        persian: persian.trim(),
        example: example.trim() || null,
        exampleFa: exampleFa.trim() || null,
        audioUrl,
        categoryId: categoryId === 'none' ? null : categoryId,
      };
      if (editingId) {
        await api.updateWord(editingId, payload);
        toast.success('کلمه به‌روزرسانی شد');
      } else {
        await api.createWord(payload);
        toast.success('کلمه ذخیره شد');
      }
      resetForm();
      setEditingId(null);
      onReload();
    } catch (e) {
      console.error(e);
      toast.error('ذخیره ناموفق بود');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (w: Word) => {
    setEditingId(w.id);
    setGerman(w.german);
    setArticle(w.article || '');
    setPlural(w.plural || '');
    setIpa(w.ipa || '');
    setPersian(w.persian);
    setExample(w.example || '');
    setExampleFa(w.exampleFa || '');
    setAudioUrl(w.audioUrl || null);
    setCategoryId(w.categoryId || 'none');
    setEditCatId(w.categoryId || 'none');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteWord(id);
      toast.success('حذف شد');
      onReload();
    } catch {
      toast.error('حذف ناموفق بود');
    }
  };

  const handleQuickCategoryChange = async (w: Word, newCat: string) => {
    try {
      await api.updateWord(w.id, { categoryId: newCat === 'none' ? null : newCat });
      onReload();
    } catch {
      toast.error('تغییر دسته ناموفق بود');
    }
  };

  const filtered = words.filter((w) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (
      w.german.toLowerCase().includes(s) ||
      w.persian.includes(q) ||
      (w.article || '').toLowerCase().includes(s)
    );
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <Card className="lg:sticky lg:top-6 h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-700">
            {editingId ? <Pencil size={18} /> : <Plus size={18} />}
            {editingId ? 'ویرایش کلمه' : 'افزودن کلمه جدید'}
          </CardTitle>
          <CardDescription>
            کلمه آلمانی را وارد کنید و دکمه تکمیل هوشمند را بزنید تا مقاله، جمع، تلفظ و ترجمه فارسی به‌صورت خودکار پر شوند.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="german">کلمه آلمانی</Label>
            <div className="flex gap-2 mt-1.5">
              <Input
                id="german"
                value={german}
                onChange={(e) => setGerman(e.target.value)}
                placeholder="مثلاً: Haus"
                dir="ltr"
                className="text-left font-mono"
              />
              <Button
                type="button"
                onClick={handleEnrich}
                disabled={enriching}
                variant="default"
                className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
              >
                {enriching ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                <span className="mr-1">تکمیل هوشمند</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="article">Article</Label>
              <Select value={article || 'none'} onValueChange={(v) => setArticle(v === 'none' ? '' : v)}>
                <SelectTrigger id="article"><SelectValue placeholder="انتخاب..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— بدون —</SelectItem>
                  <SelectItem value="der">der (مذکر)</SelectItem>
                  <SelectItem value="die">die (مؤنث)</SelectItem>
                  <SelectItem value="das">das (خنثی)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="plural">جمع (Plural)</Label>
              <Input id="plural" value={plural} onChange={(e) => setPlural(e.target.value)} dir="ltr" className="font-mono" placeholder="Häuser" />
            </div>
          </div>

          <div>
            <Label htmlFor="ipa">تلفظ (IPA)</Label>
            <Input id="ipa" value={ipa} onChange={(e) => setIpa(e.target.value)} dir="ltr" className="font-mono" placeholder="ˈhaʊs" />
          </div>

          <div>
            <Label htmlFor="persian">ترجمه فارسی</Label>
            <Input id="persian" value={persian} onChange={(e) => setPersian(e.target.value)} placeholder="خانه" />
          </div>

          <div>
            <Label htmlFor="example">مثال آلمانی</Label>
            <Textarea id="example" value={example} onChange={(e) => setExample(e.target.value)} dir="ltr" className="font-mono min-h-[60px]" placeholder="Das ist mein Haus." />
          </div>

          <div>
            <Label htmlFor="exampleFa">ترجمه مثال (فارسی)</Label>
            <Textarea id="exampleFa" value={exampleFa} onChange={(e) => setExampleFa(e.target.value)} className="min-h-[60px]" placeholder="این خانه من است." />
          </div>

          <div>
            <Label htmlFor="category">دسته‌بندی</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="category"><SelectValue placeholder="بدون دسته" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— بدون دسته —</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3 rounded-lg border p-3 bg-muted/40">
            <AudioButton url={audioUrl} text={german} onMissing={() => handleGenerateAudio()} size="lg" />
            <div className="text-sm">
              <div className="font-medium">فایل صوتی</div>
              <p className="text-muted-foreground text-xs">
                {audioUrl ? 'آماده برای پخش • دوباره بساز' : 'برای ساخت فایل صوتی از کلمه/مثال، دکمه را بزنید'}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" className="mr-auto" onClick={() => handleGenerateAudio()}>
              {audioUrl ? 'بازسازی' : 'ساخت صدا'}
            </Button>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving || !german.trim() || !persian.trim()}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {saving ? <Loader2 className="animate-spin mr-2" size={16} /> : <Check className="mr-2" size={16} />}
              {editingId ? 'ذخیره تغییرات' : 'ذخیره کلمه'}
            </Button>
            {editingId && (
              <Button type="button" variant="ghost" onClick={handleCancelEdit}>
                <X className="mr-1" size={16} /> لغو
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  placeholder="جستجوی کلمه یا ترجمه..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pr-9"
                />
              </div>
              <Badge variant="secondary" className="shrink-0">{filtered.length} کلمه</Badge>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <Plus size={32} className="mx-auto mb-2 opacity-50" />
              <p>هنوز کلمه‌ای ثبت نشده. اولین کلمه را اضافه کنید.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((w) => (
              <Card key={w.id} className="overflow-hidden hover:shadow-md transition">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {w.article && (
                          <Badge variant="outline" className={`text-xs ${ARTICLE_COLORS[w.article] || ''}`}>
                            {w.article}
                          </Badge>
                        )}
                        <h3 className="font-bold text-lg truncate" dir="ltr">{w.german}</h3>
                        {w.ipa && <span className="text-xs text-muted-foreground font-mono" dir="ltr">/{w.ipa}/</span>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">{w.persian}</p>
                      {w.plural && (
                        <p className="text-xs text-muted-foreground mt-1" dir="ltr">
                          جمع: <span className="font-mono">{w.plural}</span>
                        </p>
                      )}
                      {w.example && (
                        <p className="text-xs mt-2 text-muted-foreground italic line-clamp-2" dir="ltr">
                          «{w.example}»
                        </p>
                      )}
                      {w.exampleFa && (
                        <p className="text-xs mt-0.5 text-muted-foreground line-clamp-2">
                          {w.exampleFa}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <Select value={w.categoryId || 'none'} onValueChange={(v) => handleQuickCategoryChange(w, v)}>
                          <SelectTrigger className="h-7 text-xs w-auto min-w-[120px] max-w-[180px]">
                            <SelectValue placeholder="بدون دسته" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— بدون دسته —</SelectItem>
                            {categories.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {w.category && (
                          <Badge variant="secondary" className="text-xs">{w.category.name}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <AudioButton url={w.audioUrl} text={w.german} onMissing={async () => {
                        const u = await api.generateAudio(w.example || w.german, { lang: 'de', speed: 0.95 });
                        if (u) await api.updateWord(w.id, { audioUrl: u });
                        onReload();
                        return u;
                      }} size="sm" />
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(w)}>
                        <Pencil size={14} />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive">
                            <Trash2 size={14} />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>حذف کلمه؟</AlertDialogTitle>
                            <AlertDialogDescription>
                              «{w.german}» برای همیشه حذف می‌شود و قابل بازگردانی نیست.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>لغو</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(w.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              حذف
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
