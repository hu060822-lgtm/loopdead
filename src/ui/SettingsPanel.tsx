import { useEffect, useState } from 'react';
import { ACTIONS, keyLabel, type Action } from '../game/input';
import type { Settings } from '../game/save';

type Props = {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
};

const ACTION_LABEL: Record<Action, string> = { left: 'Move Left', right: 'Move Right', jump: 'Jump', dash: 'Dash' };
const RESERVED = new Set(['Escape', 'KeyR', 'KeyZ', 'Backspace', 'F1', 'F2', 'F3', 'Enter', 'Tab']);

export function SettingsPanel({ settings, onChange, onClose }: Props) {
  const [binding, setBinding] = useState<Action | null>(null);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (binding) {
        e.preventDefault();
        e.stopPropagation();
        if (e.code === 'Escape') { setBinding(null); return; }
        if (RESERVED.has(e.code)) return;
        const bindings = { ...settings.bindings };
        // Remove the key from any other action, then make it this action's primary key.
        for (const a of ACTIONS) bindings[a] = bindings[a].filter((k) => k !== e.code);
        bindings[binding] = [e.code, ...bindings[binding]].slice(0, 3);
        onChange({ ...settings, bindings });
        setBinding(null);
        return;
      }
      if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [binding, settings, onChange, onClose]);

  const slider = (label: string, field: 'masterVolume' | 'sfxVolume' | 'musicVolume') => (
    <label className="setting-row">
      <span>{label}</span>
      <input
        type="range" min={0} max={1} step={0.05} value={settings[field]}
        onChange={(e) => onChange({ ...settings, [field]: Number(e.target.value) })}
      />
      <span className="setting-val">{Math.round(settings[field] * 100)}</span>
    </label>
  );

  const toggle = (label: string, field: 'screenShake' | 'reducedEffects') => (
    <button className="setting-row toggle" onClick={() => onChange({ ...settings, [field]: !settings[field] })}>
      <span>{label}</span>
      <span className={settings[field] ? 'on' : 'off'}>{settings[field] ? 'ON' : 'OFF'}</span>
    </button>
  );

  return (
    <div className="overlay center dim">
      <div className="panel settings-panel">
        <h2 className="panel-title">SETTINGS</h2>
        <div className="setting-group">
          {slider('Master Volume', 'masterVolume')}
          {slider('SFX Volume', 'sfxVolume')}
          {slider('Music Volume', 'musicVolume')}
        </div>
        <div className="setting-group">
          {toggle('Screen Shake', 'screenShake')}
          {toggle('Reduced Effects', 'reducedEffects')}
        </div>
        <div className="setting-group">
          <div className="group-label">KEY BINDINGS</div>
          {ACTIONS.map((a) => (
            <button key={a} className={`setting-row toggle ${binding === a ? 'listening' : ''}`} onClick={() => setBinding(a)}>
              <span>{ACTION_LABEL[a]}</span>
              <span className="keys">{binding === a ? 'PRESS A KEY…' : settings.bindings[a].map(keyLabel).join(' / ')}</span>
            </button>
          ))}
          <div className="muted small">Fixed: R reset room · Z undo last loop · ESC pause · F1–F3 debug</div>
        </div>
        <button className="btn" onClick={onClose}>Back</button>
      </div>
    </div>
  );
}
