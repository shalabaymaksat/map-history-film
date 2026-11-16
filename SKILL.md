---
name: map-history-film
description: Make a narrated, Johnny Harris-style animated map film (history, wars, migrations, borders) with Remotion and d3 — research the topic, write a scene-by-scene map storyboard as data, animate regions, arrows, flows, cities, strike rings, distance rulers and title cards over a physical basemap, add an animated type overlay and a per-scene ElevenLabs voice-over, render an MP4 and a promo clip. Use when the user asks for a "map animation", "карта анимация", "тарихи карта видео", "Johnny Harris style", "animated history map", a map storyboard turned into video, or wants to reuse the Aktaban (1723 Dzungar invasion) film for another topic.
---

# Map history film

A Remotion project that turns **scene data** (camera keyframes + timed map layers + voice-over text) into a narrated 1920×1080 film. The bundled example is a 15-scene, ~3-minute Kazakh film about the 1723–1727 Dzungar invasion («Ақтабан шұбырынды»).

```
src/engine/render.js   map renderer: render(svg, scene, t) — d3 projection, SVG layers, no React
src/data/aktaban.js    example data: colors, geography, regions, cities, badges, extent, 15 scenes
src/data/*.vo.json     voice-over texts, one per scene (numbers written as words)
src/MapFilm.tsx        film: basemap <Img> + SVG map + animated type overlay + per-scene audio
src/Promo.tsx          5:4 promo: headline + clip in a rounded card + comment call-to-action
tools/                 fetch_basemap.py · tts_elevenlabs.py · check_vo.py · storyboard.py · finish.sh
```

## Workflow

Work in this order and show the user the result of each stage before moving on.

1. **Research.** Collect 5+ sources (encyclopedias in the film's languages, national history portals, academic papers). Write dates, places, troop numbers, routes and battles as a list. Where sources disagree (numbers, years, locations), mark the fact as disputed and phrase it on screen as "according to …".

2. **Reference style (optional).** If the user gives a reference video, take a frame every 2.5 s, list its motion-graphics segments, and export 0.5 s storyboards of each. Name which map technique each scene borrows: region fill (enemy red, ours blue), arrows drawn along a track, flows of dotted lines, a distance ruler, strike rings, icon swarms, an alliance merging into one colour, highlighted cards and title cards.

3. **Storyboard as data.** Copy `src/data/aktaban.js` to `src/data/<topic>.js` and point the import in `src/MapFilm.tsx` at it. Write 10–15 scenes (schema below). No modern state borders for pre-modern events: rivers, lakes, mountains, deserts and schematic historical regions only. Write the voice-over texts to `src/data/<topic>.vo.json` with numbers spelled out.

4. **Basemap.** `python3 tools/fetch_basemap.py xmin ymin xmax ymax` → `public/basemap.jpg`; paste the printed extent into the data file. Keep the attribution string on screen. Keep camera centres far enough from the extent edges that the frame never shows past the raster (at scale ≥ 2100 the frame spans about 60° of longitude).

5. **Fonts.** Put a display font that covers the film's alphabet into `public/fonts/` and list it in `src/theme.ts` (`FONT_FILES`). Check coverage (e.g. Kazakh ә ғ қ ң ө ұ ү һ і) with fontTools before rendering.

6. **Voice-over.** `ELEVENLABS_API_KEY=… ELEVENLABS_VOICE_ID=… python3 tools/tts_elevenlabs.py src/data/<topic>.vo.json` (default model `eleven_v4`, `VO_LANG=kk`, stability 0.65, similarity 1.0). Each scene stretches to `max(storyboard duration, voice + 1.2 s)` and its layer timings scale with it. Run `tools/check_vo.py <lang>` (local Whisper large-v3 via mlx-whisper or faster-whisper) and fix texts the voice mispronounces. Ask the user for the voice ID — a key without `voices_read` cannot list voices.

7. **Check, then render.** `npm run studio` to scrub; `python3 tools/storyboard.py` for 0.5 s frame sheets; look for labels that overlap, white text on light map without a dark plate, and empty strips at the frame edge. Then `npm run render` and `tools/finish.sh out/film.mp4 out/film_final.mp4` (−14 LUFS).

8. **Promo (optional).** `ffmpeg -ss 37 -to 61 -i out/film_final.mp4 public/promo_clip.mp4`, edit the texts in `PROMO_DEFAULTS` (`src/Promo.tsx`), `npm run promo`.

Deliver the video, the source list and the list of disputed facts.

## Scene schema

```js
{ id: 'seven', title: 'Жеті бағыт', dur: 14,          // seconds before voice-over stretching
  cam: [[0, lon, lat, scale], [14, lon, lat, scale]],  // keyframes; scale ~700 (wide) … 7000 (city)
  noBadges: false,                                      // hide faction badges in this scene
  layers: [ … ] }
```

All `t0`/`t1` are seconds inside the scene; `t1` omitted = stays until the end.

| type | fields | draws |
|---|---|---|
| `region` | `key` (in `geo.regions`), `color`, `op`, `t0`, `t1`, `label`, `labelAt`, `to: [t, color]`, `split: t` | filled region, colour change, dashed split |
| `arrow` | `pts: [[lon,lat]…]`, `t0`, `d` (draw time), `t1`, `color`, `w`, `dash`, `label`, `lx/ly`, `anchor` | spline arrow drawn along its track |
| `stream` | `pts`, `t0`, `d`, `label`, `lf` (label position 0–1) | moving dotted flow (refugees, trade) |
| `swarm` | `at`, `t0`, `n`, `spread`, `seed` | cluster of dots (an army) |
| `city` | `name` (in `geo.cities`), `t0`, `changes: [[t, color]]`, `tags: [[t, text]]`, `anchor` | diamond + name plate, changes colour |
| `ring` | `at`, `t0`, `color` | three expanding strike rings |
| `measure` | `a`, `b`, `t0`, `d` | dashed ruler with a live "≈ N КМ" count |
| `label` | `text`, `at` or `xy` (screen px), `size`, `color`, `t0`, `t1` | map label; `xy` labels go to the overlay |
| `year` | `text`, `t0`, `t1` | overlay: year counts up to `text` |
| `title` | `text`, `sub`, `t0`, `t1`, `size`, `y`, `band`, `hl` | overlay: kinetic title, `hl` = accent plate |
| `card` | `text` ("head · rest"), `sub`, `t0`, `t1` | overlay: dark glass card with accent bar |
| `people` | `t0` | overlay: 10 figures, 4 turn red, estimate bars (edit `People` in MapFilm.tsx) |
| `desat` | `t0` | map fades to grey (finale) |

## Gotchas

- The basemap is a separate `<Img>` under the SVG; an `<image>` rebuilt inside the SVG every frame flickers.
- Never call a React hook after an early `return` in overlay components (Remotion fails mid-render with a hooks error).
- Chrome headless can fail under non-ASCII project paths: see `remotion.config.ts`.
- Overlay texts go through the `title`/`card`/`year`/`xy`-label layers; anything drawn in the SVG uses `FONT` too, but small map labels stay small — give them dark plates on light maps.
