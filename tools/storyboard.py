"""Frame storyboard of the current film: one frame every 0.5 s, 5 columns, one sheet per scene.

  python3 tools/storyboard.py            # needs: npm i, Pillow (pip install pillow)
Writes out/storyboard/NN_<scene>.jpg. Renders at 25% scale, so it is quick.
"""
import json, math, re, shutil, subprocess
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
frames = ROOT / 'out/sb_frames'
out = ROOT / 'out/storyboard'
shutil.rmtree(frames, ignore_errors=True)
out.mkdir(parents=True, exist_ok=True)
subprocess.run(['npx', 'remotion', 'render', 'MapFilm', str(frames), '--sequence', '--scale=0.25', '--image-format=jpeg'],
               cwd=ROOT, check=True)
# scene boundaries come from the same rule MapFilm uses
files = sorted(frames.glob('*.jpeg')) or sorted(frames.glob('*.jpg'))
FPS, STEP, COLS = 30, 15, 5
src = (ROOT / 'src/data/aktaban.js').read_text()
titles = re.findall(r"\{ id: '[^']+',(?: noBadges: true,)? title: '([^']+)', dur: ([\d.]+)", src)
vo = json.loads((ROOT / 'src/vo.json').read_text())
start = 0
for n, ((title, dur), v) in enumerate(zip(titles, vo), 1):
    real = max(float(dur), v['dur'] + 1.2) if v.get('file') else float(dur)
    count = round(real * FPS)
    picks = files[start:start + count:STEP]
    tw, th = Image.open(picks[0]).size
    rows = math.ceil(len(picks) / COLS)
    sheet = Image.new('RGB', (COLS * tw, 40 + rows * th), (18, 19, 16))
    d = ImageDraw.Draw(sheet)
    d.text((10, 12), f'{n:02d}  {title}  ·  {real:.1f} s  ·  0.5 s per frame', fill=(242, 210, 46))
    for j, f in enumerate(picks):
        x, y = (j % COLS) * tw, 40 + (j // COLS) * th
        sheet.paste(Image.open(f), (x, y))
        d.rectangle([x, y, x + 44, y + 14], fill=(0, 0, 0))
        d.text((x + 3, y + 2), f'+{j * STEP / FPS:.1f}', fill=(242, 210, 46))
    sheet.save(out / f'{n:02d}.jpg', quality=85)
    start += count
print('sheets in', out)
