import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fmtTime } from './format';
import type { Audio } from '../game/audio';
import { TICK_MS, TICK_RATE } from '../game/constants';
import { InputManager } from '../game/input';
import { Renderer } from '../game/render';
import { Room } from '../game/room';
import type { Settings } from '../game/save';
import { deriveGameState, type GameState } from '../game/state';
import { roomLabel, type LevelEntry } from '../levels';

export type CompletionStats = { time: number; loops: number; deaths: number; lastLoop: number };

type Hud = {
  state: GameState;
  loop: number;
  ghosts: number;
  deaths: number;
  time: number;
  limit: number | null;
  lastCause: string | null;
};

type Props = {
  entry: LevelEntry;
  hasNext: boolean;
  settings: Settings;
  audio: Audio;
  onComplete: (stats: CompletionStats) => void;
  onNext: () => void;
  onQuit: () => void;
  onOpenSettings: () => void;
  settingsOpen: boolean;
};

const CAUSE_TEXT: Record<string, string> = {
  spike: 'SPIKES', fall: 'FELL', enemy: 'CAUGHT', laser: 'BURNED', crush: 'CRUSHED', timeout: 'OUT OF TIME',
};

export function GameView(props: Props) {
  const { entry } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const roomRef = useRef<Room | null>(null);
  const pausedRef = useRef(false);
  const settingsRef = useRef(props.settings);
  const propsRef = useRef(props);
  const debugRef = useRef({ debug: false, hitboxes: false, inputs: false });
  const inputRef = useRef(new InputManager(props.settings.bindings));
  const [paused, setPaused] = useState(false);
  const [hud, setHud] = useState<Hud | null>(null);
  const [stats, setStats] = useState<CompletionStats | null>(null);
  const [loadError, setLoadError] = useState<string | null>(entry.error);

  useLayoutEffect(() => {
    settingsRef.current = props.settings;
    propsRef.current = props;
    inputRef.current.bindings = props.settings.bindings;
  });

  const setPause = useCallback((p: boolean) => {
    pausedRef.current = p;
    setPaused(p);
    inputRef.current.clear();
  }, []);

  // Settings panel opened from pause keeps the game paused.
  useEffect(() => {
    if (props.settingsOpen) setPause(true);
  }, [props.settingsOpen, setPause]);

  // ---------- main loop ----------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!entry.def || !canvas) return;
    let room: Room;
    let renderer: Renderer;
    try {
      room = new Room(entry.def);
      renderer = new Renderer(canvas);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
      return;
    }
    roomRef.current = room;
    setStats(null);
    pausedRef.current = false;
    setPaused(false);
    const input = inputRef.current;
    input.clear();

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let fps = 60;
    let hudKey = '';
    let completed = false;

    const frame = (now: number) => {
      let dt = now - last;
      last = now;
      if (dt > 250) dt = 250;
      fps = fps * 0.95 + (1000 / Math.max(1, dt)) * 0.05;
      const s = settingsRef.current;
      const opts = { ...debugRef.current, reducedEffects: s.reducedEffects, screenShake: s.screenShake, fps };

      if (!pausedRef.current && room.status !== 'COMPLETE') {
        acc += dt;
        let steps = 0;
        while (acc >= TICK_MS && steps < 8) {
          room.tick(input.sample());
          if (room.events.length) {
            renderer.onEvents(room.events, opts);
            for (const e of room.events) propsRef.current.audio.play(e);
          }
          acc -= TICK_MS;
          steps++;
          if ((room.status as string) === 'COMPLETE') break;
        }
        if (steps === 8) acc = 0; // tab was stalled; don't fast-forward
      } else {
        acc = 0;
      }

      if (room.status !== 'COMPLETE') completed = false;
      if (room.status === 'COMPLETE' && !completed) {
        completed = true;
        const st = { time: room.totalFrames / TICK_RATE, loops: room.loop, deaths: room.deaths, lastLoop: room.frame / TICK_RATE };
        setStats(st);
        propsRef.current.onComplete(st);
      }

      renderer.draw(room, opts, now);

      const state = deriveGameState('GAME', room, pausedRef.current);
      const next: Hud = {
        state,
        loop: room.loop,
        ghosts: room.ghostCount,
        deaths: room.deaths,
        time: Math.floor(room.frame / 3) * 3 / TICK_RATE, // ~20 Hz HUD, never per-tick React state
        limit: room.timeLimitFrames !== null ? room.timeLimitFrames / TICK_RATE : null,
        lastCause: room.lastDeath?.cause ?? null,
      };
      const key = `${next.state}|${next.loop}|${next.ghosts}|${next.deaths}|${next.time}`;
      if (key !== hudKey) {
        hudKey = key;
        setHud(next);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onBlur = () => {
      input.clear();
      if (room.status !== 'COMPLETE') { pausedRef.current = true; setPaused(true); }
    };
    window.addEventListener('blur', onBlur);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('blur', onBlur);
      roomRef.current = null;
    };
  }, [entry]);

  // ---------- keyboard ----------
  useEffect(() => {
    const input = inputRef.current;
    const down = (e: KeyboardEvent) => {
      const room = roomRef.current;
      if (!room || propsRef.current.settingsOpen) return;
      if (e.code === 'F1' || e.code === 'F2' || e.code === 'F3') {
        e.preventDefault();
        const d = debugRef.current;
        if (e.code === 'F1') d.debug = !d.debug;
        if (e.code === 'F2') d.hitboxes = !d.hitboxes;
        if (e.code === 'F3') d.inputs = !d.inputs;
        return;
      }
      if (room.status === 'COMPLETE') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          if (propsRef.current.hasNext) propsRef.current.onNext();
        }
        if (e.code === 'KeyR') { room.newAttempt(); setStats(null); }
        if (e.code === 'Escape') propsRef.current.onQuit();
        return;
      }
      if (e.code === 'Escape') { e.preventDefault(); setPause(!pausedRef.current); return; }
      if (pausedRef.current) return;
      propsRef.current.audio.unlock();
      if (e.code === 'KeyR' && !e.repeat) { room.resetRoom(); input.clear(); return; }
      if ((e.code === 'KeyZ' || e.code === 'Backspace') && !e.repeat) { e.preventDefault(); room.undoLastLoop(); return; }
      if (input.isGameKey(e.code)) {
        e.preventDefault();
        input.keyDown(e.code);
      }
    };
    const up = (e: KeyboardEvent) => input.keyUp(e.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [setPause]);

  const restart = () => {
    const r = roomRef.current;
    if (r && r.status === 'COMPLETE') r.newAttempt();
    else r?.resetRoom();
    setStats(null);
    setPause(false);
  };

  if (loadError || !entry.def) {
    return (
      <div className="overlay center">
        <div className="panel">
          <h2 className="panel-title hazard">Failed to load level.</h2>
          <p className="muted small mono">{loadError}</p>
          <button className="btn" onClick={props.onQuit}>Return to Level Select</button>
        </div>
      </div>
    );
  }

  const idx = roomLabel(entry);
  const limitLeft = hud?.limit != null ? Math.max(0, hud.limit - hud.time) : null;

  return (
    <div className="game">
      <canvas ref={canvasRef} className="game-canvas" />

      {hud && (
        <div className="hud">
          <div className="hud-left">
            <div className="hud-big">LOOP {String(hud.loop).padStart(2, '0')}</div>
            <div className="hud-small">GHOSTS {String(hud.ghosts).padStart(2, '0')}</div>
          </div>
          <div className="hud-right">
            {limitLeft !== null
              ? <div className={`hud-big ${limitLeft < 5 ? 'hazard' : ''}`}>T-{limitLeft.toFixed(2)}</div>
              : <div className="hud-big">TIME {hud.time.toFixed(2).padStart(5, '0')}</div>}
            <div className="hud-small">DEATHS {String(hud.deaths).padStart(2, '0')}</div>
          </div>
          <div className="hud-level">{idx} · {entry.name.toUpperCase()}</div>
          <div className="hud-keys">R RESET ROOM · Z UNDO LOOP · ESC PAUSE</div>
        </div>
      )}

      {hud?.state === 'DEAD' && (
        <div className="overlay center pass">
          <div className="loop-card">
            <div className="loop-cause">{CAUSE_TEXT[hud.lastCause ?? ''] ?? ''}</div>
            <div className="loop-num">LOOP {String(hud.loop).padStart(2, '0')}</div>
            <div className="loop-sub">MEMORY RECORDED</div>
          </div>
        </div>
      )}

      {paused && !stats && !props.settingsOpen && (
        <div className="overlay center dim">
          <div className="panel menu-panel">
            <h2 className="panel-title">PAUSED</h2>
            <button className="btn" autoFocus onClick={() => setPause(false)}>Resume</button>
            <button className="btn" onClick={restart}>Restart Room</button>
            <button className="btn" onClick={props.onOpenSettings}>Settings</button>
            <button className="btn" onClick={props.onQuit}>Quit to Level Select</button>
          </div>
        </div>
      )}

      {stats && (
        <div className="overlay center dim">
          <div className="panel menu-panel">
            <h2 className="panel-title exit">LOOP COMPLETE</h2>
            <div className="stats">
              <span>Loops</span><span>{stats.loops}</span>
              <span>Deaths</span><span>{stats.deaths}</span>
              <span>Final loop</span><span>{fmtTime(stats.lastLoop)}</span>
              <span>Total time</span><span>{fmtTime(stats.time)}</span>
            </div>
            {props.hasNext && <button className="btn primary" autoFocus onClick={props.onNext}>Next Room</button>}
            <button className="btn" onClick={restart}>Replay Room</button>
            <button className="btn" onClick={props.onQuit}>Level Select</button>
          </div>
        </div>
      )}
    </div>
  );
}
