"""Voice-over: one mp3 per scene with ElevenLabs, then src/vo.json with real durations.

  export ELEVENLABS_API_KEY=...        # key with text_to_speech permission
  export ELEVENLABS_VOICE_ID=...       # your cloned or library voice
  python3 tools/tts_elevenlabs.py src/data/aktaban.vo.json

Options via env: ELEVENLABS_MODEL (default eleven_v4), VO_LANG (default kk),
VO_STABILITY (0.65), VO_SIMILARITY (1.0). Write numbers as words in the texts:
TTS models read digits unreliably in many languages. Existing mp3s are reused; delete one to regenerate it.
"""
import json, os, shutil, subprocess, sys, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
texts = json.loads(Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / 'src/data/aktaban.vo.json').read_text())
KEY = os.environ.get('ELEVENLABS_API_KEY') or sys.exit('set ELEVENLABS_API_KEY')
VOICE = os.environ.get('ELEVENLABS_VOICE_ID') or sys.exit('set ELEVENLABS_VOICE_ID')
MODEL = os.environ.get('ELEVENLABS_MODEL', 'eleven_v4')
LANG = os.environ.get('VO_LANG', 'kk')
SETTINGS = {'stability': float(os.environ.get('VO_STABILITY', 0.65)), 'similarity_boost': float(os.environ.get('VO_SIMILARITY', 1.0))}
FFPROBE = shutil.which('ffprobe') or sys.exit('ffprobe not found on PATH')
OUT = ROOT / 'public/vo'
OUT.mkdir(parents=True, exist_ok=True)


def tts(text, path):
    body = {'text': text, 'model_id': MODEL, 'voice_settings': SETTINGS}
    if LANG:
        body['language_code'] = LANG
    req = urllib.request.Request(
        f'https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format=mp3_44100_128',
        data=json.dumps(body).encode(), headers={'xi-api-key': KEY, 'Content-Type': 'application/json'})
    path.write_bytes(urllib.request.urlopen(req, timeout=180).read())


meta = []
for i, text in enumerate(texts, 1):
    p = OUT / f'{i:02d}.mp3'
    if not p.exists():
        tts(text, p)
    dur = float(subprocess.run([FFPROBE, '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(p)],
                               capture_output=True, text=True).stdout)
    meta.append({'file': f'vo/{p.name}', 'dur': round(dur, 3), 'text': text})
    print(p.name, round(dur, 2), flush=True)
(ROOT / 'src/vo.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1))
