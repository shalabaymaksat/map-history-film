import * as d3 from 'd3';
/* Map-film renderer: draws one scene of a map storyboard at time t into an <svg> (viewBox 1600×900).
   All geography, colours and scenes come from a data module passed to configure(). */
export const OPTS = { react: true, raster: '' };
const W = 1600, H = 900;
let C = {}, G = { regions: {}, cities: {}, waterLabels: [] }, S = [], DATES = [], BADGES = [], ATTRIB = '';
let EXTENT = { xmin: 40, ymin: 24.49, xmax: 110, ymax: 65.51 };
let FONT = 'Display, "Helvetica Neue", Arial, sans-serif';

/** data: { colors, geo, scenes, dates?, badges?, extent, attribution?, font? } */
export function configure(data) {
  C = data.colors; G = data.geo; S = data.scenes; DATES = data.dates || [];
  BADGES = data.badges || []; EXTENT = data.extent; ATTRIB = data.attribution || '';
  if (data.font) FONT = data.font;
}

/* ---------- helpers ---------- */
const ease = x => x < 0 ? 0 : x > 1 ? 1 : x < .5 ? 4*x*x*x : 1 - Math.pow(-2*x + 2, 3) / 2;
const clamp01 = x => Math.max(0, Math.min(1, x));
const lerp = (a, b, x) => a + (b - a) * x;
const fade = (t, t0, t1, f = 0.4) => clamp01((t - t0) / f) * (t1 == null ? 1 : clamp01((t1 - t) / f));
const NS = 'http://www.w3.org/2000/svg';
let uid = 0;
function el(parent, name, attrs, text) {
  // Typography-only revision: preserve all original shapes, timing and motion.
  attrs={...attrs};
  if(name==='text'){
    const wasOutlined=attrs.stroke && +attrs['stroke-width']>0;
    const darkPlate=Array.from(parent.children).some(n=>n.tagName==='rect' && ['#242a25','#232923','#0e0f0c'].includes(n.getAttribute('fill')));
    if(wasOutlined && !darkPlate) attrs.fill='#1d1d1f';
    attrs['font-family']=FONT;
    attrs['font-weight']=Math.min(600,attrs['font-weight']||400);
    attrs['font-style']='normal';attrs['letter-spacing']=0;
    const hex=String(attrs.fill||'#1d1d1f').replace('#','');
    const rgb=hex.length===3?hex.split('').map(c=>parseInt(c+c,16)):[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)||0);
    const light=(rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722)>155;
    attrs.stroke=light?'rgba(0,0,0,0.16)':'rgba(255,255,255,0.48)';
    attrs['stroke-width']=Math.min(1.5,Math.max(.65,(+attrs['font-size']||20)*.018));
    attrs['stroke-linejoin']='round';attrs['paint-order']='stroke fill';
    attrs.style=(attrs.style||'')+(light?';filter:drop-shadow(0px 1px 1.5px rgba(0,0,0,0.16))':';filter:drop-shadow(0px 1px 1px rgba(255,255,255,0.26))');
    // Keep the new, wider system face within the original title and card widths.
    const size=+attrs['font-size']||20;
    const ctx=document.createElement('canvas').getContext('2d');
    ctx.font=`${attrs['font-weight']} ${size}px ${FONT}`;
    const measured=ctx.measureText(String(text||'')).width;
    let available=size>65?1440:Infinity;
    for(const r of parent.children){
      if(r.tagName!=='rect')continue;
      const x=+r.getAttribute('x'),y=+r.getAttribute('y'),w=+r.getAttribute('width'),h=+r.getAttribute('height');
      if(w>300 && +attrs.x>=x && +attrs.x<x+w && +attrs.y>y && +attrs.y<y+h && attrs['text-anchor']!=='middle')available=Math.min(available,x+w-(+attrs.x)-20);
    }
    if(measured>available)attrs['font-size']=Math.max(14,size*available/measured);
  }
  const e = document.createElementNS(NS, name);
  for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
  if (text != null) e.textContent = text;
  parent.appendChild(e); return e;
}
function catmull(pts, seg = 10) {        // smooth polyline through screen points
  if (pts.length < 3) return pts;
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    for (let s = 0; s < seg; s++) {
      const t = s / seg, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(k => .5 * (2*p1[k] + (-p0[k] + p2[k]) * t + (2*p0[k] - 5*p1[k] + 4*p2[k] - p3[k]) * t2 + (-p0[k] + 3*p1[k] - 3*p2[k] + p3[k]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]); return out;
}
function truncate(pts, f) {               // first fraction f of a polyline, by length
  if (f >= 1) return pts;
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i-1] + Math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1]));
  const tgt = L[L.length - 1] * Math.max(0, f), out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (L[i] >= tgt) { const r = (tgt - L[i-1]) / ((L[i] - L[i-1]) || 1); out.push([lerp(pts[i-1][0], pts[i][0], r), lerp(pts[i-1][1], pts[i][1], r)]); return out; }
    out.push(pts[i]);
  }
  return out;
}
const dstr = pts => 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L');
function camAt(cam, t) {
  if (t <= cam[0][0]) return cam[0];
  for (let i = 1; i < cam.length; i++) if (t <= cam[i][0]) {
    const a = cam[i-1], b = cam[i], x = ease((t - a[0]) / (b[0] - a[0]));
    return [t, lerp(a[1], b[1], x), lerp(a[2], b[2], x), Math.exp(lerp(Math.log(a[3]), Math.log(b[3]), x))];
  }
  return cam[cam.length - 1];
}
function projFor(c) {
  return d3.geoProjection((lambda,phi)=>[lambda*.72,phi]).rotate([-c[1], 0]).center([0, c[2]]).scale(Math.max(2100,c[3])).translate([W/2, H/2]).clipExtent([[-200,-200],[W+200,H+200]]);
}

const PAPER=(()=>{const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d'),im=x.createImageData(256,256);let n=18;for(let i=0;i<im.data.length;i+=4){n=(1664525*n+1013904223)>>>0;const v=100+(n>>>24)*.6;im.data[i]=im.data[i+1]=im.data[i+2]=v;im.data[i+3]=255;}x.putImageData(im,0,0);return c.toDataURL();})();

/* ---------- renderer: draws scene `s` at time t into svg ---------- */
function render(svg, s, t) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const cam = camAt(s.cam, t), P = projFor(cam), path = d3.geoPath(P), k = cam[3];
  const poly = c => {                     // d3 wants clockwise outer rings; flip a ring that came out inside-out
    const detailed=[];
    for(let j=0;j<c.length;j++){
      const a=c[j],b=c[(j+1)%c.length],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),n=Math.max(3,Math.ceil(len*16));
      for(let z=0;z<n;z++){const f=z/n,x=a[0]+dx*f,y=a[1]+dy*f;
        const noise=(Math.sin(x*41+y*17)+Math.sin(x*79-y*32)*.45)*.045*Math.sin(Math.PI*f);
        detailed.push([x-dy/len*noise,y+dx/len*noise]);}
    }
    const g = { type: 'Polygon', coordinates: [detailed.concat([detailed[0]])] };
    if (d3.geoArea(g) > 2 * Math.PI) g.coordinates[0] = g.coordinates[0].slice().reverse();
    return g;
  };
  const pp = ll => P(ll);
  const id = ++uid;
  const defs = el(svg, 'defs');
  const pat=el(defs,'pattern',{id:'paper'+id,width:256,height:256,patternUnits:'userSpaceOnUse'});
  el(pat,'image',{href:PAPER,width:256,height:256});
  const grad = el(defs, 'radialGradient', { id: 'g' + id, cx: '50%', cy: '45%', r: '75%' });
  el(grad, 'stop', { offset: '0%', 'stop-color': '#f3efda' }); el(grad, 'stop', { offset: '100%', 'stop-color': '#e0d9b8' });
  const desat = s.layers.find(l => l.type === 'desat');
  const root = el(svg, 'g', desat ? { style: `filter: grayscale(${clamp01((t - desat.t0) / 2) * .85}) brightness(${1 - clamp01((t - desat.t0) / 2) * .12})` } : {});
  if (!OPTS.react) el(root, 'rect', { width: W, height: H, fill: `url(#g${id})` });

  // Esri World Physical Map raster in EPSG:4326, registered to its exact export extent.
  const nw=pp([EXTENT.xmin,EXTENT.ymax]),se=pp([EXTENT.xmax,EXTENT.ymin]);
  if (!OPTS.react) el(root,'image',{href:OPTS.raster,x:nw[0],y:nw[1],width:se[0]-nw[0],height:se[1]-nw[1],preserveAspectRatio:'none',style:'filter:sepia(.5) saturate(.65) contrast(1.08)'});

  // political fills (scene-driven)
  const fills = el(root, 'g');
  for (const l of s.layers.filter(l => l.type === 'region')) {
    const o = fade(t, l.t0, l.t1, l.f || .6); if (!o) continue;
    const coords = G.regions[l.key];
    let col = l.color; if (l.to && t > l.to[0]) col = d3.interpolateRgb(l.color, l.to[1])(clamp01((t - l.to[0]) / 1.2));
    const g = el(fills, 'g', { opacity: o });
    el(g, 'path', { d: path(poly(coords)), fill: col, 'fill-opacity': Math.min(.52,(l.op || .42) * .8), stroke: 'none', 'stroke-width': 2.8, 'stroke-opacity': .95, 'stroke-dasharray': l.split && t > l.split ? '10 8' : null });
    if (l.label) {
      const p=pp(l.labelAt), bw=Math.max(150,l.label.length*15);
      el(g,'rect',{x:p[0]-bw/2,y:p[1]-29,width:bw,height:39,fill:'#232923'});
      el(g,'text',{x:p[0],y:p[1],fill:'#fff9e9','font-family':FONT,'font-weight':800,'font-size':23,'letter-spacing':1.3,'text-anchor':'middle'},l.label);
    }
  }

  el(root,'rect',{width:W,height:H,fill:'url(#paper'+id+')',opacity:.075,'pointer-events':'none'});
  // Real hydrography is already in the raster; only geographic labels are added.
  const wg=el(root,'g');
  for(const [name,ll] of G.waterLabels){const p=pp(ll);el(wg,'text',{x:p[0],y:p[1],fill:'#405853','font-family':FONT,'font-size':18,'letter-spacing':5,'text-anchor':'middle'},name);}

  // scene layers
  const fx = el(root, 'g');
  for (const l of s.layers) {
    if (OPTS.react && (['year', 'title', 'card', 'people'].includes(l.type) || (l.type === 'label' && l.xy))) continue;
    if (l.type === 'arrow' || l.type === 'stream') {
      if (t < l.t0) continue;
      const o = l.t1 != null ? clamp01((l.t1 - t) / .5) : 1; if (!o) continue;
      const sp = catmull(l.pts.map(pp), 14), f = ease((t - l.t0) / (l.d || 1.4)), part = truncate(sp, f);
      const g = el(fx, 'g', { opacity: o });
      if (l.type === 'arrow') {
        el(g, 'path', { d: dstr(part), fill: 'none', stroke: l.color, 'stroke-width': (l.w || 5) + 10, 'stroke-opacity': .48, 'stroke-linecap': 'round' });
        el(g, 'path', { d: dstr(part), fill: 'none', stroke: '#fffbed', 'stroke-width': l.w || 5, 'stroke-linecap': 'round', 'stroke-dasharray': l.dash || null });
        const a = part[part.length - 1], b = part[Math.max(0, part.length - 4)], ang = Math.atan2(a[1] - b[1], a[0] - b[0]), s2 = (l.w || 5) * 3.6;
        el(g, 'path', { d: `M${a[0] + Math.cos(ang)*s2*.6},${a[1] + Math.sin(ang)*s2*.6}L${a[0] + Math.cos(ang + 2.5)*s2},${a[1] + Math.sin(ang + 2.5)*s2}L${a[0] + Math.cos(ang - 2.5)*s2},${a[1] + Math.sin(ang - 2.5)*s2}Z`, fill: '#fffbed' });
        if (l.label && f > .85) el(g, 'text', { x: a[0] + (l.lx || 14), y: a[1] + (l.ly || -12), stroke:'#f4efdc','stroke-width':4,'paint-order':'stroke',fill: l.color === C.dz ? '#8a2536' : '#234666', 'font-family': FONT, 'font-weight': 600, 'font-size': 20, 'letter-spacing': 1.5, 'text-anchor': l.anchor || 'start', opacity: clamp01((f - .85) / .15) }, l.label);
      } else {
        el(g, 'path', { d: dstr(part), fill: 'none', stroke: l.color || C.ref, 'stroke-width': l.w || 3, 'stroke-linecap': 'round', 'stroke-dasharray': '1 11', 'stroke-dashoffset': -(t * 30) });
        el(g, 'path', { d: dstr(part), fill: 'none', stroke: l.color || C.ref, 'stroke-width': (l.w || 3) * 4, 'stroke-opacity': .07, 'stroke-linecap': 'round' });
        // label sits part-way along the stream (lf), clear of the destination city's own label
        if (l.label && f > (l.lf || .9)) { const a = sp[Math.floor((sp.length - 1) * (l.lf || 1))]; el(g, 'text', { x: a[0] + (l.lx || 12), y: a[1] + (l.ly || 6), fill: '#f4efe2', 'font-family': FONT, 'font-size': 19, 'font-weight': 600, 'text-anchor': l.anchor || 'start', stroke: '#0e0f0c', 'stroke-width': 5, 'paint-order': 'stroke', opacity: clamp01((f - (l.lf || .9)) / .1) }, l.label); }
      }
    }
    else if (l.type === 'swarm') {
      const o = fade(t, l.t0, l.t1); if (!o) continue;
      const c = pp(l.at), r = new Uint32Array([l.seed || 7]);
      const rnd = () => { r[0] = r[0] * 1664525 + 1013904223; return r[0] / 4294967296; };
      const g = el(fx, 'g', { opacity: o });
      for (let i = 0; i < (l.n || 14); i++) { const a = rnd() * 6.28, d = Math.sqrt(rnd()) * (l.spread || 40), j = Math.sin(t * 3 + i) * 2;
        el(g, 'circle', { cx: c[0] + Math.cos(a) * d + j, cy: c[1] + Math.sin(a) * d, r: 3.4, fill: l.color || C.dz }); }
    }
    else if (l.type === 'ring') {
      if (t < l.t0) continue;
      const c = pp(l.at), dt = t - l.t0, g = el(fx, 'g');
      for (let i = 0; i < 3; i++) { const x = (dt * .9 - i * .22); if (x < 0 || x > 1) continue;
        el(g, 'circle', { cx: c[0], cy: c[1], r: 10 + x * 70, fill: 'none', stroke: l.color || '#fff', 'stroke-width': 3 * (1 - x), opacity: 1 - x }); }
      el(g, 'circle', { cx: c[0], cy: c[1], r: 12, fill: 'none', stroke: l.color || '#fff', 'stroke-width': 2.5, opacity: clamp01(dt / .3) * (l.t1 != null ? clamp01((l.t1 - t) / .4) : 1) });
    }
    else if (l.type === 'city') {
      const o = fade(t, l.t0, l.t1); if (!o) continue;
      let col = l.color || C.fg; for (const [tt, cc] of (l.changes || [])) if (t >= tt) col = cc;
      const p = pp(G.cities[l.name]), g = el(fx, 'g', { opacity: o });
      const tx=p[0]+(l.dx||14), ty=p[1]+(l.dy||7), tw=(l.label||l.name).length*(l.size||22)*.57+16;
      el(g,'rect',{x:l.anchor==='end'?tx-tw+5:tx-5,y:ty-(l.size||22)+2,width:tw,height:(l.size||22)+10,fill:'#242a25'});
      el(g, 'rect', { x: p[0] - 6, y: p[1] - 6, width: 12, height: 12, fill: col, transform: `rotate(45 ${p[0]} ${p[1]})` });
      el(g, 'text', { x: p[0] + (l.dx || 14), y: p[1] + (l.dy || 7), fill: '#fffbed', 'font-family': FONT, 'font-weight': 600, 'font-size': l.size || 25, 'text-anchor': l.anchor || 'start', stroke: '#0e0f0c', 'stroke-width': 5, 'paint-order': 'stroke' }, l.label || l.name);
      for (const [tt, txt] of (l.tags || [])) if (t >= tt) el(g, 'text', { x: p[0] + (l.dx || 14), y: p[1] + 30, fill: col, 'font-family': '"JetBrains Mono",monospace', 'font-size': 15, opacity: clamp01((t - tt) / .3), 'text-anchor': l.anchor || 'start' }, txt);
    }
    else if (l.type === 'label') {
      const o = fade(t, l.t0, l.t1); if (!o) continue;
      const p = l.xy || pp(l.at);
      el(fx, 'text', { x: p[0], y: p[1], fill: l.color || C.fg, opacity: o, 'font-family': FONT, 'font-weight': l.w || 800, 'font-size': l.size || 30, 'letter-spacing': l.ls || 3, 'text-anchor': l.anchor || 'middle',
        transform: l.rot ? `rotate(${l.rot} ${p[0]} ${p[1]})` : null, stroke: '#0e0f0c', 'stroke-width': l.halo ? 6 : 0, 'paint-order': 'stroke' }, l.text);
    }
    else if (l.type === 'measure') {
      if (t < l.t0) continue;
      const a = pp(l.a), b = pp(l.b), f = ease((t - l.t0) / (l.d || 1.4)), e = [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
      const o = l.t1 != null ? clamp01((l.t1 - t) / .4) : 1, g = el(fx, 'g', { opacity: o });
      const nx = -(b[1] - a[1]), ny = b[0] - a[0], nl = Math.hypot(nx, ny), ux = nx / nl * 14, uy = ny / nl * 14;
      el(g, 'line', { x1: a[0], y1: a[1], x2: e[0], y2: e[1], stroke: '#fff', 'stroke-width': 3, 'stroke-dasharray': '14 8' });
      el(g, 'line', { x1: a[0] - ux, y1: a[1] - uy, x2: a[0] + ux, y2: a[1] + uy, stroke: '#fff', 'stroke-width': 3 });
      if (f >= 1) el(g, 'line', { x1: b[0] - ux, y1: b[1] - uy, x2: b[0] + ux, y2: b[1] + uy, stroke: '#fff', 'stroke-width': 3 });
      const km = Math.round(d3.geoDistance(l.a, l.b) * 6371 * f / 10) * 10, mx = (a[0] + e[0]) / 2, my = (a[1] + e[1]) / 2, ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
      el(g, 'text', { x: mx, y: my - 18, fill: '#fff', 'font-family': FONT, 'font-weight': 800, 'font-size': 46, 'letter-spacing': 2, 'text-anchor': 'middle', transform: `rotate(${ang > 90 || ang < -90 ? ang + 180 : ang} ${mx} ${my})`, stroke: '#0e0f0c', 'stroke-width': 7, 'paint-order': 'stroke' }, '≈ ' + km.toLocaleString('ru-RU') + ' КМ');
    }
    else if (l.type === 'year') {
      const o = fade(t, l.t0, l.t1, .3); if (!o) continue;
      const sc = 1 + (t - l.t0) * .025;
      el(fx,'rect',{x:490,y:320,width:620,height:270,fill:'#20261f',opacity:o*.92});
      el(fx, 'text', { x: W/2, y: H/2 + 70, fill: '#fff', opacity: o, 'font-family': FONT, 'font-weight': 800, 'font-size': 260, 'letter-spacing': 8, 'text-anchor': 'middle', transform: `translate(${W/2} ${H/2}) scale(${sc}) translate(${-W/2} ${-H/2})` }, l.text);
    }
    else if (l.type === 'title') {
      if (t < l.t0 || (l.t1 != null && t > l.t1 + .4)) continue;
      const cid = 'c' + (++uid), f = ease((t - l.t0) / (l.d || .9)), o = l.t1 != null ? clamp01((l.t1 + .4 - t) / .4) : 1;
      const y = l.y || H/2, size = l.size || 120;
      const cp = el(defs, 'clipPath', { id: cid }); el(cp, 'rect', { x: 0, y: 0, width: W * f, height: H });
      const g = el(fx, 'g', { opacity: o });
      if (l.band) el(g, 'rect', { x: 0, y: y - size * .95, width: W, height: size * (l.sub ? 1.75 : 1.35), fill: l.band, opacity: .88 * f });
      const tg2 = el(g, 'g', { 'clip-path': `url(#${cid})` });
      if (l.hl) el(tg2, 'rect', { x: W/2 - l.hl / 2, y: y - size * .78, width: l.hl, height: size * .95, fill: C.hl });
      el(tg2, 'text', { x: W/2, y, fill: l.hl ? '#0e0f0c' : (l.band ? '#fff' : '#232923'), 'font-family': FONT, 'font-weight': 800, 'font-size': size, 'letter-spacing': 4, 'text-anchor': 'middle' }, l.text);
      if (l.sub) el(g, 'text', { x: W/2, y: y + size * .55, fill: l.band ? '#e7dfc8' : '#343d32', opacity: clamp01((t - l.t0 - .8) / .5), 'font-family': '"PT Serif",Georgia,serif', 'font-style': 'italic', 'font-size': 34, 'text-anchor': 'middle' }, l.sub);
    }
    else if (l.type === 'card') {
      const o = fade(t, l.t0, l.t1, .3); if (!o) continue;
      const x = l.x || 70, y = l.y || H - 190, w = l.w || 640, f = ease((t - l.t0 - .3) / .6);
      const g = el(fx, 'g', { opacity: o });
      el(g, 'rect', { x, y, width: w, height: l.sub ? 132 : 92, fill: '#f1ead6' });
      el(g, 'rect', { x: x + 24, y: y + 20, width: (l.hlw || 150) * f, height: 46, fill: C.hl });
      el(g, 'text', { x: x + 30, y: y + 56, fill: '#111', 'font-family': '"PT Serif",Georgia,serif', 'font-weight': 700, 'font-size': 38 }, l.text);
      if (l.sub) el(g, 'text', { x: x + 30, y: y + 104, fill: '#333', 'font-family': '"PT Serif",Georgia,serif', 'font-size': 25 }, l.sub);
    }
    else if (l.type === 'people') {
      const o = fade(t, l.t0, l.t1); if (!o) continue;
      const g = el(fx, 'g', { opacity: o });
      el(g, 'rect', { x: 0, y: 0, width: W, height: H, fill: '#0e0f0c', opacity: .78 });
      el(g, 'text', { x: W/2, y: 150, fill: '#fff', 'font-family': FONT, 'font-weight': 800, 'font-size': 52, 'letter-spacing': 4, 'text-anchor': 'middle' }, 'ӘР ОН АДАМНЫҢ…');
      for (let i = 0; i < 10; i++) {
        const x = 330 + i * 104, y = 360, red = i < 4 && t > l.t0 + 1.2 + i * .45;
        const col = red ? C.dz : '#e7dfc8', op = clamp01((t - l.t0 - i * .06) / .3);
        el(g, 'circle', { cx: x, cy: y - 62, r: 24, fill: col, opacity: op });
        el(g, 'path', { d: `M${x-34},${y+70}Q${x-34},${y-28} ${x},${y-28}Q${x+34},${y-28} ${x+34},${y+70}Z`, fill: col, opacity: op });
      }
      const q = clamp01((t - l.t0 - 3.4) / .5);
      el(g, 'text', { x: W/2, y: 520, fill: '#ff8a8f', opacity: q, 'font-family': '"PT Serif",Georgia,serif', 'font-size': 34, 'font-style': 'italic', 'text-anchor': 'middle' }, '«Оннан төртеуі қырылды» — Абылай ханға телінген сөз');
      // estimate bars
      const bars = [['Қадырбаев: ≈ 1/3', 1/3, 5.2], ['Кейбір бағалау: 2/3-ке дейін', 2/3, 6.0]];
      bars.forEach(([lab, v, tb], i) => {
        const y2 = 610 + i * 92, f = ease((t - l.t0 - tb) / .9); if (t < l.t0 + tb) return;
        el(g, 'text', { x: 330, y: y2 - 12, fill: '#cfc8b2', 'font-family': FONT, 'font-size': 26 }, lab);
        el(g, 'rect', { x: 330, y: y2, width: 940, height: 30, fill: '#2a2c22' });
        el(g, 'rect', { x: 330, y: y2, width: 940 * v * f, height: 30, fill: i ? '#8f1b20' : C.dz });
        el(g, 'rect', { x: 330 + 940 * v * f - 4, y: y2 - 6, width: 8, height: 42, fill: C.hl, opacity: f });
      });
      el(g, 'text', { x: W/2, y: 850, fill: '#9c977f', opacity: clamp01((t - l.t0 - 6.6) / .5), 'font-family': '"JetBrains Mono",monospace', 'font-size': 20, 'text-anchor': 'middle' }, 'Бағалаулар даулы · Сабитов: шығын асыра көрсетілген, ≈1/3 шындыққа жақын');
    }
  }
  // Reference-style editorial timeline and faction markers.
  const dates=DATES;
  const si=S.indexOf(s), titleCard=s.layers.some(l=>['title','people','year'].includes(l.type)&&t>l.t0&&(l.t1==null||t<l.t1));
  if(!titleCard && !s.noBadges){
    for(const {region:key,at:ll,mark,label,color:col} of BADGES){
      const layer=s.layers.find(l=>l.type==='region'&&l.key===key);
      if(!layer||t<layer.t0+.7)continue;
      const p=pp(ll); if(p[0]<90||p[0]>W-90||p[1]<100||p[1]>H-160)continue;
      if(layer.label)continue;
      const g=el(svg,'g',{opacity:fade(t,layer.t0+.5,layer.t1)});
      const points=Array.from({length:8},(_,j)=>{const a=Math.PI/8+j*Math.PI/4;return [p[0]+Math.cos(a)*42,p[1]+Math.sin(a)*42].join(',')}).join(' ');
      el(g,'polygon',{points,fill:col,stroke:'#fff9e9','stroke-width':5});
      el(g,'circle',{cx:p[0],cy:p[1],r:29,fill:'none',stroke:'#fff9e9','stroke-width':1.5});
      el(g,'text',{x:p[0],y:p[1]+14,fill:'#fff9e9','font-family':FONT,'font-size':39,'font-weight':800,'text-anchor':'middle'},mark);
      el(g,'rect',{x:p[0]-92,y:p[1]+47,width:184,height:30,fill:'#232923'});
      el(g,'text',{x:p[0],y:p[1]+69,fill:'#fff9e9','font-family':FONT,'font-size':19,'font-weight':800,'text-anchor':'middle'},label);
    }
  }
  if (OPTS.react) { el(svg,'text',{x:1590,y:896,fill:'#3d493c','font-family':FONT,'font-size':12,'text-anchor':'end'},ATTRIB); return; }
  const bar=el(svg,'g');
  el(bar,'rect',{x:310,y:846,width:980,height:36,fill:'#20261f'});
  el(bar,'rect',{x:310,y:846,width:155,height:36,fill:'#0f1614'});
  el(bar,'text',{x:387,y:871,fill:'#f8eed0','font-family':FONT,'font-size':22,'font-weight':800,'text-anchor':'middle'},dates[si]);
  el(bar,'rect',{x:479,y:858,width:10,height:10,fill:C.dz});
  el(bar,'text',{x:508,y:871,fill:'#f8eed0','font-family':FONT,'font-size':21,'letter-spacing':2},s.title.toUpperCase());
  el(bar,'rect',{x:310,y:884,width:980*clamp01(t/s.dur),height:3,fill:'#c5b365'});
  el(svg,'text',{x:1590,y:899,fill:'#3d493c','font-family':FONT,'font-size':12,'text-anchor':'end'},ATTRIB);
  // film frame: thin letterbox + timecode-free safe area keeps it read as video
  el(svg, 'rect', { x: 0, y: 0, width: W, height: H, fill: 'none', stroke: '#000', 'stroke-width': 4 });
}

export { W, H, render, camAt, projFor, clamp01, fade, ease };
