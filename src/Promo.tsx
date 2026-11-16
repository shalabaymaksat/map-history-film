import React from 'react';
import {AbsoluteFill, interpolate, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {FONT, SPRING} from './theme';

/* Promo frame: headline with an icon tile, a clip of the film in a rounded card, comment call-to-action below.
   Canvas 1400×1120 (5:4). Cut the clip first: ffmpeg -ss 37 -to 61 -i out/film.mp4 public/promo_clip.mp4 */

export const PR_W = 1400;
export const PR_H = 1120;
export const PR_FPS = 30;

const ORANGE = '#E8673C';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const useIn = (delay: number) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: frame - Math.round(delay * fps), fps, config: SPRING, durationInFrames: 18});
};
const rise = (s: number, dy = 30): React.CSSProperties => ({
  opacity: Math.min(1, s * 1.6),
  filter: `blur(${Math.max(0, (1 - Math.min(1, s)) * 10).toFixed(2)}px)`,
  transform: `translateY(${(1 - s) * dy}px) scale(${0.94 + 0.06 * s})`,
});

/* orange rounded tile with a white hand-drawn-looking starburst */
const Burst: React.FC<{size: number; spin?: number}> = ({size, spin = 0}) => {
  const rays = 11;
  return (
    <div style={{width: size, height: size, borderRadius: size * 0.24, background: `linear-gradient(160deg, #F07A4C 0%, ${ORANGE} 55%, #D9552B 100%)`,
      boxShadow: '0 10px 28px rgba(216,85,43,.35), inset 0 1px 0 rgba(255,255,255,.35)', display: 'grid', placeItems: 'center'}}>
      <svg width={size * 0.66} height={size * 0.66} viewBox="-50 -50 100 100" style={{transform: `rotate(${spin}deg)`}}>
        {Array.from({length: rays}, (_, i) => {
          const a = (i / rays) * Math.PI * 2;
          const r = i % 2 ? 40 : 46;
          return <line key={i} x1={Math.cos(a) * 7} y1={Math.sin(a) * 7} x2={Math.cos(a) * r} y2={Math.sin(a) * r} stroke="#fff" strokeWidth={6.5} strokeLinecap="round" />;
        })}
      </svg>
    </div>
  );
};

export type PromoProps = {headline: string; question: string; before: string; keyword: string; after: string; clip: string; seconds: number};
export const PROMO_DEFAULTS: PromoProps = {
  headline: 'Монтаж Claude', question: 'Осылай анимация жасауды үйренгің келе ме?',
  before: 'Комментке', keyword: '«клод»', after: 'деп жаз', clip: 'promo_clip.mp4', seconds: 24,
};

export const Promo: React.FC<PromoProps> = ({headline, question, before, keyword, after, clip}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const head = useIn(0.1);
  const card = useIn(0.35);
  const cta = useIn(1.2);
  const cta2 = useIn(1.55);
  // «клод» breathes every ~3 s so the eye lands on it
  const pulse = 1 + 0.06 * Math.max(0, Math.sin(((frame / fps - 2) / 3) * Math.PI * 2)) ** 6;
  const spin = interpolate(frame, [0, PR_FPS * 24], [0, 40], clamp);
  return (
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 35%, #FAFAFD 0%, #EEEEF4 70%, #E7E7EF 100%)', fontFamily: FONT}}>
      {/* header */}
      <div style={{position: 'absolute', top: 84, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 28, ...rise(head)}}>
        <Burst size={94} spin={spin} />
        <div style={{fontSize: 86, fontWeight: 900, color: '#111', letterSpacing: '-0.035em', lineHeight: 1}}>{headline}</div>
      </div>

      {/* video card */}
      <div style={{position: 'absolute', left: 58, top: 206, width: 1284, height: 682, borderRadius: 30, background: '#fff', padding: 6,
        boxShadow: '0 24px 60px rgba(30,30,60,.14), 0 2px 8px rgba(30,30,60,.06)', ...rise(card, 40)}}>
        <div style={{width: '100%', height: '100%', borderRadius: 25, overflow: 'hidden', background: '#e0d9b8'}}>
          <OffthreadVideo src={staticFile(clip)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
        </div>
      </div>

      {/* comment CTA */}
      <div style={{position: 'absolute', left: 287, top: 920, width: 828, height: 132, borderRadius: 30, background: 'rgba(255,255,255,.92)',
        boxShadow: '0 18px 44px rgba(30,30,60,.12)', display: 'flex', alignItems: 'center', gap: 26, padding: '0 22px', ...rise(cta, 36)}}>
        <Burst size={98} spin={-spin} />
        <div style={{display: 'grid', gap: 8}}>
          <div style={{fontSize: 30, fontWeight: 800, color: '#111', letterSpacing: '-0.025em', whiteSpace: 'nowrap'}}>{question}</div>
          <div style={{fontSize: 31, fontWeight: 400, color: '#6b6b72', whiteSpace: 'nowrap', letterSpacing: '-0.01em', ...rise(cta2, 14)}}>
            {before}{' '}
            <span style={{display: 'inline-block', color: ORANGE, fontWeight: 900, transform: `scale(${pulse})`, transformOrigin: '50% 60%'}}>{keyword}</span>
            {' '}{after}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
