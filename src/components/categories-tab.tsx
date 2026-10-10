'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Trash2, FolderOpen, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Category } from '@/lib/types';
import * as api from '@/lib/api';

interface Props {
  categories: Category[];
  loading: boolean;
  onReload: () => void;
}

const COLOR_OPTIONS = [
  { value: 'emerald', label: 'سبز زمردی', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'amber', label: 'کهربایی', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'rose', label: 'صورتی', cls: 'bg-rose-100 text-rose-700 border-rose-200' },
  { value: 'sky', label: 'آبی آسمانی', cls: 'bg-sky-100 text-sky-700 border-sky-200' },
  { value: 'violet', label: 'بنفش', cls: 'bg-violet-100 text-violet-700 border-violet-200' },
  { value: 'orange', label: 'نارنجی', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
];

export function CategoriesTab({ categories, loading, onReload }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('emerald');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('نام دسته را وارد کنید');
      return;
    }
    setSaving(true);
    try {
      await api.createCategory({ name: name.trim(), description: description.trim() || undefined, color });
      toast.success('دسته ساخته شد');
      setName('');
      setDescription('');
      setColor('emerald');
      onReload();
    } catch {
      toast.error('ساخت دسته ناموفق بود');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteCategory(id);
      toast.success('حذف شد');
      onReload();
    } catch {
      toast.error('حذف ناموفق بود');
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-[400px_1fr]">
      <Card className="h-fit md:sticky md:top-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-700">
            <Plus size={18} /> دسته جدید
          </CardTitle>
          <CardDescription>دسته‌بندی برای سازمان‌دهی کلمات بسازید.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="cat-name">نام دسته</Label>
            <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً: غذا، سفر، کار..." className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="cat-desc">توضیح (اختیاری)</Label>
            <Textarea id="cat-desc" value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[70px]" placeholder="کلمات مرتبط با غذا و نوشیدنی" />
          </div>
          <div>
            <Label>رنگ</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`text-xs border rounded-md px-2 py-1.5 transition ${c.cls} ${color === c.value ? 'ring-2 ring-offset-1 ring-emerald-500' : ''}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <Button
            type="button"
            onClick={handleCreate}
            disabled={saving || !name.trim()}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {saving ? <Loader2 className="animate-spin mr-2" size={16} /> : <Plus className="mr-2" size={16} />}
            ساخت دسته
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {loading ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">در حال بارگذاری...</CardContent></Card>
        ) : categories.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <FolderOpen size={32} className="mx-auto mb-2 opacity-50" />
              <p>هنوز دسته‌ای ساخته نشده.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {categories.map((c) => {
              const colorCls = COLOR_OPTIONS.find((x) => x.value === c.color)?.cls || COLOR_OPTIONS[0].cls;
              return (
                <Card key={c.id} className="hover:shadow-md transition">
                  <CardContent className="p-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={colorCls}>{c.color}</Badge>
                        <h3 className="font-bold text-lg truncate">{c.name}</h3>
                      </div>
                      {c.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.description}</p>}
                      <p className="text-xs text-muted-foreground mt-2">{c._count?.words || 0} کلمه</p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive shrink-0">
                          <Trash2 size={16} />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>حذف دسته؟</AlertDialogTitle>
                          <AlertDialogDescription>
                            دسته «{c.name}» حذف می‌شود. کلمات داخل آن حذف نمی‌شوند ولی بدون دسته می‌مانند.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>لغو</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(c.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            حذف
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
