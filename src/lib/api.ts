import type { Category, Word, EnrichResult } from './types';

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchWords(opts?: { categoryId?: string; q?: string }): Promise<Word[]> {
  const url = new URL('/api/words', window.location.origin);
  if (opts?.categoryId && opts.categoryId !== 'all') url.searchParams.set('categoryId', opts.categoryId);
  if (opts?.q && opts.q.trim()) url.searchParams.set('q', opts.q.trim());
  const r = await j<{ words: Word[] }>(await fetch(url));
  return r.words;
}

export async function createWord(input: Partial<Word> & { german: string; persian: string }): Promise<Word> {
  const r = await j<{ word: Word }>(await fetch('/api/words', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }));
  return r.word;
}

export async function updateWord(id: string, input: Partial<Word>): Promise<Word> {
  const r = await j<{ word: Word }>(await fetch(`/api/words/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }));
  return r.word;
}

export async function deleteWord(id: string): Promise<void> {
  await fetch(`/api/words/${id}`, { method: 'DELETE' });
}

export async function fetchCategories(): Promise<Category[]> {
  const r = await j<{ categories: Category[] }>(await fetch('/api/categories'));
  return r.categories;
}

export async function createCategory(input: { name: string; description?: string; color?: string }): Promise<Category> {
  const r = await j<{ category: Category }>(await fetch('/api/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }));
  return r.category;
}

export async function deleteCategory(id: string): Promise<void> {
  await fetch(`/api/categories/${id}`, { method: 'DELETE' });
}

export async function enrichWord(word: string): Promise<EnrichResult> {
  const r = await j<EnrichResult>(await fetch('/api/ai/enrich', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ word }),
  }));
  return r;
}

export async function generateAudio(text: string, opts?: { voice?: string; speed?: number }): Promise<string> {
  const r = await j<{ url: string }>(await fetch('/api/audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice: opts?.voice ?? 'tongtong', speed: opts?.speed ?? 0.9 }),
  }));
  return r.url;
}
