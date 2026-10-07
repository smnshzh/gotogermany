#!/usr/bin/env python3
"""Multilingual TTS generator.
Primary: edge-tts (Microsoft Edge Neural TTS) — high quality, supports Persian & German.
Fallback 1: gTTS (Google Translate TTS) — German/English only.
Fallback 2: espeak-ng — offline, lower quality, supports Persian & German.

Usage:
  python3 generate_tts.py --text "Hallo" --lang de --speed 1.0 --voice farid

Prints 'OUT:/path/to/file' as the LAST line so the Node caller can read it.
"""
import argparse
import asyncio
import os
import sys
import tempfile
import shutil
import subprocess


# Voice mapping per language
VOICE_MAP = {
    'de': {'female': 'de-DE-AmalaNeural', 'male': 'de-DE-ConradNeural', 'default': 'de-DE-ConradNeural'},
    'fa': {'female': 'fa-IR-DilaraNeural', 'male': 'fa-IR-FaridNeural', 'default': 'fa-IR-FaridNeural'},
    'en': {'female': 'en-US-AriaNeural', 'male': 'en-US-GuyNeural', 'default': 'en-US-AriaNeural'},
    'fr': {'female': 'fr-FR-DeniseNeural', 'male': 'fr-FR-HenriNeural', 'default': 'fr-FR-DeniseNeural'},
    'es': {'female': 'es-ES-ElviraNeural', 'male': 'es-ES-AlvaroNeural', 'default': 'es-ES-ElviraNeural'},
    'tr': {'female': 'tr-TR-EmelNeural', 'male': 'tr-TR-AhmetNeural', 'default': 'tr-TR-AhmetNeural'},
    'ar': {'female': 'ar-SA-ZariyahNeural', 'male': 'ar-SA-HamedNeural', 'default': 'ar-SA-HamedNeural'},
}


def edge_tts_generate(text: str, lang: str, speed: float, out_path: str, voice_gender: str = 'default') -> bool:
    """Use edge-tts (Microsoft Edge neural voices)."""
    try:
        import edge_tts  # noqa
    except ImportError:
        sys.stderr.write('[edge-tts] not installed\n')
        return False

    voices = VOICE_MAP.get(lang)
    if not voices:
        sys.stderr.write(f'[edge-tts] unsupported lang: {lang}\n')
        return False

    voice = voices.get(voice_gender) or voices.get('default')
    if not voice:
        sys.stderr.write(f'[edge-tts] no voice for {lang}/{voice_gender}\n')
        return False

    # edge-tts rate: '+0%' default. speed in 0.5-2.0 -> percentage offset.
    # rate_pct = (speed - 1.0) * 100, clamped to [-50%, +100%]
    rate_pct = max(-50, min(100, int((speed - 1.0) * 100)))
    rate_str = f'{"+" if rate_pct >= 0 else ""}{rate_pct}%'

    async def _run():
        communicate = edge_tts.Communicate(text, voice, rate=rate_str)
        await communicate.save(out_path)

    try:
        asyncio.run(_run())
        return os.path.exists(out_path) and os.path.getsize(out_path) > 0
    except Exception as e:
        sys.stderr.write(f'[edge-tts] failed: {e}\n')
        return False


def gtts_generate(text: str, lang: str, speed: float, out_path: str) -> bool:
    """Try gTTS (Google Translate TTS). Returns True on success.
    Note: gTTS does NOT support Persian."""
    try:
        from gtts import gTTS  # noqa
        slow = speed < 0.85
        tts = gTTS(text=text, lang=lang, slow=slow)
        tts.save(out_path)
        return True
    except Exception as e:
        sys.stderr.write(f'[gtts] failed: {e}\n')
        return False


def espeak_generate(text: str, lang: str, speed: float, out_path: str) -> bool:
    """Use espeak-ng offline."""
    voice_map = {
        'de': 'de',
        'fa': 'fa',
        'en': 'en-US',
        'fr': 'fr',
        'es': 'es',
        'it': 'it',
        'tr': 'tr',
        'ar': 'ar',
    }
    voice = voice_map.get(lang, lang)
    wpm = int(175 * max(0.5, min(2.0, speed)))
    wpm = max(80, min(450, wpm))
    wav_path = out_path + '.wav'
    try:
        subprocess.run(
            ['espeak-ng', '-v', voice, '-s', str(wpm), '-w', wav_path, text],
            check=True,
            capture_output=True,
            timeout=30,
        )
    except Exception as e:
        sys.stderr.write(f'[espeak] failed: {e}\n')
        return False
    if shutil.which('ffmpeg'):
        try:
            subprocess.run(
                ['ffmpeg', '-y', '-i', wav_path, '-codec:a', 'libmp3lame', '-b:a', '64k', out_path],
                check=True,
                capture_output=True,
                timeout=30,
            )
            os.unlink(wav_path)
            return True
        except Exception as e:
            sys.stderr.write(f'[ffmpeg] failed: {e}\n')
    shutil.move(wav_path, out_path)
    return True


def main():
    parser = argparse.ArgumentParser(description='Generate TTS audio (multilingual)')
    parser.add_argument('--text', required=True)
    parser.add_argument('--lang', default='de')
    parser.add_argument('--speed', type=float, default=1.0)
    parser.add_argument('--voice', default='default', help='default | male | female')
    args = parser.parse_args()

    text = args.text.strip()
    if not text:
        sys.stderr.write('Empty text\n')
        sys.exit(1)

    out_dir = tempfile.mkdtemp(prefix='tts_')
    out_path = os.path.join(out_dir, 'out.mp3')

    # 1. Try edge-tts first — best quality, supports Persian + German
    if edge_tts_generate(text, args.lang, args.speed, out_path, args.voice):
        print(f'OUT:{out_path}')
        return

    # 2. Fallback: gTTS (only for non-Persian)
    if args.lang != 'fa' and gtts_generate(text, args.lang, args.speed, out_path):
        print(f'OUT:{out_path}')
        return

    # 3. Last resort: espeak-ng offline
    wav_path = os.path.join(out_dir, 'out.wav')
    if espeak_generate(text, args.lang, args.speed, wav_path):
        print(f'OUT:{wav_path}')
        return

    sys.stderr.write('All TTS engines failed\n')
    sys.exit(2)


if __name__ == '__main__':
    main()
