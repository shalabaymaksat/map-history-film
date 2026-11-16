"""Download a physical basemap for the film's area (Esri World Physical Map export, EPSG:4326).

  python3 tools/fetch_basemap.py 40 24.5 110 65.5      # xmin ymin xmax ymax (lon/lat)

Writes public/basemap.jpg and public/basemap.json. The server may widen the box to keep the
aspect ratio: copy the printed extent into your data file (export const extent = ...).
Check Esri's terms of use for your project and keep the attribution on screen.
Any other equirectangular (lon/lat) raster works the same way if you know its extent.
"""
import json, sys, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
xmin, ymin, xmax, ymax = map(float, sys.argv[1:5])
width = 4096
height = round(width * (ymax - ymin) / (xmax - xmin))
q = urllib.parse.urlencode({'bbox': f'{xmin},{ymin},{xmax},{ymax}', 'bboxSR': 4326, 'imageSR': 4326,
                            'size': f'{width},{height}', 'format': 'jpg', 'f': 'json'})
url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/export?' + q
info = json.load(urllib.request.urlopen(url, timeout=120))
(ROOT / 'public/basemap.jpg').write_bytes(urllib.request.urlopen(info['href'], timeout=300).read())
ext = {k: info['extent'][k] for k in ('xmin', 'ymin', 'xmax', 'ymax')}
(ROOT / 'public/basemap.json').write_text(json.dumps({'width': info['width'], 'height': info['height'], 'extent': ext}, indent=1))
print('export const extent =', json.dumps(ext) + ';')
