import { useEffect, useMemo, useRef, useState } from 'react';
import { Scene } from './Scene';
import { MachineTimeChart, QueueChart } from './Charts';
import { type LineConfig, type LineResult, STAGE_NAMES, doneAt, simulateLine, stageCapacityLph, steadyInterval } from '../../engine/line';
import { fmt } from '../../engine/opm';
import { useStore } from '../../state/store';
import { play } from '../../state/sound';

export interface LineControls {
  caps?: boolean;
  /** Stages that may get a second machine. */
  machines?: number[];
  buffer?: boolean;
  order?: boolean;
}

interface Props {
  initial: LineConfig;
  controls?: LineControls;
  /** Show the bottleneck tag: always, only once the order is done, or never. */
  reveal?: 'always' | 'after-run' | 'never';
  charts?: boolean;
  autoStart?: boolean;
  onComplete?: (r: LineResult) => void;
}

const SPEEDS = [1, 2, 4];

interface RunSummary { label: string; rate: number; makespan: number; order: number }

export function ProductionLine({ initial, controls = {}, reveal = 'after-run', charts = true, autoStart = false, onComplete }: Props) {
  const { settings } = useStore();
  const motion = !settings.reducedMotion && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [applied, setApplied] = useState<LineConfig>(initial);
  const [draft, setDraft] = useState<LineConfig>(initial);
  const [myBuffer, setMyBuffer] = useState(Number.isFinite(initial.buffer) ? initial.buffer : 2);
  const r = useMemo(() => simulateLine(applied), [applied]);
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(autoStart);
  const [speed, setSpeed] = useState(1);
  const [history, setHistory] = useState<RunSummary[]>([]);
  const completed = useRef(false);
  const end = r.makespan + 0.6;

  // One simulation clock; playback speed scales presentation only.
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      setT((prev) => {
        const next = Math.min(end, prev + dt * speed);
        if (next >= end) setRunning(false);
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, speed, end]);

  const done = doneAt(r, t);
  const finished = t >= r.makespan;
  useEffect(() => {
    if (finished && !completed.current) {
      completed.current = true;
      play('win');
      setHistory((h) => [
        { label: describe(applied), rate: r.processCapacity, makespan: r.makespan, order: applied.order },
        ...h,
      ].slice(0, 3));
      onComplete?.(r);
    }
  }, [finished, r, applied, onComplete]);

  const restart = (cfg = applied) => {
    completed.current = false;
    setT(0);
    if (cfg !== applied) setApplied(cfg);
    setRunning(true);
    play('click');
  };

  const dirty = JSON.stringify(draft) !== JSON.stringify(applied);
  const setCap = (s: number, v: number) => setDraft((d) => ({ ...d, caps: d.caps.map((c, i) => (i === s ? Math.max(5, Math.min(150, v)) : c)) }));
  const setMach = (s: number, v: number) => setDraft((d) => ({ ...d, machines: d.machines.map((c, i) => (i === s ? v : c)) }));
  const bufferMode = Number.isFinite(draft.buffer) ? 'mine' : 'unlimited';

  const rateSoFar = t > 0 && done > 0 ? (done * applied.batchL * 3600) / t : 0;
  const reveals = reveal === 'always' || (reveal === 'after-run' && finished);
  const stageLabel = (s: number) => (settings.soda && s === 1 ? 'Chill' : STAGE_NAMES[s]);

  return (
    <div className="production">
      <div className="scene-card">
        <div className="scene-bar">
          <div className="row">
            {!running && t === 0 && <button className="tb gold" onClick={() => restart()}>Start brewing</button>}
            {running && <button className="tb" onClick={() => setRunning(false)}>Pause</button>}
            {!running && t > 0 && !finished && <button className="tb gold" onClick={() => setRunning(true)}>Resume</button>}
            {(t > 0) && <button className="tb" onClick={() => restart()}>Restart</button>}
          </div>
          <div className="seg" role="group" aria-label="Playback speed">
            {SPEEDS.map((s) => (
              <button key={s} className={speed === s ? 'on' : ''} aria-pressed={speed === s} onClick={() => setSpeed(s)}>{s}×</button>
            ))}
          </div>
          <div className="clock" aria-live="off">
            <b>{fmt(Math.min(t, r.makespan), 1)} s</b>
            <small>simulated · playback {speed}×</small>
          </div>
        </div>
        <Scene r={r} t={t} motion={motion} soda={settings.soda} revealBottleneck={reveals} />
      </div>

      {(controls.caps || controls.machines?.length || controls.buffer || controls.order) && (
        <div className="parchment controls-card">
          <div className="card-label">Your production plan</div>
          <div className="control-grid">
            {[0, 1, 2].map((s) => (
              <div key={s} className="control-stage">
                <b>{stageLabel(s)}</b>
                {controls.caps ? (
                  <Stepper label={`${stageLabel(s)} capacity per machine`} value={draft.caps[s]} unit="L/h" step={5} onChange={(v) => setCap(s, v)} />
                ) : (
                  <span className="muted">{draft.caps[s]} L/h per machine</span>
                )}
                {controls.machines?.includes(s) && (
                  <label className="check">
                    <input type="checkbox" checked={draft.machines[s] === 2} onChange={(e) => setMach(s, e.target.checked ? 2 : 1)} />
                    Add a 2nd {s === 0 ? 'mash tun' : s === 1 ? (settings.soda ? 'chiller' : 'fermenter') : 'bottler'}
                  </label>
                )}
                <small className="muted">Stage capacity: {fmt(stageCapacityLph(draft, s))} L/h</small>
              </div>
            ))}
            <div className="control-stage">
              {controls.order && (
                <>
                  <b>Order</b>
                  <Stepper label="Batches in the order" value={draft.order} unit="batches" step={1} onChange={(v) => setDraft((d) => ({ ...d, order: Math.max(1, Math.min(24, v)) }))} />
                </>
              )}
              {controls.buffer && (
                <>
                  <b>Waiting area (buffer)</b>
                  <div className="seg small" role="group" aria-label="Buffer size">
                    <button className={bufferMode === 'unlimited' ? 'on' : ''} aria-pressed={bufferMode === 'unlimited'} onClick={() => setDraft((d) => ({ ...d, buffer: Infinity }))}>Unlimited</button>
                    <button className={bufferMode === 'mine' ? 'on' : ''} aria-pressed={bufferMode === 'mine'} onClick={() => setDraft((d) => ({ ...d, buffer: myBuffer }))}>My size</button>
                  </div>
                  {bufferMode === 'mine' && (
                    <Stepper label="Buffer places" value={myBuffer} unit="places" step={1}
                      onChange={(v) => { const n = Math.max(0, Math.min(10, v)); setMyBuffer(n); setDraft((d) => ({ ...d, buffer: n })); }} />
                  )}
                </>
              )}
            </div>
          </div>
          <div className="row between">
            <span className="muted">{dirty ? 'Changes are ready. Run them to see what happens.' : `Running: ${describe(applied)}`}</span>
            <button className="tb green" disabled={!dirty && t === 0} onClick={() => restart(draft)}>Try my production</button>
          </div>
        </div>
      )}

      {charts && (
        <>
          <div className="kpis">
            <div className="kpi"><small>Bottled</small><b>{done} / {applied.order}</b></div>
            <div className="kpi"><small>Output so far</small><b>{done ? `${fmt(rateSoFar, 1)} L/h` : '—'}</b></div>
            <div className="kpi"><small>Steady pace</small><b>{finished ? `1 bottle / ${fmt(steadyInterval(applied), 1)} s` : '…'}</b></div>
            <div className="kpi"><small>Process capacity</small><b>{finished ? `${fmt(r.processCapacity)} L/h` : '?'}</b>
              {finished && <em>min({applied.caps.map((c, i) => fmt(c * applied.machines[i])).join(', ')})</em>}</div>
          </div>
          <div className="charts">
            <div className="parchment"><QueueChart r={r} t={t} soda={settings.soda} /></div>
            <div className="parchment"><MachineTimeChart r={r} t={t} soda={settings.soda} /></div>
          </div>
          {history.length > 1 && (
            <div className="parchment history">
              <div className="card-label">Compare your runs</div>
              <table>
                <thead><tr><th>Plan</th><th>Process capacity</th><th>Order done in</th></tr></thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={i}><td>{i === 0 ? 'Latest: ' : ''}{h.label}</td><td>{fmt(h.rate)} L/h</td><td>{fmt(h.makespan, 1)} s for {h.order}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const describe = (c: LineConfig) =>
  `${c.caps.map((cap, i) => `${fmt(cap)}${c.machines[i] > 1 ? '×2' : ''}`).join(' / ')} L/h · buffer ${Number.isFinite(c.buffer) ? c.buffer : '∞'}`;

export function Stepper({ label, value, unit, step, onChange }: { label: string; value: number; unit: string; step: number; onChange: (v: number) => void }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button aria-label={`Decrease ${label}`} onClick={() => onChange(value - step)}>−</button>
      <input aria-label={label} inputMode="decimal" value={value}
        onChange={(e) => { const v = Number(e.target.value.replace(',', '.')); if (!Number.isNaN(v)) onChange(v); }} />
      <span>{unit}</span>
      <button aria-label={`Increase ${label}`} onClick={() => onChange(value + step)}>+</button>
    </div>
  );
}
