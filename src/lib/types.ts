export interface Category {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  createdAt: string;
  _count?: { words: number };
}

export interface Word {
  id: string;
  german: string;
  article?: string | null;
  plural?: string | null;
  ipa?: string | null;
  persian: string;
  example?: string | null;
  exampleFa?: string | null;
  audioUrl?: string | null;
  note?: string | null;
  categoryId?: string | null;
  category?: Category | null;
  createdAt: string;
  updatedAt: string;
}

export interface EnrichResult {
  word: string;
  article: string | null;
  plural: string | null;
  ipa: string | null;
  persian: string;
  example: string | null;
  exampleFa: string | null;
}

export interface Podcast {
  id: string;
  topic: string;
  title: string;
  script: string;
  duration?: string | null;
  audioUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}
