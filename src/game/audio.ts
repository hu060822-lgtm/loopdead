import type { GameEvent } from './types';

/**
 * Tiny synthesized sound set (no assets). Purely presentational: nothing here
 * feeds back into the simulation.
 */
export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private musicNodes: AudioNode[] = [];
  private noiseBuf: AudioBuffer | null = null;
  private vol = { master: 0.8, sfx: 0.8, music: 0.45 };

  /** Must be called from a user gesture (browsers block autoplay). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
    } catch {
      return;
    }
    const c = this.ctx;
    this.master = c.createGain();
    this.sfx = c.createGain();
    this.music = c.createGain();
    this.sfx.connect(this.master);
    this.music.connect(this.master);
    this.master.connect(c.destination);
    this.noiseBuf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    let seed = 1234567;
    for (let i = 0; i < d.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      d[i] = (seed / 0x7fffffff) * 2 - 1;
    }
    this.applyVolumes();
    this.startMusic();
  }

  setVolumes(master: number, sfx: number, music: number): void {
    this.vol = { master, sfx, music };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.master, t, 0.05);
    this.sfx.gain.setTargetAtTime(this.vol.sfx * 0.5, t, 0.05);
    this.music.gain.setTargetAtTime(this.vol.music * 0.22, t, 0.3);
  }

  /** A cold two-chord drone: detuned sines through a slowly breathing low-pass. */
  private startMusic(): void {
    const c = this.ctx!;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 3;
    filter.connect(this.music);
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.value = 0.05;
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
    this.musicNodes.push(filter, lfo, lfoGain);
    const chordA = [55, 82.41, 110, 130.81];
    const chordB = [49, 73.42, 98, 116.54];
    chordA.forEach((f, i) => {
      for (const det of [-4, 4]) {
        const o = c.createOscillator();
        o.type = i === 0 ? 'triangle' : 'sine';
        o.frequency.value = f;
        o.detune.value = det;
        const g = c.createGain();
        g.gain.value = 0.18 / chordA.length;
        o.connect(g).connect(filter);
        // Slow alternation between the two chords every 16 s.
        const t0 = c.currentTime;
        for (let k = 0; k < 400; k++) {
          o.frequency.setValueAtTime(k % 2 === 0 ? f : chordB[i], t0 + k * 16);
        }
        o.start();
        this.musicNodes.push(o, g);
      }
    });
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0): void {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, freq: number, type: BiquadFilterType = 'bandpass'): void {
    const c = this.ctx;
    if (!c || !this.noiseBuf) return;
    const t = c.currentTime;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.3), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.sfx);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  play(e: GameEvent): void {
    if (!this.ctx) return;
    switch (e.type) {
      case 'jump':
        if (!e.replay) this.tone(330, 0.09, 'square', 0.12, 520);
        break;
      case 'dash':
        if (!e.replay) this.noise(0.14, 0.35, 2400);
        break;
      case 'death':
        if (e.replay) {
          this.tone(180, 0.18, 'sine', 0.12, 90);
        } else {
          // muted, distorted snap: the loop tearing
          this.tone(140, 0.35, 'sawtooth', 0.22, 38);
          this.noise(0.25, 0.4, 900, 'lowpass');
        }
        break;
      case 'loop':
        this.tone(880, 0.5, 'sine', 0.07, 440);
        this.tone(1320, 0.4, 'sine', 0.03, 660, 0.05);
        break;
      case 'plate':
        this.tone(e.on ? 620 : 420, 0.05, 'square', 0.08);
        break;
      case 'door':
        this.tone(e.open ? 90 : 70, 0.22, 'triangle', 0.25, e.open ? 140 : 50);
        break;
      case 'alert':
        this.tone(760, 0.06, 'square', 0.08);
        this.tone(760, 0.06, 'square', 0.08, undefined, 0.09);
        break;
      case 'spring':
        if (!e.replay) this.tone(180, 0.22, 'square', 0.1, 720);
        break;
      case 'orb':
        this.tone(1175, 0.18, 'sine', e.replay ? 0.03 : 0.09, 1760);
        break;
      case 'crumble':
        this.noise(0.18, 0.2, 700, 'lowpass');
        break;
      case 'walljump':
        if (!e.replay) this.tone(420, 0.06, 'square', 0.08, 600);
        break;
      case 'slam':
        this.tone(70, 0.3, 'triangle', 0.3, 40);
        this.noise(0.2, 0.3, 500, 'lowpass');
        break;
      case 'burn':
        this.noise(0.3, 0.35, 3200, 'highpass');
        this.tone(220, 0.25, 'sawtooth', 0.1, 60);
        break;
      case 'complete':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.12, undefined, i * 0.08));
        break;
    }
  }
}
