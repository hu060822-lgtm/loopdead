import type { Character } from './character';
import { IN_DASH, IN_JUMP, IN_LEFT, IN_RIGHT, TILE } from './constants';
import { type Crusher, type Walker, PLATFORM_H, SPIKE_DEPTH, SPIKE_INSET_X, T_CRUMBLE, T_GRIP, T_NOW, T_ONEWAY, T_PAST, T_SOLID, T_SPIKE_DOWN, T_SPIKE_LEFT, T_SPIKE_RIGHT, T_SPIKE_UP, type Room } from './room';
import { CRUMBLE_TICKS, SPRING_H } from './constants';
import { paintBackground, themeFor, type Theme } from './themes';
import type { GameEvent } from './types';

export const PALETTE = {
  bg: '#0a0b0d',
  grid: '#111317',
  solid: '#1b1e23',
  solidEdge: '#2c3037',
  oneway: '#3a3f47',
  player: '#c6ff5c',
  ghost: '#c9ccd2',
  corpse: '#50545c',
  corpseMark: '#2a2d33',
  hazard: '#ff3b4a',
  interact: '#f0b43c',
  exit: '#40e6c3',
  grip: '#8a96a6',
  orb: '#8fd3ff',
  spring: '#b99bff',
  crumble: '#6e604a',
  hint: '#4a4f58',
  text: '#d8d9dc',
};

export const UI_FONT = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

export type RenderOptions = {
  debug: boolean;
  hitboxes: boolean;
  inputs: boolean;
  reducedEffects: boolean;
  screenShake: boolean;
  fps: number;
};

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string };
type Ring = { x: number; y: number; t: number; color: string };

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private camX = 0;
  private camY = 0;
  private camInit = false;
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private shake = 0;
  private flash = 0;
  private trail: { x: number; y: number; a: number }[] = [];
  private seed = 99;
  private tileCanvas: HTMLCanvasElement | null = null;
  private tileRoom: Room | null = null;
  private echo = false;
  private seenPlates = new Set<string>();
  private theme: Theme = themeFor('');

  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D not supported');
    this.ctx = ctx;
  }

  resetCamera(): void {
    this.camInit = false;
    this.particles = [];
    this.rings = [];
    this.trail = [];
    this.shake = 0;
    this.flash = 0;
  }

  // Render-only randomness (never touches the simulation).
  private rnd(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  onEvents(events: GameEvent[], opts: RenderOptions): void {
    for (const e of events) {
      if (e.type === 'death') {
        const color = e.replay ? PALETTE.ghost : PALETTE.player;
        this.rings.push({ x: e.x, y: e.y, t: 0, color: e.replay ? PALETTE.ghost : PALETTE.hazard });
        if (!opts.reducedEffects) {
          const n = e.replay ? 10 : 22;
          for (let i = 0; i < n; i++) {
            const a = this.rnd() * Math.PI * 2;
            const s = 0.6 + this.rnd() * (e.replay ? 1.6 : 2.6);
            this.particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 0, max: 26 + this.rnd() * 20, color });
          }
        }
        if (!e.replay) {
          if (opts.screenShake && !opts.reducedEffects) this.shake = 7;
          this.flash = opts.reducedEffects ? 0.25 : 0.55;
        }
      } else if (e.type === 'orb' || e.type === 'spring' || e.type === 'crumble') {
        const color = e.type === 'orb' ? PALETTE.orb : e.type === 'spring' ? PALETTE.spring : PALETTE.crumble;
        if (e.type !== 'crumble') this.rings.push({ x: e.x, y: e.y, t: 12, color });
        if (!opts.reducedEffects) {
          const n = e.type === 'crumble' ? 10 : 6;
          for (let i = 0; i < n; i++) {
            const a = this.rnd() * Math.PI * 2;
            const sp = 0.4 + this.rnd() * 1.4;
            this.particles.push({ x: e.x + (this.rnd() - 0.5) * 12, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 18 + this.rnd() * 14, color });
          }
        }
      } else if (e.type === 'slam') {
        if (opts.screenShake && !opts.reducedEffects) this.shake = Math.max(this.shake, 4);
        if (!opts.reducedEffects) {
          for (let i = 0; i < 10; i++) this.particles.push({ x: e.x + (this.rnd() - 0.5) * 24, y: e.y, vx: (this.rnd() - 0.5) * 2, vy: -this.rnd() * 1.5, life: 0, max: 20, color: '#6b7079' });
        }
      } else if (e.type === 'burn') {
        this.rings.push({ x: e.x, y: e.y, t: 0, color: PALETTE.hazard });
        if (!opts.reducedEffects) {
          for (let i = 0; i < 14; i++) {
            const a = this.rnd() * Math.PI * 2;
            const sp = 0.5 + this.rnd() * 2;
            this.particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, life: 0, max: 24 + this.rnd() * 16, color: PALETTE.hazard });
          }
        }
      } else if (e.type === 'complete') {
        this.flash = 0.2;
      }
    }
  }

  /** Pre-render static tiles once per room. */
  private buildTiles(room: Room): void {
    const c = document.createElement('canvas');
    c.width = room.pxW;
    c.height = room.pxH;
    const g = c.getContext('2d')!;
    const L = room.level;
    const th = themeFor(L.world);
    this.theme = th;
    paintBackground(g, c.width, c.height, th);
    for (let ty = 0; ty < L.height; ty++) {
      for (let tx = 0; tx < L.width; tx++) {
        const t = room.tileAt(tx, ty);
        const x = tx * TILE;
        const y = ty * TILE;
        const hard = (t2: number) => t2 === T_SOLID || t2 === T_GRIP;
        if (t === T_SOLID || t === T_GRIP) {
          g.fillStyle = th.solid;
          g.fillRect(x, y, TILE, TILE);
          g.fillStyle = th.edge;
          if (!hard(room.tileAt(tx, ty - 1)) && ty > 0) g.fillRect(x, y, TILE, 1);
          if (!hard(room.tileAt(tx - 1, ty)) && tx > 0) g.fillRect(x, y, 1, TILE);
          if (!hard(room.tileAt(tx + 1, ty)) && tx < L.width - 1) g.fillRect(x + TILE - 1, y, 1, TILE);
          if (!hard(room.tileAt(tx, ty + 1)) && ty < L.height - 1) g.fillRect(x, y + TILE - 1, TILE, 1);
          if (t === T_GRIP) {
            // ribbed faces you can kick off
            g.fillStyle = PALETTE.grip;
            const openL = !hard(room.tileAt(tx - 1, ty));
            const openR = !hard(room.tileAt(tx + 1, ty));
            for (let k = 1; k < TILE; k += 3) {
              if (openL) g.fillRect(x, y + k, 3, 1);
              if (openR) g.fillRect(x + TILE - 3, y + k, 3, 1);
              if (!openL && !openR) g.fillRect(x + 6, y + k, 4, 1);
            }
          }
        } else if (t === T_NOW || t === T_PAST) {
          // NOW: solid for the living you (your colour). PAST: solid for past selves (ghost grey).
          const col = t === T_NOW ? PALETTE.player : PALETTE.ghost;
          g.globalAlpha = t === T_NOW ? 0.14 : 0.1;
          g.fillStyle = col;
          g.fillRect(x, y, TILE, TILE);
          g.globalAlpha = t === T_NOW ? 0.7 : 0.45;
          g.strokeStyle = col;
          g.lineWidth = 1;
          if (t === T_PAST) g.setLineDash([2, 2]);
          g.strokeRect(x + 1.5, y + 1.5, TILE - 3, TILE - 3);
          g.setLineDash([]);
          g.globalAlpha = 1;
        } else if (t === T_ONEWAY) {
          g.fillStyle = PALETTE.oneway;
          g.fillRect(x, y, TILE, 2);
          g.fillStyle = PALETTE.solid;
          g.fillRect(x + 2, y + 2, 1, 3);
          g.fillRect(x + TILE - 3, y + 2, 1, 3);
        } else if (t === T_SPIKE_LEFT || t === T_SPIKE_RIGHT) {
          g.fillStyle = PALETTE.hazard;
          const right = t === T_SPIKE_RIGHT;
          const hgt = (TILE - SPIKE_INSET_X * 2) / 3;
          for (let i = 0; i < 3; i++) {
            const by = y + SPIKE_INSET_X + i * hgt;
            g.beginPath();
            if (right) { g.moveTo(x, by); g.lineTo(x + SPIKE_DEPTH, by + hgt / 2); g.lineTo(x, by + hgt); }
            else { g.moveTo(x + TILE, by); g.lineTo(x + TILE - SPIKE_DEPTH, by + hgt / 2); g.lineTo(x + TILE, by + hgt); }
            g.fill();
          }
        } else if (t === T_SPIKE_UP || t === T_SPIKE_DOWN) {
          g.fillStyle = PALETTE.hazard;
          const up = t === T_SPIKE_UP;
          const w = (TILE - SPIKE_INSET_X * 2) / 3;
          for (let i = 0; i < 3; i++) {
            const bx = x + SPIKE_INSET_X + i * w;
            g.beginPath();
            if (up) {
              g.moveTo(bx, y + TILE);
              g.lineTo(bx + w / 2, y + TILE - SPIKE_DEPTH);
              g.lineTo(bx + w, y + TILE);
            } else {
              g.moveTo(bx, y);
              g.lineTo(bx + w / 2, y + SPIKE_DEPTH);
              g.lineTo(bx + w, y);
            }
            g.fill();
          }
        }
      }
    }
    this.tileCanvas = c;
    this.tileRoom = room;
  }

  draw(room: Room, opts: RenderOptions, time: number): void {
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const cw = this.canvas.clientWidth;
    const ch = this.canvas.clientHeight;
    if (this.canvas.width !== Math.round(cw * dpr) || this.canvas.height !== Math.round(ch * dpr)) {
      this.canvas.width = Math.round(cw * dpr);
      this.canvas.height = Math.round(ch * dpr);
    }
    if (this.tileRoom !== room) { this.buildTiles(room); this.seenPlates.clear(); }
    this.echo = room.level.solidGhosts === true;

    // View: whole room if it fits a 640x360 window, else follow the player.
    const viewW = Math.min(room.pxW, 640);
    const viewH = Math.min(room.pxH, 360);
    const scale = Math.max(0.5, Math.min((cw - 16) / viewW, (ch - 16) / viewH));
    const offX = (cw - viewW * scale) / 2;
    const offY = (ch - viewH * scale) / 2;

    const p = room.player;
    const tx = Math.min(Math.max(p.x + p.w / 2 - viewW / 2, 0), room.pxW - viewW);
    const ty = Math.min(Math.max(p.y + p.h / 2 - viewH / 2, 0), room.pxH - viewH);
    if (!this.camInit) { this.camX = tx; this.camY = ty; this.camInit = true; }
    this.camX += (tx - this.camX) * 0.15;
    this.camY += (ty - this.camY) * 0.15;

    let sx = 0, sy = 0;
    if (this.shake > 0.1) {
      sx = (this.rnd() - 0.5) * this.shake;
      sy = (this.rnd() - 0.5) * this.shake;
      this.shake *= 0.82;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = this.theme.outer;
    ctx.fillRect(0, 0, cw, ch);

    ctx.save();
    ctx.beginPath();
    ctx.rect(offX, offY, viewW * scale, viewH * scale);
    ctx.clip();
    ctx.translate(offX + sx, offY + sy);
    ctx.scale(scale, scale);
    ctx.translate(-Math.round(this.camX * scale) / scale, -Math.round(this.camY * scale) / scale);
    ctx.imageSmoothingEnabled = false;

    ctx.drawImage(this.tileCanvas!, 0, 0);
    this.drawCrumble(room);
    this.drawPads(room, time);
    this.drawHints(room);
    this.drawMechanisms(room, time);
    this.drawPlatforms(room);
    this.drawExit(room, time);
    for (const c of room.corpses) this.drawCorpse(c.x, c.y, c.w, c.h);
    for (const k of room.crushers) this.drawCrusher(k, room);
    for (const w of room.walkers) if (w.alive) this.drawEnemy(w, time);
    for (const m of room.mimics) if (m.alive) this.drawMimic(m, time);
    this.drawLasers(room, time);
    for (const c of room.characters) if (c.kind === 'replay' && c.alive) this.drawCharacter(c, true, opts);
    this.drawTrail(p, opts);
    if (p.alive) this.drawCharacter(p, false, opts);
    this.drawFx();
    if (opts.hitboxes) this.drawHitboxes(room);
    if (opts.inputs) this.drawInputs(room);
    ctx.restore();

    // Frame border
    ctx.strokeStyle = '#16181c';
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(offX) - 0.5, Math.round(offY) - 0.5, Math.round(viewW * scale) + 1, Math.round(viewH * scale) + 1);

    if (this.flash > 0.01) {
      ctx.fillStyle = room.status === 'COMPLETE' ? `rgba(64,230,195,${this.flash})` : `rgba(255,59,74,${this.flash})`;
      ctx.fillRect(0, 0, cw, ch);
      this.flash *= 0.86;
    }
    if (room.status === 'DYING' && !opts.reducedEffects) {
      // brief horizontal tear lines while the loop resets
      ctx.fillStyle = 'rgba(242,242,238,0.05)';
      for (let i = 0; i < 6; i++) ctx.fillRect(0, this.rnd() * ch, cw, 1 + this.rnd() * 3);
    }
    if (opts.debug) this.drawDebug(room, opts, cw);
  }

  private drawHints(room: Room): void {
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.hint;
    ctx.font = `600 7px ${UI_FONT}`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    for (const h of room.hints) ctx.fillText(h.text, h.x + 2, h.y + 4);
  }

  private drawMechanisms(room: Room, time: number): void {
    const ctx = this.ctx;
    // Cause -> effect wiring, always visible so nothing is a guess.
    ctx.lineWidth = 1;
    // Wires stay hidden until that plate has been pressed once in this room: cause and effect are
    // discovered by trying, not read off the map.
    for (const pl of room.plates) if (pl.pressed) this.seenPlates.add(pl.id);
    const wire = (plates: { id: string; x: number; y: number; w: number; pressed: boolean }[], tx: number, ty: number) => {
      for (const pl of plates) {
        if (!this.seenPlates.has(pl.id)) continue;
        ctx.strokeStyle = pl.pressed ? 'rgba(240,180,60,0.45)' : 'rgba(240,180,60,0.12)';
        ctx.setLineDash([2, 3]);
        ctx.lineDashOffset = pl.pressed ? -time / 60 : 0;
        ctx.beginPath();
        ctx.moveTo(pl.x + pl.w / 2, pl.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
      }
    };
    for (const d of room.doors) wire(d.plates, d.x + d.w / 2, d.y + d.h / 2);
    for (const pf of room.platforms) wire(pf.plates, pf.x + pf.w / 2, pf.y + 2);
    for (const lz of room.lasers) wire(lz.plates, lz.tx + TILE / 2, lz.ty + TILE / 2);
    for (const cv of room.conveyors) wire(cv.plates, cv.x + cv.w / 2, cv.y + 1);
    ctx.setLineDash([]);
    for (const pl of room.plates) {
      ctx.fillStyle = PALETTE.interact;
      if (pl.latch || pl.hold > 0) {
        // Switch: a small post with a lamp; lit once thrown.
        const cx = pl.x + pl.w / 2;
        ctx.fillStyle = '#3a3f47';
        ctx.fillRect(pl.x + 1, pl.y + 1, pl.w - 2, 2);
        ctx.fillRect(cx - 1, pl.y - 6, 2, 7);
        ctx.fillStyle = pl.pressed ? PALETTE.interact : '#4a3f2a';
        ctx.fillRect(cx - 2.5, pl.y - 9, 5, 4);
        if (pl.pressed) {
          ctx.globalAlpha = 0.18;
          ctx.fillRect(cx - 6, pl.y - 13, 12, 12);
          ctx.globalAlpha = 1;
        }
        if (pl.hold > 0) {
          // timed switch: ring of ticks + draining bar
          ctx.fillStyle = '#3a3326';
          ctx.fillRect(cx - 6, pl.y - 12, 12, 1);
          ctx.fillStyle = PALETTE.interact;
          ctx.fillRect(cx - 6, pl.y - 12, 12 * (pl.holdLeft / pl.hold), 1);
        }
        continue;
      }
      const h = pl.pressed ? 1 : 3;
      ctx.globalAlpha = pl.pressed ? 1 : 0.75;
      ctx.fillRect(pl.x + 1, pl.y + 3 - h, pl.w - 2, h);
      if (pl.pressed) {
        ctx.globalAlpha = 0.15;
        ctx.fillRect(pl.x - 1, pl.y - 6, pl.w + 2, 9);
      }
      ctx.globalAlpha = 1;
    }
    for (const d of room.doors) {
      if (d.open) {
        ctx.strokeStyle = 'rgba(240,180,60,0.22)';
        ctx.setLineDash([2, 2]);
        ctx.strokeRect(d.x + 0.5, d.y + 0.5, d.w - 1, d.h - 1);
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = 'rgba(240,180,60,0.14)';
        ctx.fillRect(d.x, d.y, d.w, d.h);
        ctx.fillStyle = PALETTE.interact;
        ctx.fillRect(d.x + 2, d.y, 1, d.h);
        ctx.fillRect(d.x + d.w - 3, d.y, 1, d.h);
        for (let y = d.y + 3; y < d.y + d.h; y += 5) ctx.fillRect(d.x + 3, y, d.w - 6, 1);
        if (d.require === 'all' && d.plates.length > 1) {
          // pip per required plate
          d.plates.forEach((pl, i) => {
            ctx.fillStyle = pl.pressed ? PALETTE.interact : '#3a3326';
            ctx.fillRect(d.x + d.w / 2 - d.plates.length * 2 + i * 4, d.y - 4, 3, 2);
          });
        }
      }
    }
  }

  private drawCrumble(room: Room): void {
    const ctx = this.ctx;
    const L = room.level;
    for (let ty = 0; ty < L.height; ty++) {
      for (let tx = 0; tx < L.width; tx++) {
        if (room.tileAt(tx, ty) !== T_CRUMBLE) continue;
        const st = room.crumble[ty * L.width + tx];
        const x = tx * TILE, y = ty * TILE;
        if (st < 0) {
          ctx.strokeStyle = 'rgba(110,96,74,0.25)';
          ctx.setLineDash([1, 3]);
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
          ctx.setLineDash([]);
          continue;
        }
        const shake = st > 0 ? ((st % 2) ? 1 : -1) * (1 - st / CRUMBLE_TICKS) * 1.5 : 0;
        ctx.fillStyle = '#231f1a';
        ctx.fillRect(x + shake, y, TILE, TILE);
        ctx.fillStyle = PALETTE.crumble;
        ctx.fillRect(x + shake, y, TILE, 2);
        // cracks
        ctx.fillRect(x + 4 + shake, y + 4, 1, 5);
        ctx.fillRect(x + 5 + shake, y + 8, 3, 1);
        ctx.fillRect(x + 11 + shake, y + 6, 1, 6);
        if (st > 0) {
          ctx.fillRect(x + 8 + shake, y + 2, 1, 7);
          ctx.fillRect(x + 2 + shake, y + 11, 6, 1);
        }
      }
    }
  }

  private drawPads(room: Room, time: number): void {
    const ctx = this.ctx;
    for (const cv of room.conveyors) {
      ctx.fillStyle = '#2c3037';
      ctx.fillRect(cv.x, cv.y, cv.w, 3);
      ctx.fillStyle = '#7d8590';
      const sp = cv.active ? -cv.speed : cv.speed;
      const dir = sp >= 0 ? 1 : -1;
      const off = ((room.frame * Math.abs(sp)) % 8) * dir;
      if (cv.plates.length > 0) { ctx.fillStyle = cv.active ? PALETTE.interact : '#6b5a33'; ctx.fillRect(cv.x, cv.y + 3, 2, 2); ctx.fillRect(cv.x + cv.w - 2, cv.y + 3, 2, 2); ctx.fillStyle = '#7d8590'; }
      ctx.save();
      ctx.beginPath();
      ctx.rect(cv.x, cv.y, cv.w, 3);
      ctx.clip();
      for (let x = cv.x - 8; x < cv.x + cv.w + 8; x += 8) {
        const cx = x + off;
        // chevrons pointing along the belt
        ctx.fillRect(cx + (dir > 0 ? 0 : 2), cv.y, 1, 1);
        ctx.fillRect(cx + 1, cv.y + 1, 1, 1);
        ctx.fillRect(cx + (dir > 0 ? 0 : 2), cv.y + 2, 1, 1);
      }
      ctx.restore();
    }
    for (const sp of room.springs) {
      // set into the floor: a violet plate with a coil hint that flexes when fired
      const lift = sp.fired > 0 ? 3 : 1;
      ctx.fillStyle = sp.jammed ? '#4a4458' : PALETTE.spring;
      ctx.globalAlpha = 0.25;
      ctx.fillRect(sp.x + 2, sp.y - SPRING_H, sp.w - 4, SPRING_H);
      ctx.globalAlpha = 1;
      ctx.fillRect(sp.x + 1, sp.y - lift - 1, sp.w - 2, 2);
      ctx.fillRect(sp.x + 4, sp.y - lift + 1, 1, lift);
      ctx.fillRect(sp.x + sp.w - 5, sp.y - lift + 1, 1, lift);
    }
    for (const o of room.orbs) {
      const bob = Math.sin(time / 300 + o.x) * 1.2;
      ctx.save();
      ctx.translate(o.x, o.y + bob);
      ctx.rotate(Math.PI / 4);
      if (o.respawnLeft === 0) {
        ctx.fillStyle = 'rgba(143,211,255,0.18)';
        ctx.fillRect(-6, -6, 12, 12);
        ctx.fillStyle = PALETTE.orb;
        ctx.fillRect(-3.5, -3.5, 7, 7);
        ctx.fillStyle = '#e8f7ff';
        ctx.fillRect(-1.5, -1.5, 3, 3);
      } else {
        ctx.strokeStyle = 'rgba(143,211,255,0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-3.5, -3.5, 7, 7);
        const k = 1 - o.respawnLeft / o.respawn;
        ctx.fillStyle = 'rgba(143,211,255,0.35)';
        ctx.fillRect(-3.5, 3.5 - 7 * k, 7, 7 * k);
      }
      ctx.restore();
    }
  }

  private drawPlatforms(room: Room): void {
    const ctx = this.ctx;
    for (const pf of room.platforms) {
      // track
      ctx.strokeStyle = 'rgba(138,143,152,0.18)';
      ctx.setLineDash([1, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pf.x0 + pf.w / 2, pf.y0 + 2);
      ctx.lineTo(pf.x1 + pf.w / 2, pf.y1 + 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(138,143,152,0.25)';
      ctx.fillRect(pf.x0 + pf.w / 2 - 1, pf.y0 + 1, 2, 2);
      ctx.fillRect(pf.x1 + pf.w / 2 - 1, pf.y1 + 1, 2, 2);
      // body
      ctx.fillStyle = '#5d626b';
      ctx.fillRect(pf.x, pf.y, pf.w, PLATFORM_H);
      ctx.fillStyle = '#a9adb4';
      ctx.fillRect(pf.x, pf.y, pf.w, 1);
      if (pf.plates.length > 0) {
        ctx.fillStyle = pf.active ? PALETTE.interact : '#6b5a33';
        ctx.fillRect(pf.x, pf.y + 1, 2, PLATFORM_H - 1);
        ctx.fillRect(pf.x + pf.w - 2, pf.y + 1, 2, PLATFORM_H - 1);
      }
    }
  }

  private drawLasers(room: Room, time: number): void {
    const ctx = this.ctx;
    for (const lz of room.lasers) {
      // beam
      if (lz.on) {
        const flick = 0.75 + 0.25 * Math.sin(time / 30);
        ctx.fillStyle = `rgba(255,59,74,${0.18 * flick})`;
        ctx.fillRect(lz.bx - (lz.bh === 2 ? 0 : 2), lz.by - (lz.bh === 2 ? 2 : 0), lz.bw + (lz.bh === 2 ? 0 : 4), lz.bh + (lz.bh === 2 ? 4 : 0));
        ctx.fillStyle = PALETTE.hazard;
        ctx.fillRect(lz.bx, lz.by, lz.bw, lz.bh);
        ctx.fillStyle = '#ffd0d4';
        if (lz.bh === 2) ctx.fillRect(lz.bx, lz.by + 0.5, lz.bw, 1);
        else ctx.fillRect(lz.bx + 0.5, lz.by, 1, lz.bh);
      } else {
        ctx.strokeStyle = lz.warn && Math.floor(time / 70) % 2 === 0 ? 'rgba(255,59,74,0.55)' : 'rgba(255,59,74,0.14)';
        ctx.setLineDash([2, 3]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (lz.bh === 2) { ctx.moveTo(lz.bx, lz.by + 1); ctx.lineTo(lz.bx + lz.bw, lz.by + 1); }
        else { ctx.moveTo(lz.bx + 1, lz.by); ctx.lineTo(lz.bx + 1, lz.by + lz.bh); }
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // emitter housing
      const cx = lz.tx + TILE / 2;
      const cy = lz.ty + TILE / 2;
      const horizontal = lz.dir === 'left' || lz.dir === 'right';
      const lineX = horizontal ? cx : lz.tx + lz.offset;
      const lineY = horizontal ? lz.ty + lz.offset : cy;
      ctx.fillStyle = '#2c3037';
      ctx.fillRect(lineX - 4, lineY - 4, 8, 8);
      ctx.fillStyle = lz.on ? PALETTE.hazard : lz.warn ? '#a3303a' : '#5a2a30';
      const lx = lz.dir === 'right' ? lineX + 2 : lz.dir === 'left' ? lineX - 4 : lineX - 1;
      const ly = lz.dir === 'down' ? lineY + 2 : lz.dir === 'up' ? lineY - 4 : lineY - 1;
      ctx.fillRect(lx, ly, horizontal ? 2 : 2, horizontal ? 2 : 2);
      if (lz.mode === 'pulse') {
        // tiny cycle meter under the housing so the rhythm is readable
        const period = lz.pulseOn + lz.pulseOff;
        const ph = (room.frame + lz.phase) % period;
        ctx.fillStyle = '#3a1d21';
        ctx.fillRect(lineX - 4, lineY + 5, 8, 1);
        ctx.fillStyle = PALETTE.hazard;
        ctx.fillRect(lineX - 4, lineY + 5, 8 * (ph / period), 1);
      }
    }
  }

  private drawExit(room: Room, time: number): void {
    const ctx = this.ctx;
    const e = room.exitRect;
    const pulse = 0.5 + 0.5 * Math.sin(time / 380);
    ctx.fillStyle = `rgba(64,230,195,${0.06 + pulse * 0.06})`;
    ctx.fillRect(e.x - 6, e.y - 6, e.w + 12, e.h + 6);
    ctx.fillStyle = 'rgba(64,230,195,0.18)';
    ctx.fillRect(e.x, e.y, e.w, e.h);
    ctx.fillStyle = PALETTE.exit;
    ctx.fillRect(e.x, e.y, 1, e.h);
    ctx.fillRect(e.x + e.w - 1, e.y, 1, e.h);
    ctx.fillRect(e.x, e.y, e.w, 1);
    const k = (time / 22) % e.h;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(e.x + 2, e.y + e.h - k, e.w - 4, 1);
    ctx.fillRect(e.x + 2, e.y + e.h - ((k + e.h / 2) % e.h), e.w - 4, 1);
    ctx.globalAlpha = 1;
  }

  private drawCorpse(x: number, y: number, w: number, h: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.corpse;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = PALETTE.corpseMark;
    ctx.fillRect(x + 2, y + 1, 1, 1);
    ctx.fillRect(x + 4, y + 1, 1, 1);
    ctx.fillRect(x + 3, y + 2, 1, 1);
    ctx.fillRect(x + 2, y + 3, 1, 1);
    ctx.fillRect(x + 4, y + 3, 1, 1);
  }

  private drawEnemy(wk: Walker, time: number): void {
    if (wk.kind === 'walker') { this.drawWalker(wk.x, wk.y, wk.w, wk.h, wk.facing, wk.chasing, time); return; }
    const ctx = this.ctx;
    const { x, y, w, h } = wk;
    if (wk.kind === 'crawler') {
      // low armoured bug: mindless, jumpable
      ctx.fillStyle = PALETTE.hazard;
      ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
      ctx.fillRect(x, y + 3, w, h - 4);
      ctx.fillStyle = PALETTE.bg;
      for (let k = 3; k < w - 2; k += 3) ctx.fillRect(x + k, y + 1, 1, 3);
      const step = Math.floor(time / 90) % 2;
      ctx.fillRect(x + (step ? 1 : 2), y + h - 1, 1, 1);
      ctx.fillRect(x + w - (step ? 2 : 3), y + h - 1, 1, 1);
      return;
    }
    // brute: tall, dark-cored, light passes into it and stops
    ctx.fillStyle = '#8a1f28';
    ctx.fillRect(x, y + 3, w, h - 3);
    ctx.fillStyle = PALETTE.hazard;
    ctx.fillRect(x + 2, y, w - 4, 3);
    ctx.fillRect(x, y + 3, 2, h - 3);
    ctx.fillRect(x + w - 2, y + 3, 2, h - 3);
    ctx.fillRect(x, y + 14, w, 2);
    ctx.fillStyle = PALETTE.bg;
    const ex = wk.facing > 0 ? x + w - 6 : x + 2;
    ctx.fillRect(ex, y + 5, 4, wk.chasing ? 3 : 1);
    const step = Math.floor(time / 160) % 2;
    ctx.fillRect(x + (step ? 3 : 4), y + h - 2, 3, 2);
    ctx.fillRect(x + w - (step ? 6 : 7), y + h - 2, 3, 2);
    if (wk.chasing) {
      ctx.fillStyle = PALETTE.hazard;
      ctx.fillRect(x + w / 2 - 0.5, y - 7, 1, 3);
      ctx.fillRect(x + w / 2 - 0.5, y - 3, 1, 1);
    } else if (wk.searchLeft > 0) {
      // searching where it lost you: a small "?"
      ctx.fillStyle = PALETTE.hazard;
      ctx.fillRect(x + w / 2 - 1.5, y - 8, 3, 1);
      ctx.fillRect(x + w / 2 + 0.5, y - 7, 1, 1);
      ctx.fillRect(x + w / 2 - 0.5, y - 6, 1, 2);
      ctx.fillRect(x + w / 2 - 0.5, y - 3, 1, 1);
    }
  }

  private drawMimic(m: Character, time: number): void {
    const ctx = this.ctx;
    const mirror = m.replayIndex === 1;
    const x = m.x, y = m.y, w = m.w, h = m.h;
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = '#b08ae6';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#e7dcff';
    if (mirror) ctx.fillRect(x + w / 2 - 0.5, y + 1, 1, h - 2); // a seam down the middle: it flips you
    // hollow eyes, both sides: it looks where you look
    ctx.fillStyle = PALETTE.bg;
    const ex = m.facing > 0 ? x + w - 4 : x + 2;
    ctx.fillRect(ex, y + 4, 2, 2);
    ctx.fillRect(x + 2, y + h - 4, w - 4, 1);
    const pulse = 0.5 + 0.5 * Math.sin(time / 140);
    ctx.globalAlpha = 0.2 + pulse * 0.25;
    ctx.strokeStyle = '#b08ae6';
    ctx.strokeRect(x - 2.5, y - 2.5, w + 5, h + 5);
    ctx.globalAlpha = 1;
  }

  private drawCrusher(k: Crusher, room: Room): void {
    const ctx = this.ctx;
    // its drop column, faint, from its rest position down to where it would land
    if (k.state === 'idle') {
      ctx.fillStyle = 'rgba(255,59,74,0.05)';
      let depth = 0;
      while (depth < k.sight && !room.isSolidTile(Math.floor((k.x + 1) / TILE), Math.floor((k.y + k.h + depth) / TILE))) depth += TILE;
      ctx.fillRect(k.x + 1, k.y + k.h, k.w - 2, depth);
    }
    ctx.fillStyle = '#2b2f36';
    ctx.fillRect(k.x, k.y, k.w, k.h);
    ctx.fillStyle = '#4a505a';
    ctx.fillRect(k.x, k.y, k.w, 2);
    ctx.fillRect(k.x, k.y, 2, k.h);
    ctx.fillRect(k.x + k.w - 2, k.y, 2, k.h);
    // teeth
    ctx.fillStyle = PALETTE.hazard;
    for (let tx = k.x + 1; tx < k.x + k.w - 1; tx += 4) {
      ctx.beginPath();
      ctx.moveTo(tx, k.y + k.h - 3);
      ctx.lineTo(tx + 2, k.y + k.h);
      ctx.lineTo(tx + 4, k.y + k.h - 3);
      ctx.fill();
    }
    // face: two slits that widen as it drops
    ctx.fillStyle = k.state === 'fall' ? PALETTE.hazard : '#6b2a31';
    const oh = k.state === 'fall' ? 3 : 1;
    ctx.fillRect(k.x + k.w * 0.25 - 2, k.y + k.h / 2 - 1, 4, oh);
    ctx.fillRect(k.x + k.w * 0.75 - 2, k.y + k.h / 2 - 1, 4, oh);
  }

  private drawWalker(x: number, y: number, w: number, h: number, facing: number, chasing: boolean, time: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.hazard;
    ctx.fillRect(x, y + 2, w, h - 2);
    ctx.fillRect(x + 2, y, w - 4, 2);
    ctx.fillStyle = PALETTE.bg;
    const ex = facing > 0 ? x + w - 6 : x + 2;
    ctx.fillRect(ex, y + 4, 4, chasing ? 2 : 1);
    // legs
    const step = Math.floor(time / 120) % 2;
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(x + (step ? 3 : 2), y + h - 1, 2, 1);
    ctx.fillRect(x + w - (step ? 5 : 4), y + h - 1, 2, 1);
    if (chasing) {
      ctx.fillStyle = PALETTE.hazard;
      ctx.fillRect(x + w / 2 - 0.5, y - 7, 1, 3);
      ctx.fillRect(x + w / 2 - 0.5, y - 3, 1, 1);
    }
  }

  private drawCharacter(c: Character, ghost: boolean, opts: RenderOptions): void {
    const ctx = this.ctx;
    const dashing = c.state === 'DASH';
    let x = c.x, y = c.y, w = c.w, h = c.h;
    if (dashing) { y += 2; h -= 2; x -= 1; w += 2; }
    if (ghost) {
      ctx.globalAlpha = 0.34;
      ctx.fillStyle = PALETTE.ghost;
      ctx.fillRect(x, y, w, h);
      if (!opts.reducedEffects) {
        ctx.globalAlpha = 0.12;
        ctx.fillRect(x - c.vx * 2, y - c.vy * 2, w, h);
      }
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = PALETTE.ghost;
      ctx.font = `600 5px ${UI_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(String(c.replayIndex + 1).padStart(2, '0'), c.x + c.w / 2, c.y - 2);
      ctx.globalAlpha = 1;
      if (this.echo) {
        // echo rooms: past selves are solid from above — show the standable top
        ctx.fillStyle = PALETTE.ghost;
        ctx.fillRect(c.x - 1, c.y, c.w + 2, 1);
      }
    } else {
      // the living you: a dark outline so it reads on top of stacked past selves, and a marker overhead
      ctx.fillStyle = PALETTE.bg;
      ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = PALETTE.player;
      ctx.fillRect(x, y, w, h);
      const mx = c.x + c.w / 2;
      const my = c.y - 5;
      ctx.beginPath();
      ctx.moveTo(mx - 2.5, my - 3);
      ctx.lineTo(mx + 2.5, my - 3);
      ctx.lineTo(mx, my);
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.bg;
    ctx.globalAlpha = ghost ? 0.5 : 1;
    const ex = c.facing > 0 ? x + w - 4 : x + 2;
    ctx.fillRect(ex, y + 4, 2, 2);
    ctx.globalAlpha = 1;
  }

  private drawTrail(p: Character, opts: RenderOptions): void {
    if (opts.reducedEffects) { this.trail = []; return; }
    if (p.alive && p.state === 'DASH') this.trail.push({ x: p.x, y: p.y + 2, a: 0.35 });
    const ctx = this.ctx;
    for (const t of this.trail) {
      ctx.globalAlpha = t.a;
      ctx.fillStyle = PALETTE.player;
      ctx.fillRect(t.x, t.y, p.w, p.h - 2);
      t.a *= 0.8;
    }
    ctx.globalAlpha = 1;
    this.trail = this.trail.filter((t) => t.a > 0.03);
  }

  private drawFx(): void {
    const ctx = this.ctx;
    for (const r of this.rings) {
      r.t += 1;
      const k = r.t / 30;
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 4 + k * 22, 0, Math.PI * 2);
      ctx.stroke();
    }
    this.rings = this.rings.filter((r) => r.t < 30);
    for (const p of this.particles) {
      p.life++;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08;
      p.vx *= 0.96;
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 1.5, 1.5);
    }
    this.particles = this.particles.filter((p) => p.life < p.max);
    ctx.globalAlpha = 1;
  }

  private drawHitboxes(room: Room): void {
    const ctx = this.ctx;
    ctx.lineWidth = 0.5;
    const box = (x: number, y: number, w: number, h: number, c: string) => { ctx.strokeStyle = c; ctx.strokeRect(x + 0.25, y + 0.25, w - 0.5, h - 0.5); };
    for (let ty = 0; ty < room.level.height; ty++) {
      for (let tx = 0; tx < room.level.width; tx++) {
        const t = room.tileAt(tx, ty);
        if (t === T_SPIKE_UP) box(tx * TILE + SPIKE_INSET_X, ty * TILE + TILE - SPIKE_DEPTH, TILE - SPIKE_INSET_X * 2, SPIKE_DEPTH, '#ff00ff');
        if (t === T_SPIKE_DOWN) box(tx * TILE + SPIKE_INSET_X, ty * TILE, TILE - SPIKE_INSET_X * 2, SPIKE_DEPTH, '#ff00ff');
        if (t === T_SPIKE_RIGHT) box(tx * TILE, ty * TILE + SPIKE_INSET_X, SPIKE_DEPTH, TILE - SPIKE_INSET_X * 2, '#ff00ff');
        if (t === T_SPIKE_LEFT) box(tx * TILE + TILE - SPIKE_DEPTH, ty * TILE + SPIKE_INSET_X, SPIKE_DEPTH, TILE - SPIKE_INSET_X * 2, '#ff00ff');
      }
    }
    for (const c of room.characters) if (c.alive) box(c.x, c.y, c.w, c.h, c.kind === 'player' ? '#00ff88' : '#00aaff');
    for (const c of room.corpses) box(c.x, c.y, c.w, c.h, '#aaaaaa');
    for (const w of room.walkers) {
      if (!w.alive) continue;
      box(w.x, w.y, w.w, w.h, '#ff5555');
      ctx.strokeStyle = 'rgba(255,85,85,0.3)';
      ctx.strokeRect(w.x + w.w / 2 - w.sight, w.y + w.h / 2 - 40, w.sight * 2, 80);
    }
    for (const p of room.plates) box(p.x, p.y - 1, p.w, 4, '#ffff00');
    for (const pf of room.platforms) box(pf.x, pf.y, pf.w, PLATFORM_H, '#ffffff');
    for (const lz of room.lasers) if (lz.on) box(lz.bx, lz.by, Math.max(1, lz.bw), Math.max(1, lz.bh), '#ff00ff');
    for (const d of room.doors) box(d.x, d.y, d.w, d.h, d.open ? '#666600' : '#ffaa00');
    const e = room.exitRect;
    box(e.x, e.y, e.w, e.h, '#00ffff');
  }

  private drawInputs(room: Room): void {
    const ctx = this.ctx;
    ctx.font = `600 5px ${UI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    for (const c of room.characters) {
      if (!c.alive) continue;
      const i = c.lastInput;
      const s = `${i & IN_LEFT ? '←' : '·'}${i & IN_RIGHT ? '→' : '·'}${i & IN_JUMP ? 'J' : '·'}${i & IN_DASH ? 'D' : '·'}`;
      ctx.fillStyle = c.kind === 'player' ? '#00ff88' : '#00aaff';
      ctx.fillText(s, c.x + c.w / 2, c.y - (c.kind === 'replay' ? 8 : 2));
    }
  }

  private drawDebug(room: Room, opts: RenderOptions, cw: number): void {
    const ctx = this.ctx;
    const p = room.player;
    const lines = [
      `FPS        ${opts.fps.toFixed(0)}`,
      `LEVEL      ${room.level.id}`,
      `FRAME      ${room.frame}`,
      `POS        ${p.x}, ${p.y}`,
      `VEL        ${p.vx.toFixed(2)}, ${p.vy.toFixed(2)}`,
      `STATE      ${p.state}${p.grounded ? ' ground' : ''}`,
      `REPLAYS    ${room.replays.length}`,
      `CORPSES    ${room.corpses.length}`,
      `ENTITIES   ${room.walkers.length + room.doors.length + room.plates.length + room.platforms.length + room.lasers.length}`,
      `F2 boxes ${opts.hitboxes ? 'ON' : 'off'}  F3 inputs ${opts.inputs ? 'ON' : 'off'}`,
    ];
    ctx.font = `12px ${UI_FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const w = 250;
    const x = cw - w - 12;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(x, 56, w, lines.length * 16 + 12);
    ctx.fillStyle = '#9fe8c9';
    lines.forEach((l, i) => ctx.fillText(l, x + 10, 62 + i * 16));
  }
}
