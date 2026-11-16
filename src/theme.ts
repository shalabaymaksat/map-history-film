import {Easing} from 'remotion';

export const W = 1920;
export const H = 1080;

/** Accent palette of the type overlay (not the map). */
export const C = {
  white: '#FFFFFF',
  lime: '#D8F868',
  red: '#E80820',
  dark: '#101010',
  ink: '#141414',
};

/** Font family name registered in Root.tsx from public/fonts (see FONT_FILES). */
export const FONT = 'Display';
/** Drop your own .ttf/.otf files into public/fonts and list them here. Must cover your language's letters. */
export const FONT_FILES: [string, number][] = [
  ['Display-Regular.ttf', 400],
  ['Display-Bold.ttf', 700],
  ['Display-ExtraBold.ttf', 800],
  ['Display-Black.ttf', 900],
];

// Enter ~0.5 s with a light overshoot, exit faster with ease-in; nothing ever stands fully still.
export const SPRING = {damping: 14, stiffness: 170, mass: 0.9};
export const EASE_IN = Easing.in(Easing.cubic);
export const TEXT_SHADOW = '0 3px 18px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.35)';
