"""Back-transcribe the voice-over with a local Whisper model to catch words the TTS voice mispronounced.

  pip install mlx-whisper          # Apple Silicon, or:
  pip install faster-whisper       # any platform (CPU / CUDA)
  python3 tools/check_vo.py kk     # language code

Needs ffmpeg on PATH. Runs offline after the first model download. Model via env WHISPER_MODEL (default large-v3;
large-v3-turbo is faster, a bit less accurate for low-resource languages).
"""
import json, os, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
lang = sys.argv[1] if len(sys.argv) > 1 else 'kk'
name = os.environ.get('WHISPER_MODEL', 'large-v3')

try:
    import mlx_whisper

    repo = f'mlx-community/whisper-{name}' + ('' if 'turbo' in name else '-mlx')

    def transcribe(path):
        return mlx_whisper.transcribe(str(path), path_or_hf_repo=repo, language=lang, temperature=0.0)['text']
except ImportError:
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        sys.exit('install mlx-whisper (Apple Silicon) or faster-whisper')
    model = WhisperModel(name, device='auto', compute_type='auto')

    def transcribe(path):
        segments, _ = model.transcribe(str(path), language=lang, temperature=0.0)
        return ' '.join(s.text for s in segments)

for item in json.loads((ROOT / 'src/vo.json').read_text()):
    if not item.get('file'):
        continue
    f = ROOT / 'public' / item['file']
    print(f'{f.name}\n  script: {item["text"]}\n  heard : {transcribe(f).strip()}\n', flush=True)
