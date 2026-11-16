import React from 'react';
import {Composition, continueRender, delayRender, staticFile} from 'remotion';
import {FILM_DURATION, FILM_FPS, MapFilm} from './MapFilm';
import {PR_FPS, PR_H, PR_W, Promo, PROMO_DEFAULTS} from './Promo';
import {FONT, FONT_FILES, H, W} from './theme';

// Fonts must be loaded before the first frame (a fallback face would be baked into the video).
// Missing files are skipped, so the project still renders with the system fallback.
const fontHandle = delayRender('fonts');
Promise.all(
  FONT_FILES.map(([file, weight]) =>
    new FontFace(FONT, `url(${staticFile(`fonts/${file}`)})`, {weight: String(weight)})
      .load()
      .then((f) => document.fonts.add(f))
      .catch(() => console.warn(`font not found: public/fonts/${file}`)),
  ),
).then(() => continueRender(fontHandle));

export const Root: React.FC = () => (
  <>
    <Composition id="MapFilm" component={MapFilm} durationInFrames={FILM_DURATION} fps={FILM_FPS} width={W} height={H} />
    <Composition id="Promo" component={Promo} durationInFrames={PROMO_DEFAULTS.seconds * PR_FPS} fps={PR_FPS} width={PR_W} height={PR_H} defaultProps={PROMO_DEFAULTS} />
  </>
);
