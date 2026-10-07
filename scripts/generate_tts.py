#!/usr/bin/env python3
"""German TTS generator.
Primary: gTTS (Google Translate TTS) — high quality, requires internet.
Fallback: espeak-ng — offline, lower quality but always available.
Outputs a single .mp3 (gTTS) or .wav (espeak-ng) file.
Prints 'OUT:/path/to/file' as the last line so the Node caller can read it.
"""
import argparse
import os
import sys
import tempfile
import shutil
import subprocess


def gtts_generate(text: str, lang: str, speed: float, out_path: str) -> bool:
    """Try gTTS (Google Translate TTS). Returns True on success."""
    try:
        from gtts import gTTS  # noqa
        # gTTS speed: it has only 'slow' bool. We map speed<1.0 to slow=True.
        slow = speed < 0.85
        tts = gTTS(text=text, lang=lang, slow=slow)
        tts.save(out_path)
        return True
    except Exception as e:
        sys.stderr.write(f"[gtts] failed: {e}\n")
        return False


def espeak_generate(text: str, lang: str, speed: float, out_path: str) -> bool:
    """Use espeak-ng offline. Outputs WAV (will be converted if needed)."""
    # Map our lang code to espeak voice code
    voice_map = {
        'de': 'de',
        'fa': 'fa',
        'en': 'en-US',
        'fr': 'fr',
        'es': 'es',
        'it': 'it',
        'tr': 'tr',
    }
    voice = voice_map.get(lang, lang)
    # espeak words-per-minute: default ~175, slower=lower
    # Our speed is 0.5-2.0; default 1.0 ~ 175 wpm
    wpm = int(175 * max(0.5, min(2.0, speed)))
    # Cap at espeak limits
    wpm = max(80, min(450, wpm))
    # Output as WAV (we'll convert to mp3 below if ffmpeg is available)
    wav_path = out_path + '.wav'
    try:
        subprocess.run(
            ['espeak-ng', '-v', voice, '-s', str(wpm), '-w', wav_path, text],
            check=True,
            capture_output=True,
            timeout=30,
        )
    except Exception as e:
        sys.stderr.write(f"[espeak] failed: {e}\n")
        return False
    # Try to convert to mp3 with ffmpeg; if not available, use wav
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
            sys.stderr.write(f"[ffmpeg] failed: {e}\n")
    # Fallback: just rename wav to the requested output path
    shutil.move(wav_path, out_path)
    return True


def main():
    parser = argparse.ArgumentParser(description='Generate German TTS audio')
    parser.add_argument('--text', required=True)
    parser.add_argument('--lang', default='de')
    parser.add_argument('--speed', type=float, default=1.0)
    args = parser.parse_args()

    text = args.text.strip()
    if not text:
        sys.stderr.write('Empty text\n')
        sys.exit(1)

    out_dir = tempfile.mkdtemp(prefix='tts_')
    # Default to mp3 (gTTS)
    out_path = os.path.join(out_dir, 'out.mp3')

    # Try gTTS first (German Google Translate voice — high quality)
    if gtts_generate(text, args.lang, args.speed, out_path):
        print(f'OUT:{out_path}')
        return

    # Fallback to espeak-ng
    wav_path = os.path.join(out_dir, 'out.wav')
    if espeak_generate(text, args.lang, args.speed, wav_path):
        # Determine extension by actual file type
        print(f'OUT:{wav_path}')
        return

    sys.stderr.write('All TTS engines failed\n')
    sys.exit(2)


if __name__ == '__main__':
    main()
