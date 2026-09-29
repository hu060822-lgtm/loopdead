/** Per-world look: a background tint, a faint background pattern and an accent for UI labels. */
export type Theme = {
  key: string;
  bg: string;       // room background
  outer: string;    // area around the room view
  solid: string;
  edge: string;
  mark: string;     // pattern ink
  accent: string;   // world accent (level select, HUD label)
  pattern: 'dots' | 'rise' | 'hatch' | 'beams' | 'rings' | 'grid' | 'split' | 'static';
};

export const THEMES: Record<string, Theme> = {
  'LEARNING TO DIE': { key: 'w1', bg: '#0a0b0d', outer: '#07080a', solid: '#1b1e23', edge: '#2c3037', mark: '#14161b', accent: '#9aa0aa', pattern: 'dots' },
  'ASCENT':          { key: 'w2', bg: '#090c12', outer: '#06080c', solid: '#18202b', edge: '#2a3646', mark: '#111826', accent: '#7fa8d9', pattern: 'rise' },
  'MACHINERY':       { key: 'w3', bg: '#0e0c09', outer: '#090806', solid: '#231f19', edge: '#3a3226', mark: '#1a160f', accent: '#d2a15e', pattern: 'hatch' },
  'LIGHT':           { key: 'w4', bg: '#0f090b', outer: '#0a0607', solid: '#251a1d', edge: '#3d2a2f', mark: '#1c1013', accent: '#e0767f', pattern: 'beams' },
  'ECHO':            { key: 'w5', bg: '#080e0e', outer: '#050909', solid: '#172424', edge: '#27403e', mark: '#0f1c1b', accent: '#5fd1bf', pattern: 'rings' },
  'MIMIC':           { key: 'w6', bg: '#0c0910', outer: '#08060b', solid: '#1f1828', edge: '#352a45', mark: '#150f1e', accent: '#b08ae6', pattern: 'grid' },
  'PARADOX':         { key: 'w7', bg: '#0b0b0b', outer: '#060606', solid: '#1e1e1e', edge: '#3a3a3a', mark: '#161616', accent: '#e8e8e8', pattern: 'split' },
  'SPECIAL':         { key: 'sp', bg: '#100707', outer: '#090404', solid: '#261212', edge: '#4a1f1f', mark: '#1d0c0c', accent: '#ff5a4a', pattern: 'static' },
};

export function themeFor(world: string): Theme {
  return THEMES[world] ?? THEMES['LEARNING TO DIE'];
}

/** Paints the world's background pattern onto a room-sized canvas (static; drawn once per room). */
export function paintBackground(g: CanvasRenderingContext2D, w: number, h: number, t: Theme): void {
  g.fillStyle = t.bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = t.mark;
  g.strokeStyle = t.mark;
  g.lineWidth = 1;
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  switch (t.pattern) {
    case 'dots':
      for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) g.fillRect(x, y, 1, 1);
      break;
    case 'rise':
      // thin verticals and small upward chevrons: the climb
      for (let x = 8; x < w; x += 32) g.fillRect(x, 0, 1, h);
      for (let y = 12; y < h; y += 48) for (let x = 24; x < w; x += 64) {
        g.fillRect(x - 2, y + 2, 1, 1); g.fillRect(x - 1, y + 1, 1, 1); g.fillRect(x, y, 1, 1);
        g.fillRect(x + 1, y + 1, 1, 1); g.fillRect(x + 2, y + 2, 1, 1);
      }
      break;
    case 'hatch':
      g.beginPath();
      for (let k = -h; k < w; k += 24) { g.moveTo(k, h); g.lineTo(k + h, 0); }
      g.stroke();
      for (let y = 0; y < h; y += 64) for (let x = 32; x < w; x += 96) { g.strokeRect(x - 4.5, y + 28.5, 9, 9); }
      break;
    case 'beams':
      for (let x = 20; x < w; x += 56) {
        const grd = g.createLinearGradient(x, 0, x, h);
        grd.addColorStop(0, t.mark);
        grd.addColorStop(1, t.bg);
        g.fillStyle = grd;
        g.fillRect(x, 0, 6, h);
      }
      break;
    case 'rings': {
      const cx = w / 2, cy = h / 2;
      for (let r = 24; r < Math.max(w, h); r += 28) { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); }
      break;
    }
    case 'grid':
      for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 ? 0 : 32; x < w; x += 64) g.fillRect(x, y, 32, 32);
      break;
    case 'split':
      // horizontal scanlines, alternating bands: two times layered on each other
      for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1);
      g.fillStyle = t.bg;
      for (let y = 0; y < h; y += 64) g.fillRect(0, y, w, 32);
      break;
    case 'static':
      for (let i = 0; i < (w * h) / 60; i++) g.fillRect(Math.floor(rnd() * w), Math.floor(rnd() * h), 1, 1);
      for (let y = 0; y < h; y += 37) g.fillRect(0, y, w, 1);
      break;
  }
}
