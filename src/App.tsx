import { Component, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Audio } from './game/audio';
import { loadSave, recordCompletion, writeSave, type SaveData, type Settings } from './game/save';
import type { Screen } from './game/state';
import { LEVELS, roomLabel, type LevelEntry } from './levels';
import { GameView, type CompletionStats } from './ui/GameView';
import { fmtTime } from './ui/format';
import { themeFor } from './game/themes';
import { SettingsPanel } from './ui/SettingsPanel';

class ErrorBoundary extends Component<{ children: ReactNode; onReset: () => void }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="overlay center">
          <div className="panel">
            <h2 className="panel-title hazard">Something broke.</h2>
            <p className="muted small mono">{this.state.error}</p>
            <button className="btn" onClick={() => { this.setState({ error: null }); this.props.onReset(); }}>
              Return to Level Select
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Menu({ onPlay, onSelect, onSettings, canContinue, blocked }: { onPlay: () => void; onSelect: () => void; onSettings: () => void; canContinue: boolean; blocked: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (!blocked && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); onPlay(); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onPlay, blocked]);
  return (
    <div className="menu">
      <div className="title-block">
        <h1 className="title">DEAD<span className="title-gap" />LOOP</h1>
        <p className="subtitle">Every death leaves something behind.</p>
      </div>
      <div className="menu-buttons">
        <button className="btn primary" onClick={onPlay}>{canContinue ? 'Continue' : 'Start'}</button>
        <button className="btn" onClick={onSelect}>Level Select</button>
        <button className="btn" onClick={onSettings}>Settings</button>
      </div>
      <div className="controls-legend">
        <span><b>A D / ← →</b> move</span>
        <span><b>SPACE / W</b> jump</span>
        <span><b>SHIFT</b> dash</span>
        <span><b>R</b> reset room</span>
        <span><b>Z</b> undo loop</span>
        <span><b>ESC</b> pause</span>
      </div>
      <div className="menu-legend">
        <span className="lg you" />YOU
        <span className="lg ghost" />PAST YOU
        <span className="lg corpse" />CORPSE
        <span className="lg hazard" />HAZARD
        <span className="lg interact" />MECHANISM
        <span className="lg exit" />EXIT
      </div>
    </div>
  );
}

function LevelSelect({ save, onPick, onBack }: { save: SaveData; onPick: (e: LevelEntry) => void; onBack: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.code === 'Escape') onBack(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onBack]);
  const worlds = useMemo(() => {
    const m = new Map<string, LevelEntry[]>();
    for (const l of LEVELS) {
      const list = m.get(l.world) ?? [];
      list.push(l);
      m.set(l.world, list);
    }
    return [...m.entries()];
  }, []);
  return (
    <div className="select">
      <div className="select-head">
        <button className="btn ghost-btn" onClick={onBack}>← Back</button>
        <h2 className="panel-title">SELECT ROOM</h2>
        <span />
      </div>
      {worlds.map(([world, list], wi) => (
        <section key={world} className={`world ${world === 'SPECIAL' ? 'special' : ''}`}
          style={{ ['--accent' as string]: themeFor(world).accent, ['--tint' as string]: themeFor(world).bg }}>
          <div className="world-label">{world === 'SPECIAL' ? 'SPECIAL ROOMS' : `WORLD ${wi + 1} · ${world}`}</div>
          <div className="level-grid">
            {list.map((l) => {
              const unlocked = save.unlockedLevels.includes(l.id);
              const rec = save.completedLevels[l.id];
              return (
                <button key={l.id} className={`level-card ${unlocked ? '' : 'locked'} ${rec ? 'done' : ''}`}
                  disabled={!unlocked} onClick={() => onPick(l)}>
                  <span className="lc-num">{roomLabel(l)}</span>
                  <span className="lc-name">{unlocked ? l.name : '— locked —'}</span>
                  {rec && (
                    <span className="lc-stats">
                      <span>{rec.bestLoops} loops</span>
                      <span title="Total time in the room, every loop included">Σ {fmtTime(rec.bestTime)}</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function App() {
  const firstId = LEVELS[0].id;
  const [save, setSave] = useState<SaveData>(() => loadSave(firstId));
  const [screen, setScreen] = useState<Screen>('MENU');
  const [current, setCurrent] = useState<LevelEntry | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const audio = useMemo(() => new Audio(), []);

  useEffect(() => {
    const s = save.settings;
    audio.setVolumes(s.masterVolume, s.sfxVolume, s.musicVolume);
  }, [audio, save.settings]);

  useEffect(() => {
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [audio]);

  const persist = useCallback((next: SaveData) => {
    setSave(next);
    writeSave(next);
  }, []);

  const play = useCallback((entry: LevelEntry) => {
    setCurrent(entry);
    setScreen('GAME');
  }, []);

  const continueGame = useCallback(() => {
    const firstOpen = LEVELS.find((l) => save.unlockedLevels.includes(l.id) && !save.completedLevels[l.id]);
    const lastUnlocked = [...LEVELS].reverse().find((l) => save.unlockedLevels.includes(l.id));
    play(firstOpen ?? lastUnlocked ?? LEVELS[0]);
  }, [play, save]);

  const onComplete = useCallback((stats: CompletionStats) => {
    if (!current) return;
    const next = LEVELS[current.index + 1];
    setSave((prev) => {
      const updated = recordCompletion(prev, current.id, next?.id ?? null, stats.time, stats.loops, stats.deaths);
      writeSave(updated);
      return updated;
    });
  }, [current]);

  const toSelect = useCallback(() => {
    setSettingsOpen(false);
    setScreen('LEVEL_SELECT');
  }, []);

  const updateSettings = useCallback((settings: Settings) => persist({ ...save, settings }), [persist, save]);

  const nextEntry = current ? LEVELS[current.index + 1] : undefined;

  return (
    <div className="app">
      <ErrorBoundary onReset={toSelect}>
        {screen === 'MENU' && (
          <Menu
            canContinue={Object.keys(save.completedLevels).length > 0}
            blocked={settingsOpen}
            onPlay={continueGame}
            onSelect={() => setScreen('LEVEL_SELECT')}
            onSettings={() => setSettingsOpen(true)}
          />
        )}
        {screen === 'LEVEL_SELECT' && <LevelSelect save={save} onPick={play} onBack={() => setScreen('MENU')} />}
        {screen === 'GAME' && current && (
          <GameView
            key={current.id}
            entry={current}
            hasNext={!!nextEntry}
            settings={save.settings}
            audio={audio}
            onComplete={onComplete}
            onNext={() => nextEntry && play(nextEntry)}
            onQuit={toSelect}
            onOpenSettings={() => setSettingsOpen(true)}
            settingsOpen={settingsOpen}
          />
        )}
        {settingsOpen && (
          <SettingsPanel settings={save.settings} onChange={updateSettings} onClose={() => setSettingsOpen(false)} />
        )}
      </ErrorBoundary>
    </div>
  );
}
