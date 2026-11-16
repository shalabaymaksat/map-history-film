"""Back-transcribe the voice-over with Groq Whisper to catch words the TTS voice mispronounced.

  export GROQ_API_KEY=...
  python3 tools/check_vo.py kk          # language code
"""
import json, os, sys, urllib.request, uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KEY = os.environ.get('GROQ_API_KEY') or sys.exit('set GROQ_API_KEY')
lang = sys.argv[1] if len(sys.argv) > 1 else 'kk'
for item in json.loads((ROOT / 'src/vo.json').read_text()):
    if not item.get('file'):
        continue
    f = ROOT / 'public' / item['file']
    b = uuid.uuid4().hex
    parts = [f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
             for k, v in (('model', 'whisper-large-v3'), ('language', lang), ('temperature', '0'))]
    parts.append(f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="{f.name}"\r\nContent-Type: audio/mpeg\r\n\r\n'.encode()
                 + f.read_bytes() + f'\r\n--{b}--\r\n'.encode())
    req = urllib.request.Request('https://api.groq.com/openai/v1/audio/transcriptions', data=b''.join(parts),
                                 headers={'Authorization': f'Bearer {KEY}', 'Content-Type': f'multipart/form-data; boundary={b}'})
    heard = json.load(urllib.request.urlopen(req, timeout=120))['text'].strip()
    print(f'{f.name}\n  script: {item["text"]}\n  heard : {heard}\n')
