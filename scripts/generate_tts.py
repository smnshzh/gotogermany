#!/usr/bin/env python3
"""Multilingual TTS generator with focus on natural pronunciation.

Engine priority:
  - German ('de'): Piper (offline, neural, very natural Thorsten voice)
      - Falls back to edge-tts (de-DE-KatjaNeural) if Piper model unavailable
  - Other languages (fa, en, fr, es, tr, ar): edge-tts (Microsoft Neural)
      - Falls back to gTTS (non-Persian only)
      - Last resort: espeak-ng offline

Output: single .mp3 (Piper WAV converted to MP3 via ffmpeg if available, otherwise WAV).

Usage:
  python3 generate_tts.py --text "Hallo" --lang de --speed 1.0 --voice female

Prints 'OUT:/path/to/file' as the LAST line so the Node caller can read it.
"""
import argparse
import asyncio
import os
import sys
import tempfile
import shutil
import subprocess


# === Voice configurations ===
EDGE_VOICES = {
    'de': {'female': 'de-DE-KatjaNeural', 'male': 'de-DE-ConradNeural', 'default': 'de-DE-KatjaNeural'},
    'fa': {'female': 'fa-IR-DilaraNeural', 'male': 'fa-IR-FaridNeural', 'default': 'fa-IR-FaridNeural'},
    'en': {'female': 'en-US-AriaNeural', 'male': 'en-US-GuyNeural', 'default': 'en-US-AriaNeural'},
    'fr': {'female': 'fr-FR-DeniseNeural', 'male': 'fr-FR-HenriNeural', 'default': 'fr-FR-DeniseNeural'},
    'es': {'female': 'es-ES-ElviraNeural', 'male': 'es-ES-AlvaroNeural', 'default': 'es-ES-ElviraNeural'},
    'tr': {'female': 'tr-TR-EmelNeural', 'male': 'tr-TR-AhmetNeural', 'default': 'tr-TR-AhmetNeural'},
    'ar': {'female': 'ar-SA-ZariyahNeural', 'male': 'ar-SA-HamedNeural', 'default': 'ar-SA-HamedNeural'},
}

# Piper voice models (highest quality, fully offline)
PIPER_VOICES_DIR = '/home/z/my-project/.piper-voices'

PIPER_VOICES = {
    'de': {
        'default': 'de_DE-thorsten-high.onnx',
        'male': 'de_DE-thorsten-high.onnx',
        'female': 'de_DE-thorsten-high.onnx',  # Thorsten is male but high quality
    },
}

# Slight prosody tweaks to make voices more natural (less robotic)
PROSODY_TWEAKS = {
    'de': {'rate': '-3%', 'pitch': '+1Hz'},   # slightly slower + slightly higher pitch = warmer
    'fa': {'rate': '-2%', 'pitch': '+1Hz'},
    'en': {'rate': '+0%', 'pitch': '+0Hz'},
    'fr': {'rate': '-3%', 'pitch': '+1Hz'},
    'es': {'rate': '-3%', 'pitch': '+1Hz'},
    'tr': {'rate': '-3%', 'pitch': '+1Hz'},
    'ar': {'rate': '-5%', 'pitch': '+0Hz'},
}


# === Piper (offline neural TTS, best for German) ===
def piper_generate(text: str, lang: str, voice_gender: str, out_path: str) -> bool:
    """Use Piper TTS (offline). Returns True on success."""
    if not PIPER_VOICES.get(lang):
        return False
    voice_filename = PIPER_VOICES[lang].get(voice_gender) or PIPER_VOICES[lang].get('default')
    if not voice_filename:
        return False
    voice_path = os.path.join(PIPER_VOICES_DIR, lang, voice_filename)
    if not os.path.exists(voice_path):
        sys.stderr.write(f'[piper] voice model not found: {voice_path}\n')
        return False
    try:
        import piper
        import wave
    except ImportError:
        sys.stderr.write('[piper] not installed\n')
        return False
    try:
        voice = piper.PiperVoice.load(voice_path)
        wav_path = out_path if out_path.endswith('.wav') else out_path + '.wav'
        with wave.open(wav_path, 'wb') as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(voice.config.sample_rate)
            for chunk in voice.synthesize(text):
                wav.writeframes(chunk.audio_int16_bytes)
        # Convert to MP3 if ffmpeg available
        if out_path != wav_path:
            if not convert_to_mp3(wav_path, out_path):
                # Use wav instead
                shutil.move(wav_path, out_path)
        else:
            out_path = wav_path
        return os.path.exists(out_path) and os.path.getsize(out_path) > 0
    except Exception as e:
        sys.stderr.write(f'[piper] failed: {e}\n')
        return False


def convert_to_mp3(wav_path: str, mp3_path: str) -> bool:
    """Convert WAV to MP3 using ffmpeg. Returns True on success."""
    if not shutil.which('ffmpeg'):
        return False
    try:
        subprocess.run(
            ['ffmpeg', '-y', '-i', wav_path, '-codec:a', 'libmp3lame', '-b:a', '96k', mp3_path],
            check=True,
            capture_output=True,
            timeout=30,
        )
        os.unlink(wav_path)
        return True
    except Exception as e:
        sys.stderr.write(f'[ffmpeg] failed: {e}\n')
        return False


# === edge-tts (Microsoft Neural, high quality for all langs) ===
def edge_tts_generate(text: str, lang: str, speed: float, voice_gender: str, out_path: str) -> bool:
    """Use edge-tts (Microsoft Edge neural voices). Returns True on success."""
    try:
        import edge_tts
    except ImportError:
        sys.stderr.write('[edge-tts] not installed\n')
        return False

    voices = EDGE_VOICES.get(lang)
    if not voices:
        sys.stderr.write(f'[edge-tts] unsupported lang: {lang}\n')
        return False

    voice = voices.get(voice_gender) or voices.get('default')
    if not voice:
        sys.stderr.write(f'[edge-tts] no voice for {lang}/{voice_gender}\n')
        return False

    # Apply prosody tweaks for more natural sound
    prosody = PROSODY_TWEAKS.get(lang, {})

    # speed: 0.5-2.0 -> percentage offset
    base_rate = max(-50, min(100, int((speed - 1.0) * 100)))
    # Combine with prosody tweak (parse "-3%" -> -3)
    tweak_rate_str = prosody.get('rate', '+0%')
    try:
        tweak_rate = int(tweak_rate_str.rstrip('%+-'))
    except ValueError:
        tweak_rate = 0
    rate_str = f'{base_rate + tweak_rate:+d}%'

    tweak_pitch_str = prosody.get('pitch', '+0Hz')

    async def _run():
        communicate = edge_tts.Communicate(text, voice, rate=rate_str, pitch=tweak_pitch_str)
        await communicate.save(out_path)

    try:
        asyncio.run(_run())
        return os.path.exists(out_path) and os.path.getsize(out_path) > 0
    except Exception as e:
        sys.stderr.write(f'[edge-tts] failed: {e}\n')
        return False


# === gTTS fallback (Google Translate TTS, German/English only) ===
def gtts_generate(text: str, lang: str, speed: float, out_path: str) -> bool:
    """Try gTTS. Does NOT support Persian."""
    try:
        from gtts import gTTS
        slow = speed < 0.85
        tts = gTTS(text=text, lang=lang, slow=slow)
        tts.save(out_path)
        return True
    except Exception as e:
        sys.stderr.write(f'[gtts] failed: {e}\n')
        return False


# === espeak-ng last resort ===
def espeak_generate(text: str, lang: str, speed: float, out_path: str) -> bool:
    voice_map = {
        'de': 'de', 'fa': 'fa', 'en': 'en-US', 'fr': 'fr', 'es': 'es', 'it': 'it', 'tr': 'tr', 'ar': 'ar',
    }
    voice = voice_map.get(lang, lang)
    wpm = int(175 * max(0.5, min(2.0, speed)))
    wpm = max(80, min(450, wpm))
    wav_path = out_path + '.wav'
    try:
        subprocess.run(
            ['espeak-ng', '-v', voice, '-s', str(wpm), '-w', wav_path, text],
            check=True, capture_output=True, timeout=30,
        )
    except Exception as e:
        sys.stderr.write(f'[espeak] failed: {e}\n')
        return False
    if not convert_to_mp3(wav_path, out_path):
        shutil.move(wav_path, out_path)
    return True


def main():
    parser = argparse.ArgumentParser(description='Generate TTS audio (multilingual, natural voices)')
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

    # 1. For German: try Piper first (offline neural, very natural)
    if args.lang == 'de':
        wav_path = os.path.join(out_dir, 'out.wav')
        if piper_generate(text, args.lang, args.voice, wav_path):
            # Convert WAV to MP3 (Piper outputs WAV)
            if convert_to_mp3(wav_path, out_path):
                print(f'OUT:{out_path}')
                return
            # If conversion failed, serve the WAV
            if os.path.exists(wav_path):
                print(f'OUT:{wav_path}')
                return

    # 2. Try edge-tts (best for non-German, and good German fallback)
    if edge_tts_generate(text, args.lang, args.speed, args.voice, out_path):
        print(f'OUT:{out_path}')
        return

    # 3. Fallback: gTTS (only for non-Persian)
    if args.lang != 'fa' and gtts_generate(text, args.lang, args.speed, out_path):
        print(f'OUT:{out_path}')
        return

    # 4. Last resort: espeak-ng
    wav_path = os.path.join(out_dir, 'out.wav')
    if espeak_generate(text, args.lang, args.speed, wav_path):
        print(f'OUT:{wav_path}')
        return

    sys.stderr.write('All TTS engines failed\n')
    sys.exit(2)


if __name__ == '__main__':
    main()
