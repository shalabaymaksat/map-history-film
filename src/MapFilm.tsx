import React, {useLayoutEffect, useRef} from 'react';
import {AbsoluteFill, Audio, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
// @ts-ignore — plain JS renderer
import {H as MH, OPTS, W as MW, camAt, configure, projFor, render} from './engine/render';
// @ts-ignore — swap this import to make a film about another topic
import * as DATA from './data/aktaban';
import vo from './vo.json';
import {C, EASE_IN, FONT, SPRING, TEXT_SHADOW} from './theme';

/* Map film: storyboard map (SVG, 1600×900 scaled to 1920×1080) + animated type overlay + voice-over.
   Each scene is stretched to fit its voice-over; the storyboard's own timings are scaled with it. */

export const FILM_FPS = 30;
const VO_LEAD = 0.3; // seconds of picture before the voice starts
const TAIL = 0.9;
const K = 1920 / MW; // storyboard px → video px
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const RASTER = staticFile('basemap.jpg');
OPTS.raster = RASTER;
configure({colors: DATA.colors, geo: DATA.geo, scenes: DATA.scenes, dates: DATA.dates, badges: DATA.badges, extent: DATA.extent, attribution: DATA.attribution, font: `${FONT}, "Helvetica Neue", Arial, sans-serif`});
const S = DATA.scenes;
const DATES: string[] = DATA.dates;
const EXT = DATA.extent;

type Scene = {id: string; title: string; dur: number; cam: number[][]; layers: any[]};
const SC: Scene[] = S;
export const TIMELINE = SC.map((s, i) => {
  const v = (vo as any[])[i];
  const real = v && v.file ? Math.max(s.dur, v.dur + VO_LEAD + TAIL) : s.dur;
  return {s, i, real, scale: real / s.dur, frames: Math.round(real * FILM_FPS)};
});
let acc = 0;
const STARTS = TIMELINE.map((x) => {
  const f = acc;
  acc += x.frames;
  return f;
});
export const FILM_DURATION = acc;

/* ---------- map ---------- */
const MapLayer: React.FC<{s: Scene; t: number}> = ({s, t}) => {
  const ref = useRef<SVGSVGElement>(null);
  useLayoutEffect(() => {
    if (ref.current) render(ref.current, s, t);
  }, [s, t]);
  const cam = camAt(s.cam, t);
  const P = projFor(cam);
  const nw = P([EXT.xmin, EXT.ymax]);
  const se = P([EXT.xmax, EXT.ymin]);
  const desat = s.layers.find((l) => l.type === 'desat');
  const d = desat ? Math.max(0, Math.min(1, (t - desat.t0) / 2)) : 0;
  return (
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, #f3efda 0%, #e0d9b8 100%)', overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: MW, height: MH, transform: `scale(${K})`, transformOrigin: '0 0'}}>
        <Img
          src={RASTER}
          style={{
            position: 'absolute', left: nw[0], top: nw[1], width: se[0] - nw[0], height: se[1] - nw[1],
            filter: `sepia(.5) saturate(.65) contrast(1.08) grayscale(${d * 0.85}) brightness(${1 - d * 0.12})`,
          }}
        />
        <svg ref={ref} viewBox={`0 0 ${MW} ${MH}`} width={MW} height={MH} style={{position: 'absolute', inset: 0}} />
      </div>
    </AbsoluteFill>
  );
};

/* ---------- type system: spring rise with blur in, quick ease-in out, never fully still ---------- */
const useLife = (from: number, to: number | null, scale: number) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const f0 = Math.round(from * scale * fps);
  const f1 = to == null ? Infinity : Math.round(to * scale * fps);
  if (frame < f0 || frame > f1 + 18) return null;
  const s = spring({frame: frame - f0, fps, config: SPRING, durationInFrames: 15});
  const out = to == null ? 0 : interpolate(frame, [f1, f1 + 9], [0, 1], {...clamp, easing: EASE_IN});
  const hold = interpolate(frame, [f0 + 15, f0 + 15 + fps * 6], [0, 1], clamp);
  return {s, out, drift: 1 + 0.02 * hold, local: frame - f0};
};
const lifeStyle = (L: {s: number; out: number; drift: number}, variant: 'rise' | 'pop' = 'rise'): React.CSSProperties => {
  const opacity = Math.min(1, L.s * 1.6) * (1 - L.out);
  const blur = Math.max(0, (1 - Math.min(1, L.s)) * 12) + L.out * 8;
  const ty = variant === 'rise' ? (1 - L.s) * 34 - L.out * 14 : -L.out * 10;
  const sc = (variant === 'pop' ? Math.max(0.001, L.s) : 0.94 + 0.06 * L.s) * L.drift * (1 - 0.06 * L.out);
  return {opacity, filter: `blur(${blur.toFixed(2)}px)`, transform: `translateY(${ty}px) scale(${sc})`};
};
const T: React.FC<{size: number; weight?: number; color?: string; tracking?: number; style?: React.CSSProperties; children: React.ReactNode}> = ({
  size, weight = 900, color = C.white, tracking = -0.02, style, children,
}) => (
  <div style={{fontFamily: FONT, fontSize: size, fontWeight: weight, color, letterSpacing: `${tracking}em`, lineHeight: 1.05, textShadow: TEXT_SHADOW, ...style}}>
    {children}
  </div>
);
const Pos: React.FC<{x: number; y: number; anchor?: 'start' | 'middle' | 'end'; children: React.ReactNode}> = ({x, y, anchor = 'middle', children}) => (
  <div style={{position: 'absolute', left: x, top: y, transform: `translate(${anchor === 'middle' ? '-50%' : anchor === 'end' ? '-100%' : '0'}, -50%)`, whiteSpace: 'nowrap', textAlign: anchor === 'end' ? 'right' : anchor === 'start' ? 'left' : 'center'}}>
    {children}
  </div>
);

const Year: React.FC<{l: any; scale: number}> = ({l, scale}) => {
  const L = useLife(l.t0, l.t1, scale);
  const {fps} = useVideoConfig();
  if (!L) return null;
  const v = Math.round(interpolate(L.local, [0, fps * 1.1], [1700, +l.text], {...clamp, easing: (x) => 1 - Math.pow(1 - x, 3)}));
  return (
    <AbsoluteFill style={{background: `rgba(16,16,16,${0.55 * (1 - L.out) * Math.min(1, L.s)})`}}>
      <Pos x={960} y={520}>
        <div style={lifeStyle(L, 'pop')}>
          <T size={330} tracking={-0.04}>{v}</T>
          <div style={{height: 10, width: 300 * Math.min(1, L.s), background: C.lime, margin: '10px auto 0', borderRadius: 5}} />
        </div>
      </Pos>
    </AbsoluteFill>
  );
};

const Title: React.FC<{l: any; scale: number}> = ({l, scale}) => {
  const L = useLife(l.t0, l.t1 ?? null, scale);
  const L2 = useLife(l.t0 + 0.5, l.t1 ?? null, scale);
  if (!L) return null;
  const y = (l.y || MH / 2) * K;
  const size = (l.size || 120) * K * 1.02;
  return (
    <>
      {l.band && <AbsoluteFill style={{background: `rgba(16,16,16,${0.62 * Math.min(1, L.s) * (1 - L.out)})`}} />}
      <Pos x={960} y={y - size * 0.32}>
        <div style={lifeStyle(L)}>
          <T size={size} color={l.hl ? C.ink : C.white} style={l.hl ? {background: C.lime, padding: '6px 28px 10px', borderRadius: 10, textShadow: 'none'} : {}}>
            {l.text}
          </T>
        </div>
      </Pos>
      {l.sub && L2 && (
        <Pos x={960} y={y + size * 0.5}>
          <div style={lifeStyle(L2)}>
            <T size={40} weight={700} color={C.lime} tracking={0.01}>{l.sub}</T>
          </div>
        </Pos>
      )}
    </>
  );
};

const Card: React.FC<{l: any; scale: number}> = ({l, scale}) => {
  const L = useLife(l.t0, l.t1 ?? null, scale);
  const L2 = useLife(l.t0 + 0.35, l.t1 ?? null, scale);
  if (!L) return null;
  const [head, ...rest] = String(l.text).split(' · ');
  return (
    <div style={{position: 'absolute', left: 84, bottom: 150, ...lifeStyle(L)}}>
      <div style={{position: 'relative', padding: '22px 34px 24px 38px', borderRadius: 18, background: 'rgba(20,20,20,0.82)', border: '1px solid rgba(255,255,255,0.22)', boxShadow: '0 12px 40px rgba(0,0,0,.4)'}}>
        <div style={{position: 'absolute', left: 0, top: 20, bottom: 20, width: 6, background: C.lime, borderRadius: 3}} />
        <T size={50} weight={800} tracking={-0.01}>
          {rest.length ? <><span style={{color: C.lime}}>{head}</span> · {rest.join(' · ')}</> : head}
        </T>
        {l.sub && L2 && (
          <div style={{marginTop: 12, opacity: Math.min(1, L2.s * 1.6) * (1 - L2.out), transform: `translateX(${(1 - Math.min(1, L2.s)) * -12}px)`}}>
            <T size={28} weight={700} color={C.lime} tracking={0.02}>{l.sub}</T>
          </div>
        )}
      </div>
    </div>
  );
};

const Corner: React.FC<{l: any; scale: number}> = ({l, scale}) => {
  const L = useLife(l.t0, l.t1 ?? null, scale);
  if (!L) return null;
  const big = l.size > 50;
  return (
    <Pos x={l.xy[0] * K} y={l.xy[1] * K - (big ? 30 : 0)} anchor={l.anchor || 'middle'}>
      <div style={lifeStyle(L, big ? 'pop' : 'rise')}>
        <T size={big ? 120 : 30} weight={big ? 900 : 700} color={big ? C.white : l.color === '#e7dfc8' ? C.white : C.lime} tracking={big ? -0.03 : 0.01}
          style={big ? {} : {background: 'rgba(20,20,20,0.82)', borderRadius: 8, padding: '6px 14px 8px', display: 'inline-block'}}>
          {big ? <><span style={{color: C.lime}}>{String(l.text).split(' ')[0]}</span> {String(l.text).split(' ').slice(1).join(' ')}</> : l.text}
        </T>
      </div>
    </Pos>
  );
};

const Person: React.FC<{color: string}> = ({color}) => (
  <svg width={92} height={150} viewBox="0 0 92 150">
    <circle cx={46} cy={30} r={26} fill={color} />
    <path d="M6 150 Q6 64 46 64 Q86 64 86 150 Z" fill={color} />
  </svg>
);

const People: React.FC<{l: any; scale: number}> = ({l, scale}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const L = useLife(l.t0, l.t1 ?? null, scale);
  const Lq = useLife(l.t0 + 3.4, null, scale);
  const Lf = useLife(l.t0 + 6.6, null, scale);
  if (!L) return null;
  const at = (s: number) => Math.round((l.t0 + s) * scale * fps);
  const bars: [string, number, number][] = [['Қадырбаев', 1 / 3, 5.2], ['Кейбір бағалау', 2 / 3, 6.0]];
  return (
    <AbsoluteFill style={{background: `rgba(16,16,16,${0.84 * Math.min(1, L.s)})`}}>
      <Pos x={960} y={170}>
        <div style={lifeStyle(L)}><T size={76}>ӘР ОН АДАМНЫҢ<span style={{color: C.red}}> ТӨРТЕУІ</span></T></div>
      </Pos>
      <div style={{position: 'absolute', left: 960, top: 300, transform: 'translateX(-50%)', display: 'flex', gap: 26}}>
        {Array.from({length: 10}, (_, i) => {
          const p = spring({frame: frame - at(i * 0.06), fps, config: SPRING, durationInFrames: 15});
          const red = i < 4 && frame >= at(1.2 + i * 0.45);
          const pr = red ? spring({frame: frame - at(1.2 + i * 0.45), fps, config: SPRING, durationInFrames: 12}) : 0;
          return (
            <div key={i} style={{opacity: Math.min(1, p * 1.6), transform: `translateY(${(1 - p) * 30}px) scale(${1 + 0.08 * Math.sin(Math.PI * Math.min(1, pr))})`}}>
              <Person color={red ? C.red : '#EDE6D2'} />
            </div>
          );
        })}
      </div>
      {Lq && (
        <Pos x={960} y={530}>
          <div style={lifeStyle(Lq)}><T size={40} weight={700} color={C.white} tracking={0}>«Оннан төртеуі қырылды» <span style={{color: C.lime}}>— Абылай ханға телінген сөз</span></T></div>
        </Pos>
      )}
      {bars.map(([lab, v, tb], i) => {
        const f0 = at(tb);
        if (frame < f0) return null;
        const g = interpolate(frame, [f0, f0 + fps * 0.9], [0, 1], {...clamp, easing: (x) => 1 - Math.pow(1 - x, 3)});
        const y = 640 + i * 120;
        return (
          <div key={i} style={{position: 'absolute', left: 360, top: y, width: 1200, opacity: Math.min(1, g * 3)}}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 12}}>
              <T size={32} weight={700} tracking={0}>{lab}</T>
              <T size={40} color={C.lime}>≈ {Math.round(v * 100 * g)}%</T>
            </div>
            <div style={{height: 34, borderRadius: 17, background: 'rgba(255,255,255,0.12)', overflow: 'hidden'}}>
              <div style={{height: '100%', width: `${v * 100 * g}%`, background: i ? '#9E0B1A' : C.red, borderRadius: 17}} />
            </div>
          </div>
        );
      })}
      {Lf && (
        <Pos x={960} y={1010}>
          <div style={lifeStyle(Lf)}><T size={24} weight={400} color="rgba(255,255,255,.7)" tracking={0.02}>Бағалаулар даулы · Сабитов: шығын асыра көрсетілген, ≈1/3 шындыққа жақын</T></div>
        </Pos>
      )}
    </AbsoluteFill>
  );
};

/* lower chapter chip, hidden while a full-screen card is up */
const Chip: React.FC<{i: number; s: Scene; t: number; scale: number}> = ({i, s, t, scale}) => {
  const L = useLife(0.15, null, scale);
  const busy = s.layers.some((l) => ['title', 'people', 'year'].includes(l.type) && t > l.t0 - 0.2 && (l.t1 == null || t < l.t1 + 0.3));
  if (!L || busy) return null;
  return (
    <div style={{position: 'absolute', left: 84, bottom: 64, display: 'flex', alignItems: 'center', gap: 18, ...lifeStyle(L)}}>
      <div style={{background: C.lime, borderRadius: 10, padding: '8px 16px 10px'}}>
        <T size={30} color={C.ink} tracking={0} style={{textShadow: 'none'}}>{DATES[i]}</T>
      </div>
      <div style={{background: 'rgba(20,20,20,0.82)', borderRadius: 10, padding: '8px 18px 10px'}}>
        <T size={30} weight={800} tracking={0.04}>{s.title.toUpperCase()}</T>
      </div>
    </div>
  );
};

const SceneView: React.FC<{i: number}> = ({i}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {s, scale} = TIMELINE[i];
  const t = Math.min(s.dur, frame / fps / scale);
  const L = s.layers;
  return (
    <AbsoluteFill>
      <MapLayer s={s} t={t} />
      {L.filter((l) => l.type === 'year').map((l, k) => <Year key={'y' + k} l={l} scale={scale} />)}
      {L.filter((l) => l.type === 'title').map((l, k) => <Title key={'t' + k} l={l} scale={scale} />)}
      {L.filter((l) => l.type === 'card').map((l, k) => <Card key={'c' + k} l={l} scale={scale} />)}
      {L.filter((l) => l.type === 'label' && l.xy).map((l, k) => <Corner key={'l' + k} l={l} scale={scale} />)}
      {L.filter((l) => l.type === 'people').map((l, k) => <People key={'p' + k} l={l} scale={scale} />)}
      <Chip i={i} s={s} t={t} scale={scale} />
      {(vo as any[])[i]?.file && (
        <Sequence from={Math.round(VO_LEAD * fps)} layout="none">
          <Audio src={staticFile((vo as any[])[i].file)} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};

export const MapFilm: React.FC = () => (
  <AbsoluteFill style={{background: '#e0d9b8'}}>
    {TIMELINE.map((x, i) => (
      <Sequence key={i} from={STARTS[i]} durationInFrames={x.frames} name={`${i + 1} · ${x.s.title}`}>
        <SceneView i={i} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
