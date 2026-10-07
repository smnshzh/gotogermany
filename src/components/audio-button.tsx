'use client';

import { useEffect, useRef, useState } from 'react';
import { Volume2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  url?: string | null;
  text?: string;
  onMissing?: () => Promise<string | null | undefined>;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

export function AudioButton({ url, text, onMissing, size = 'md', className, label }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [resolvedUrl, setResolvedUrl] = useState<string | null | undefined>(url);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setResolvedUrl(url);
  }, [url]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onPlay = () => setPlaying(true);
    const onEnd = () => setPlaying(false);
    a.addEventListener('playing', onPlay);
    a.addEventListener('ended', onEnd);
    a.addEventListener('pause', onEnd);
    return () => {
      a.removeEventListener('playing', onPlay);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('pause', onEnd);
    };
  }, [resolvedUrl]);

  const handleClick = async () => {
    if (!resolvedUrl && onMissing) {
      setLoading(true);
      try {
        const u = await onMissing();
        if (u) setResolvedUrl(u);
      } finally {
        setLoading(false);
      }
      return;
    }
    if (!resolvedUrl) return;
    const a = audioRef.current ?? new Audio(resolvedUrl);
    if (!audioRef.current) audioRef.current = a;
    if (a.src !== resolvedUrl) a.src = resolvedUrl;
    a.currentTime = 0;
    try {
      await a.play();
    } catch (e) {
      console.warn('audio play failed', e);
    }
  };

  const sz = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-14 w-14' : 'h-10 w-10';
  const iconSz = size === 'sm' ? 14 : size === 'lg' ? 26 : 18;

  return (
    <button
      type="button"
      onClick={handleClick}
      title={label || (text ? `پخش: ${text}` : 'پخش صدا')}
      className={cn(
        'inline-flex items-center justify-center rounded-full border bg-background/60 hover:bg-accent transition',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        playing && 'border-emerald-500 text-emerald-600 bg-emerald-50',
        sz,
        className
      )}
      disabled={loading}
    >
      {loading ? <Loader2 className="animate-spin" size={iconSz} /> : <Volume2 size={iconSz} />}
      <audio ref={audioRef} src={resolvedUrl ?? undefined} preload="none" />
    </button>
  );
}
