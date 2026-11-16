# map-history-film

Narrated, Johnny Harris-style animated map films from plain scene data — Remotion + d3, with an ElevenLabs voice-over per scene. Also a Claude Code skill: drop the folder into `~/.claude/skills/` and ask Claude for a map animation about any historical topic.

The bundled example is a 15-scene, ~3-minute film in Kazakh about the 1723–1727 Dzungar invasion of the Kazakh steppe («Ақтабан шұбырынды, Алқакөл сұлама»).

**What a scene can do:** colour regions and recolour them over time, draw arrows along a track, run dotted flows, drop army swarms, mark and flip cities, fire strike rings, measure distances with a live counter, show a counting year, kinetic titles, dated cards and a loss chart — with a camera that pans and zooms between keyframes.

## Quick start

```bash
npm install
python3 tools/fetch_basemap.py 40 24.4921875 110 65.5078125    # Central Asia, writes public/basemap.jpg
# add a font that covers your alphabet: public/fonts/Display-*.ttf (see src/theme.ts)
npm run studio                                                   # scrub the film without a voice-over
```

Voice-over and final render:

```bash
export ELEVENLABS_API_KEY=...  ELEVENLABS_VOICE_ID=...          # your voice; model eleven_v4, Kazakh by default
python3 tools/tts_elevenlabs.py src/data/aktaban.vo.json
GROQ_API_KEY=... python3 tools/check_vo.py kk                   # optional: hear-back check
npm run render && tools/finish.sh out/film.mp4 out/film_final.mp4
python3 tools/storyboard.py                                      # 0.5 s frame sheets per scene
```

Promo clip (5:4, headline + clip card + comment call-to-action):

```bash
ffmpeg -ss 37 -to 61 -i out/film_final.mp4 public/promo_clip.mp4
npm run promo
```

## Make your own film

1. Copy `src/data/aktaban.js` → `src/data/<topic>.js`, change the import at the top of `src/MapFilm.tsx`.
2. Edit geography (`geo.regions`, `geo.cities`, labels), `extent`, `badges`, `dates` and the scenes. The full scene schema and the step-by-step workflow are in [SKILL.md](SKILL.md).
3. Write the narration to `src/data/<topic>.vo.json`, one text per scene, numbers as words.

## Notes

- Regions and routes in the example are schematic; the example's disputed facts (army size, battle years, the location of Alkakol) are labelled as such on screen.
- The basemap is fetched from Esri's World Physical Map export; read Esri's terms for your use and keep the attribution. Any lon/lat raster with a known extent works.
- Fonts and voice files are not included. The type overlay was designed for a heavy grotesque with full Cyrillic coverage.

---

## Қазақша

Карта-анимациялы тарихи видео жасайтын Remotion жобасы және Claude Code скилі. Сахналар дерек ретінде жазылады: камера, аймақтар, жебелер, қалалар, титрлер және диктор мәтіні. Нәтиже — әр сахнасына ElevenLabs озвучкасы қосылған MP4. Мысал ретінде 1723–1727 жылдардағы жоңғар шапқыншылығы туралы 15 сахналық фильм берілген.

Скил ретінде қолдану үшін папканы `~/.claude/skills/map-history-film` етіп қойыңыз да, Claude-тан «… тақырыбына карта-анимация жаса» деп сұраңыз. Жұмыс кезеңдері [SKILL.md](SKILL.md) файлында жазылған.

## License

MIT — see [LICENSE](LICENSE).
