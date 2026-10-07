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
import { Sparkles, Loader2, Trash2, Mic, Play, Pause, Download, Save, RefreshCw, Clock, FileText, Volume2, Headphones } from 'lucide-react';
import { toast } from 'sonner';
import type { Podcast } from '@/lib/types';
import * as api from '@/lib/api';

interface Props {
  podcasts: Podcast[];
  loading: boolean;
  onReload: () => void;
}

const LENGTH_OPTIONS = [
  { value: 'short', label: 'کوتاه (~۱ دقیقه)', desc: 'یک نکته سریع' },
  { value: 'medium', label: 'متوسط (~۲-۳ دقیقه)', desc: 'یک موضوع با مثال' },
  { value: 'long', label: 'بلند (~۵ دقیقه)', desc: 'چند نکته عمیق' },
];

const STYLE_OPTIONS = [
  { value: 'narrative', label: 'روایتی', desc: 'مقدمه، بحث، نتیجه', icon: FileText },
  { value: 'qa', label: 'سؤال و جواب', desc: 'سؤال جذاب و پاسخ', icon: Mic },
  { value: 'list', label: 'لیست نکات', desc: '۳ تا ۵ نکته کوتاه', icon: FileText },
  { value: 'story', label: 'داستانی', desc: 'یک داستان کوتاه', icon: Headphones },
];

const VOICE_OPTIONS = [
  { value: 'default', label: 'پیش‌فرض (مذکر)' },
  { value: 'male', label: 'مذکر (فرید)' },
  { value: 'female', label: 'مؤنث (دیلارا)' },
];

export function PodcastTab({ podcasts, loading, onReload }: Props) {
  const [topic, setTopic] = useState('');
  const [length, setLength] = useState<'short' | 'medium' | 'long'>('short');
  const [style, setStyle] = useState<'narrative' | 'qa' | 'list' | 'story'>('narrative');
  const [generating, setGenerating] = useState(false);
  const [genTitle, setGenTitle] = useState('');
  const [genScript, setGenScript] = useState('');
  const [genDuration, setGenDuration] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [voice, setVoice] = useState<'default' | 'male' | 'female'>('default');
  const [playing, setPlaying] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error('موضوع پادکست را وارد کنید');
      return;
    }
    setGenerating(true);
    setGenTitle('');
    setGenScript('');
    setGenDuration('');
    setAudioUrl(null);
    try {
      const r = await api.generatePodcastScript(topic.trim(), { length, style });
      setGenTitle(r.title);
      setGenScript(r.script);
      setGenDuration(r.duration);
      toast.success('متن پادکست آماده شد');
    } catch (e) {
      console.error(e);
      toast.error('خطا در تولید پادکست');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateAudio = async () => {
    if (!genScript) return;
    setAudioLoading(true);
    try {
      const url = await api.generateAudio(genScript, { lang: 'fa', speed: 1.0, voice });
      setAudioUrl(url);
      toast.success('فایل صوتی ساخته شد');
    } catch (e) {
      console.error(e);
      toast.error('ساخت صدا ناموفق بود');
    } finally {
      setAudioLoading(false);
    }
  };

  const handlePlayPause = () => {
    const a = document.getElementById('podcast-audio') as HTMLAudioElement | null;
    if (!a) return;
    if (a.paused) {
      a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  const handleSave = async () => {
    if (!genTitle || !genScript) {
      toast.error('ابتدا پادکست تولید کنید');
      return;
    }
    setSaving(true);
    try {
      await api.createPodcast({
        topic: topic.trim(),
        title: genTitle,
        script: genScript,
        duration: genDuration,
        audioUrl,
      });
      toast.success('پادکست ذخیره شد');
      setTopic('');
      setGenTitle('');
      setGenScript('');
      setGenDuration('');
      setAudioUrl(null);
      onReload();
    } catch (e) {
      console.error(e);
      toast.error('ذخیره ناموفق بود');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateAudio = async (p: Podcast) => {
    try {
      toast.message('در حال ساخت صدا...');
      const url = await api.generateAudio(p.script, { lang: 'fa', speed: 1.0, voice });
      await api.updatePodcast(p.id, { audioUrl: url });
      toast.success('صدا ساخته شد');
      onReload();
    } catch {
      toast.error('ساخت صدا ناموفق بود');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deletePodcast(id);
      toast.success('حذف شد');
      onReload();
    } catch {
      toast.error('حذف ناموفق بود');
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[440px_1fr]">
      <Card className="h-fit lg:sticky lg:top-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-700">
            <Mic size={18} /> تولید پادکست کوتاه
          </CardTitle>
          <CardDescription>موضوع را بنویس، هوش مصنوعی متن پادکست می‌نویسد و صدای فارسی هم می‌سازد.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="topic">موضوع پادکست</Label>
            <Textarea
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="مثلاً: «چرا یادگیری زبان آلمانی مفید است؟» یا «۵ کلمه آلمانی برای سفر به برلین»"
              className="mt-1.5 min-h-[80px]"
            />
          </div>

          <div>
            <Label>طول پادکست</Label>
            <Select value={length} onValueChange={(v) => setLength(v as typeof length)}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LENGTH_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    <div className="flex flex-col">
                      <span>{o.label}</span>
                      <span className="text-xs text-muted-foreground">{o.desc}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>ساختار</Label>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              {STYLE_OPTIONS.map((o) => {
                const Icon = o.icon;
                const active = style === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setStyle(o.value as typeof style)}
                    className={`rounded-lg border p-2.5 text-right text-xs transition ${
                      active ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/30' : 'hover:bg-muted/40'
                    }`}
                  >
                    <Icon size={14} className="text-emerald-600 mb-1" />
                    <div className="font-medium">{o.label}</div>
                    <div className="text-[10px] text-muted-foreground">{o.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <Button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !topic.trim()}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {generating ? <Loader2 className="animate-spin mr-2" size={16} /> : <Sparkles className="mr-2" size={16} />}
            تولید متن پادکست
          </Button>

          {genTitle && (
            <div className="space-y-3 pt-2 border-t">
              <div>
                <Label>عنوان پادکست</Label>
                <Input value={genTitle} onChange={(e) => setGenTitle(e.target.value)} className="mt-1.5 font-medium" />
              </div>
              <div>
                <Label>متن پادکست</Label>
                <Textarea
                  value={genScript}
                  onChange={(e) => setGenScript(e.target.value)}
                  className="mt-1.5 min-h-[200px] text-sm leading-7"
                />
              </div>
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">
                  <Clock size={12} className="ml-1" />
                  {genDuration}
                </Badge>
                <Badge variant="outline">{genScript.split(/\s+/).length} کلمه</Badge>
              </div>

              <div>
                <Label>صدای گوینده</Label>
                <Select value={voice} onValueChange={(v) => setVoice(v as typeof voice)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VOICE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handleGenerateAudio}
                  disabled={audioLoading}
                >
                  {audioLoading ? <Loader2 className="animate-spin mr-1" size={14} /> : <Volume2 className="mr-1" size={14} />}
                  {audioUrl ? 'ساخت مجدد صدا' : 'ساخت صدا'}
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {saving ? <Loader2 className="animate-spin mr-1" size={14} /> : <Save className="mr-1" size={14} />}
                  ذخیره پادکست
                </Button>
              </div>

              {audioUrl && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <Button size="icon" className="h-10 w-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shrink-0" onClick={handlePlayPause}>
                      {playing ? <Pause size={16} /> : <Play size={16} />}
                    </Button>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground">پخش پادکست</div>
                      <div className="text-sm font-medium truncate">{genTitle}</div>
                    </div>
                    <a href={audioUrl} download className="text-muted-foreground hover:text-foreground">
                      <Download size={16} />
                    </a>
                  </div>
                  <audio
                    id="podcast-audio"
                    src={audioUrl}
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                    onEnded={() => setPlaying(false)}
                    className="w-full"
                    controls
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold">پادکست‌های ذخیره‌شده</h3>
              <p className="text-xs text-muted-foreground">متن و صدای پادکست‌های قبلی</p>
            </div>
            <Badge variant="secondary">{podcasts.length} پادکست</Badge>
          </CardContent>
        </Card>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : podcasts.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <Mic size={32} className="mx-auto mb-2 opacity-50" />
              <p>هنوز پادکستی ساخته نشده. اولین پادکست خود را بسازید.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {podcasts.map((p) => (
              <Card key={p.id} className="hover:shadow-md transition">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-lg leading-tight">{p.title}</h3>
                      {p.topic && (
                        <p className="text-xs text-muted-foreground mt-0.5">موضوع: {p.topic}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {p.duration && (
                          <Badge variant="secondary" className="text-xs">
                            <Clock size={10} className="ml-1" /> {p.duration}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {p.script.split(/\s+/).length} کلمه
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-3 leading-6">{p.script}</p>
                      {p.audioUrl && (
                        <audio
                          src={p.audioUrl}
                          controls
                          className="w-full mt-3 h-9"
                        />
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleRegenerateAudio(p)}
                        title="ساخت/بازسازی صدا"
                      >
                        <Volume2 size={14} />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                            <Trash2 size={14} />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>حذف پادکست؟</AlertDialogTitle>
                            <AlertDialogDescription>
                              «{p.title}» برای همیشه حذف می‌شود.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>لغو</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(p.id)}
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
