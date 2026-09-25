// The Bar Counter: a live single-server queue. Guests arrive at random, Bruno
// serves one at a time (FIFO). Charts compare one simulated shift with the
// lecture's long-run formulas. Colors: validated chart tokens --s1 / --s2.
import { useEffect, useMemo, useState } from 'react';
import { makeRng, newSeed } from '../../engine/rng';
import {
  type QueueParams, type StaffMission, type StaffVerdict, judgeStaffing, lineSeries, queueMetrics, simulateQueue, stateAt,
} from '../../engine/stochastic';
import { fmt } from '../../engine/opm';
import { brunoSrc, propSrc } from '../../state/assets';
import { useStore } from '../../state/store';
import { play } from '../../state/sound';
import { Stepper } from '../production/ProductionLine';
import { Rich, Tex } from '../Rich';

export interface BarSetup { lambdaPerHour: number; serviceMin: number; cva2: number; cvs2: number }
export interface QueueControls { lambda?: boolean; service?: boolean; cva?: boolean; cvs?: boolean }

interface Props {
  initial: BarSetup;
  controls?: QueueControls;
  /** When to show the formula values: always, after the first finished shift, or never. */
  theory?: 'always' | 'after-run' | 'never';
  /** Shift length in hours. */
  hours?: number;
  mission?: StaffMission;
  onRun?: () => void;
  onSubmit?: (v: StaffVerdict) => void;
}

const toParams = (s: BarSetup): QueueParams => ({ lambda: s.lambdaPerHour / 60, mu: 1 / s.serviceMin, cva2: s.cva2, cvs2: s.cvs2 });
const CV_CHOICES: [number, string][] = [[0, 'clockwork'], [0.25, 'steady'], [1, 'random'], [2, 'bursty']];
const SPEEDS = [1, 4, 16];
const MIN_PER_SEC = 2;
const GUESTS = ['fox', 'rabbit', 'capybara'];

export function BarQueue({ initial, controls = {}, theory = 'after-run', hours = 8, mission, onRun, onSubmit }: Props) {
  const { settings } = useStore();
  const motion = !settings.reducedMotion && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [draft, setDraft] = useState<BarSetup>(initial);
  const [applied, setApplied] = useState<BarSetup>(initial);
  const [choice, setChoice] = useState<number | null>(null);
  const [seed, setSeed] = useState(newSeed);
  const horizon = hours * 60;
  const params = useMemo(() => toParams(applied), [applied]);
  const sim = useMemo(() => simulateQueue(params, horizon, makeRng(seed)), [params, horizon, seed]);
  const end = Math.max(horizon, sim.customers.length ? sim.customers[sim.customers.length - 1].depart : 0);
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(4);
  const [runs, setRuns] = useState(0);
  const [finishedOnce, setFinishedOnce] = useState(false);
  const theoryM = queueMetrics(params);

  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      setT((prev) => {
        const next = Math.min(end, prev + dt * speed * MIN_PER_SEC);
        if (next >= end) setRunning(false);
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, speed, end]);

  const finished = t >= end && end > 0;
  useEffect(() => {
    if (!finished) return;
    setRuns((r) => r + 1);
    setFinishedOnce(true);
    play('win');
    onRun?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  const start = (setup = draft, fresh = true) => {
    if (JSON.stringify(setup) !== JSON.stringify(applied)) setApplied(setup);
    if (fresh) setSeed(newSeed());
    setT(0);
    setRunning(true);
    play('click');
  };
  const skipToEnd = () => { setRunning(false); setT(end); };

  const state = stateAt(sim, t);
  const servedSoFar = sim.customers.filter((c) => c.depart <= t);
  const startedSoFar = sim.customers.filter((c) => c.start <= t);
  const avgWaitSoFar = startedSoFar.length ? startedSoFar.reduce((s, c) => s + c.start - c.arrive, 0) / startedSoFar.length : 0;
  const busySoFar = t > 0 ? sim.customers.reduce((s, c) => s + Math.max(0, Math.min(t, c.depart) - Math.min(t, c.start)), 0) / t : 0;
  const showTheory = theory === 'always' || (theory === 'after-run' && finishedOnce);
  const dirty = JSON.stringify(draft) !== JSON.stringify(applied);
  const anyControl = controls.lambda || controls.service || controls.cva || controls.cvs;

  const pickOption = (i: number) => {
    if (!mission) return;
    const o = mission.options[i];
    const setup = { lambdaPerHour: mission.lambdaPerHour, serviceMin: o.serviceMin, cva2: mission.cva2, cvs2: o.cvs2 };
    setChoice(i);
    setDraft(setup);
    setApplied(setup);
    setSeed(newSeed());
    setT(0);
    setRunning(false);
    play('click');
  };

  return (
    <div className="bar-queue stack">
      {mission && (
        <div className="parchment stack">
          <div className="row between">
            <div>
              <div className="card-label">Hire for tonight</div>
              <b>{mission.lambdaPerHour} guests per hour, arrivals with <Tex tex={`cv_a^2 = ${fmt(mission.cva2, 2)}`} />. Target: <Tex tex={`E[W_${mission.metric === 'wq' ? 'q' : 's'}] \\le ${fmt(mission.target, 1)}`} /> min.</b>
            </div>
            <span className="muted">Test any option first. Only the formula decides the verdict.</span>
          </div>
          <div className="opt-grid" role="radiogroup" aria-label="Bartender options">
            {mission.options.map((o, i) => (
              <button key={o.name} role="radio" aria-checked={choice === i} className={`opt-card ${choice === i ? 'on' : ''}`} onClick={() => pickOption(i)}>
                <b>{o.name}</b>
                <small>{o.note}</small>
                <span className="opt-facts">
                  <span><Tex tex={`1/\\mu = ${fmt(o.serviceMin, 1)}`} /> min</span>
                  <span><Tex tex={`cv_s^2 = ${fmt(o.cvs2, 2)}`} /></span>
                </span>
                <span className="opt-cost">€{o.cost} per night</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="scene-card">
        <div className="scene-bar">
          <div className="row">
            {!running && t === 0 && <button className="tb gold" disabled={!!mission && choice === null} onClick={() => start(draft, false)}>Open the bar</button>}
            {running && <button className="tb" onClick={() => setRunning(false)}>Pause</button>}
            {!running && t > 0 && !finished && <button className="tb gold" onClick={() => setRunning(true)}>Resume</button>}
            {t > 0 && <button className="tb" onClick={() => start(applied, true)}>New shift</button>}
            {t > 0 && !finished && <button className="tb" onClick={skipToEnd}>Skip to closing</button>}
          </div>
          <div className="seg" role="group" aria-label="Playback speed">
            {SPEEDS.map((s) => <button key={s} className={speed === s ? 'on' : ''} aria-pressed={speed === s} onClick={() => setSpeed(s)}>{s}×</button>)}
          </div>
          <div className="clock" aria-live="off">
            <b>{clock(Math.min(t, end))}</b>
            <small>{hours} h shift · {fmt(speed * MIN_PER_SEC)} min per second</small>
          </div>
        </div>
        <BarScene t={t} line={state.line} serving={state.serving} served={state.done} mean={1 / params.mu} motion={motion} soda={settings.soda} closed={t >= horizon} />
      </div>

      {anyControl && (
        <div className="parchment controls-card">
          <div className="card-label">Your bar</div>
          <div className="control-grid">
            {controls.lambda && (
              <div className="control-stage"><b>Arrivals <Tex tex="\lambda" /></b>
                <Stepper label="Guests per hour" value={draft.lambdaPerHour} unit="per h" step={1} onChange={(v) => setDraft((d) => ({ ...d, lambdaPerHour: clamp(v, 1, 40) }))} /></div>
            )}
            {controls.service && (
              <div className="control-stage"><b>Service time <Tex tex="1/\mu" /></b>
                <Stepper label="Minutes per guest" value={draft.serviceMin} unit="min" step={0.5} onChange={(v) => setDraft((d) => ({ ...d, serviceMin: clamp(v, 0.5, 30) }))} /></div>
            )}
            {controls.cva && <CvPicker label="Arrival variability" tex="cv_a^2" value={draft.cva2} onChange={(v) => setDraft((d) => ({ ...d, cva2: v }))} />}
            {controls.cvs && <CvPicker label="Service variability" tex="cv_s^2" value={draft.cvs2} onChange={(v) => setDraft((d) => ({ ...d, cvs2: v }))} />}
          </div>
          <div className="row between">
            <span className="muted">{dirty ? 'Changes are ready. Open a new shift to see them.' : <Rich text={`Now: ${describe(applied)}`} as="span" />}</span>
            <button className="tb green" disabled={!dirty && t === 0} onClick={() => start(draft, true)}>Try this bar</button>
          </div>
        </div>
      )}

      <div className="kpis">
        <div className="kpi"><small>In line now</small><b>{state.line.length}</b><em>longest line: {finished ? sim.maxLine : '…'}</em></div>
        <div className="kpi"><small>Average wait so far</small><b>{startedSoFar.length ? `${fmt(avgWaitSoFar, 1)} min` : '—'}</b>
          {showTheory && <em>formula <Tex tex="E[W_q]" /> = {theoryM.stable ? `${fmt(theoryM.wq, 1)} min` : '∞'}</em>}</div>
        <div className="kpi"><small>Bruno busy</small><b>{t > 0 ? `${Math.round(busySoFar * 100)}%` : '—'}</b>
          {showTheory && <em><Tex tex="\rho = \lambda / \mu" /> = {fmt(theoryM.rho * 100, 1)}%</em>}</div>
        <div className="kpi"><small>Guests served</small><b>{servedSoFar.length}</b>
          {showTheory && <em><Tex tex="E[L_s]" /> = {theoryM.stable ? fmt(theoryM.ls, 2) : '∞'} in the bar</em>}</div>
      </div>
      {!theoryM.stable && <div className="feedback bad" role="status"><span className="icon">!</span><div><b>Unstable:</b> <Tex tex="\rho \ge 1" />. Guests arrive faster than Bruno can serve, so the line grows without limit.</div></div>}

      <div className="charts">
        <div className="parchment"><LineChart sim={sim} t={t} horizon={horizon} /></div>
        <div className="parchment">
          {theory === 'never'
            ? <ShiftSummary sim={sim} finished={finished} runs={runs} />
            : <HockeyChart params={params} simWait={finished ? sim.avgWq : null} showTheory={showTheory} />}
        </div>
      </div>

      {mission && onSubmit && (
        <div className="parchment row between">
          <span>{choice === null ? 'Pick one option above.' : <>You picked <b>{mission.options[choice].name}</b> for €{mission.options[choice].cost}.</>}</span>
          <button className="tb green" disabled={choice === null} onClick={() => choice !== null && onSubmit(judgeStaffing(mission, choice))}>Hire and open the bar</button>
        </div>
      )}
    </div>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clock = (min: number) => {
  const h = 18 + Math.floor(min / 60);
  const m = Math.floor(min % 60);
  return `${String(h % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};
const describe = (s: BarSetup) => `${s.lambdaPerHour} guests/h · ${fmt(s.serviceMin, 1)} min each · $cv_a^2 = ${fmt(s.cva2, 2)}$ · $cv_s^2 = ${fmt(s.cvs2, 2)}$`;

function CvPicker({ label, tex, value, onChange }: { label: string; tex: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="control-stage">
      <b>{label} <Tex tex={tex} /></b>
      <div className="seg small" role="group" aria-label={label}>
        {CV_CHOICES.map(([v, name]) => (
          <button key={v} className={value === v ? 'on' : ''} aria-pressed={value === v} onClick={() => onChange(v)}>{fmt(v, 2)} <small>{name}</small></button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function BarScene({ t, line, serving, served, mean, motion, soda, closed }: {
  t: number; line: { id: number; arrive: number }[]; serving?: { id: number; start: number; depart: number }; served: number; mean: number;
  motion: boolean; soda: boolean; closed: boolean;
}) {
  const W = 960;
  const H = 300;
  const SLOTS = 9;
  const shown = line.slice(0, SLOTS);
  const extra = line.length - shown.length;
  const progress = serving ? (t - serving.start) / Math.max(1e-6, serving.depart - serving.start) : 0;
  const mood = (wait: number) => (wait > 3 * mean ? 'impatient' : 'neutral');
  const guest = (id: number) => GUESTS[id % GUESTS.length];
  return (
    <svg className={`bar-scene ${motion ? 'anim' : ''}`} viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`${line.length} guests in line, ${serving ? 'one being served' : 'Bruno is idle'}, ${served} served.`}>
      <rect x={0} y={228} width={W} height={72} className="bar-floor" />
      {/* counter */}
      <image href={brunoSrc(serving ? 'focused' : 'neutral', soda)} x={748} y={40} width={124} height={136} />
      <rect x={720} y={150} width={220} height={98} rx={10} className="bar-counter" />
      <rect x={712} y={140} width={236} height={18} rx={6} className="bar-top" />
      <image href={propSrc('tap', soda)} x={870} y={70} width={70} height={74} />
      {serving && (
        <g transform="translate(700 70)">
          <circle r={22} className="svc-track" />
          <circle r={22} className="svc-ring" style={{ strokeDasharray: `${2 * Math.PI * 22}`, strokeDashoffset: `${2 * Math.PI * 22 * (1 - progress)}` }} transform="rotate(-90)" />
          <image href={propSrc('mug', soda)} x={-14} y={-15} width={28} height={30} />
        </g>
      )}
      {serving && (
        <g className="guest" style={{ transform: 'translate(622px, 150px)' }}>
          <image href={`assets/characters/guest_${guest(serving.id)}_happy.svg`} width={80} height={88} />
        </g>
      )}
      {shown.map((c, i) => (
        <g key={c.id} className="guest" style={{ transform: `translate(${540 - i * 58}px, ${156 + (i % 2) * 6}px)` }}>
          <image href={`assets/characters/guest_${guest(c.id)}_${mood(t - c.arrive)}.svg`} width={72} height={79} />
        </g>
      ))}
      {extra > 0 && (
        <g transform="translate(34 150)">
          <rect width={64} height={36} rx={18} className="more-pill" />
          <text x={32} y={24} textAnchor="middle" className="more-text">+{extra}</text>
        </g>
      )}
      <g transform="translate(24 24)">
        <rect width={170} height={44} rx={10} className="served-pill" />
        <image href={propSrc('mug', soda)} x={10} y={7} width={28} height={30} />
        <text x={46} y={28} className="served-text">{served} served</text>
      </g>
      {closed && (
        <g transform="translate(24 78)">
          <rect width={170} height={34} rx={10} className="closed-pill" />
          <text x={85} y={22} textAnchor="middle" className="closed-text">Doors closed</text>
        </g>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------

const CW = 560;
const CH = 240;
const PAD = { l: 44, r: 60, t: 16, b: 36 };

function LineChart({ sim, t, horizon }: { sim: ReturnType<typeof simulateQueue>; t: number; horizon: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const end = Math.max(horizon, sim.customers.length ? sim.customers[sim.customers.length - 1].depart : 0);
  const dt = end / 240;
  const series = useMemo(() => lineSeries(sim, dt, end), [sim, dt, end]);
  const now = Math.min(t, end);
  const visible = series.filter((p) => p.t <= now);
  const maxN = Math.max(4, ...series.map((p) => p.n));
  const x = (m: number) => PAD.l + (m / end) * (CW - PAD.l - PAD.r);
  const y = (n: number) => CH - PAD.b - (n / maxN) * (CH - PAD.t - PAD.b);
  let d = '';
  visible.forEach((p, i) => { d += i === 0 ? `M${x(p.t)} ${y(p.n)}` : `H${x(p.t)}V${y(p.n)}`; });
  const lastN = visible.length ? visible[visible.length - 1].n : 0;
  const stepY = maxN > 12 ? Math.ceil(maxN / 6) : maxN > 6 ? 2 : 1;
  const ticksY = Array.from({ length: Math.floor(maxN / stepY) + 1 }, (_, i) => i * stepY);
  const ticksX = Array.from({ length: Math.floor(end / 60) + 1 }, (_, i) => i * 60);
  const hp = hover !== null ? series[Math.min(series.length - 1, Math.max(0, Math.round(hover / dt)))] : null;
  return (
    <figure className="chart">
      <figcaption>
        <b>Guests waiting in line</b>
        <span>Random arrivals make the line jump even when Bruno is fast enough on average.</span>
      </figcaption>
      <svg viewBox={`0 0 ${CW} ${CH}`} role="img" aria-label={`Guests in line over the shift. Now ${lastN}. Longest ${sim.maxLine}.`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - box.left) / box.width) * CW;
          const m = ((px - PAD.l) / (CW - PAD.l - PAD.r)) * end;
          setHover(m >= 0 && m <= now ? m : null);
        }}>
        {ticksY.map((n) => (
          <g key={n}>
            <line x1={PAD.l} x2={CW - PAD.r} y1={y(n)} y2={y(n)} className="grid" />
            <text x={PAD.l - 8} y={y(n) + 4} textAnchor="end" className="tick">{n}</text>
          </g>
        ))}
        {ticksX.map((m) => <text key={m} x={x(m)} y={CH - PAD.b + 20} textAnchor="middle" className="tick">{m / 60} h</text>)}
        <line x1={x(horizon)} x2={x(horizon)} y1={PAD.t} y2={CH - PAD.b} className="cap-line" />
        <text x={x(horizon) + 4} y={PAD.t + 10} className="tick">closing</text>
        {d && <path d={d} className="line s1" />}
        {now > 0 && <circle cx={x(now)} cy={y(lastN)} r={5} className="dot s1" />}
        {now > 0 && <text x={x(now) + 9} y={y(lastN) + 4} className="end-label">{lastN}</text>}
        {hp && (
          <g>
            <line x1={x(hp.t)} x2={x(hp.t)} y1={PAD.t} y2={CH - PAD.b} className="crosshair" />
            <g transform={`translate(${Math.min(x(hp.t) + 8, CW - 130)} ${PAD.t + 4})`}>
              <rect width={120} height={42} rx={8} className="tip" />
              <text x={10} y={18} className="tip-title">{clock(hp.t)}</text>
              <text x={10} y={34} className="tip-text">{hp.n} in line</text>
            </g>
          </g>
        )}
      </svg>
    </figure>
  );
}

/** E[W_q] as a function of ρ for the current variability and service time. */
function HockeyChart({ params, simWait, showTheory }: { params: QueueParams; simWait: number | null; showTheory: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const rho = params.lambda / params.mu;
  const wqAt = (r: number) => queueMetrics({ ...params, lambda: r * params.mu }).wq;
  const cur = rho < 1 ? wqAt(rho) : Infinity;
  const yMax = niceMax(Math.max(20, Math.min(240, Number.isFinite(cur) ? cur * 1.6 : 120), simWait ? simWait * 1.2 : 0));
  const x = (r: number) => PAD.l + r * (CW - PAD.l - PAD.r);
  const y = (w: number) => CH - PAD.b - (Math.min(w, yMax) / yMax) * (CH - PAD.t - PAD.b);
  const pts: string[] = [];
  for (let r = 0; r <= 0.995; r += 0.005) {
    const w = wqAt(r);
    if (w > yMax * 1.05) { pts.push(`${x(r)},${y(yMax)}`); break; }
    pts.push(`${x(r)},${y(w)}`);
  }
  const ticksY = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * yMax));
  const hr = hover;
  return (
    <figure className="chart">
      <figcaption>
        <b>Waiting time vs. utilization</b>
        <span>The closer <Tex tex="\rho" /> gets to 1, the faster the wait explodes, and more variability makes it worse.</span>
      </figcaption>
      <div className="legend">
        <span><i className="key s1" />Formula <Tex tex="E[W_q]" /></span>
        <span><i className="key s2" />This shift (simulated)</span>
      </div>
      <svg viewBox={`0 0 ${CW} ${CH}`} role="img"
        aria-label={`Waiting time curve. Current utilization ${fmt(rho * 100, 1)}%, formula wait ${Number.isFinite(cur) ? fmt(cur, 1) : 'infinite'} minutes${simWait !== null ? `, simulated ${fmt(simWait, 1)} minutes` : ''}.`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - box.left) / box.width) * CW;
          const r = (px - PAD.l) / (CW - PAD.l - PAD.r);
          setHover(r >= 0 && r < 0.99 ? r : null);
        }}>
        {ticksY.map((w) => (
          <g key={w}>
            <line x1={PAD.l} x2={CW - PAD.r} y1={y(w)} y2={y(w)} className="grid" />
            <text x={PAD.l - 8} y={y(w) + 4} textAnchor="end" className="tick">{w}</text>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((r) => <text key={r} x={x(r)} y={CH - PAD.b + 20} textAnchor="middle" className="tick">{Math.round(r * 100)}%</text>)}
        <text x={PAD.l} y={PAD.t - 5} className="tick">min</text>
        <line x1={x(1)} x2={x(1)} y1={PAD.t} y2={CH - PAD.b} className="cap-line" />
        <text x={x(1) + 4} y={PAD.t + 10} className="tick">ρ = 1</text>
        <polyline points={pts.join(' ')} className="line s1" fill="none" />
        {rho < 1 && showTheory && <circle cx={x(rho)} cy={y(cur)} r={6} className="dot s1" />}
        {rho < 1 && !showTheory && <line x1={x(rho)} x2={x(rho)} y1={PAD.t} y2={CH - PAD.b} className="crosshair" />}
        {simWait !== null && rho < 1.2 && <circle cx={x(Math.min(rho, 0.995))} cy={y(simWait)} r={6} className="dot s2" />}
        {simWait !== null && rho < 1.2 && <text x={x(Math.min(rho, 0.995)) - 10} y={y(simWait) - 10} textAnchor="end" className="end-label">{fmt(simWait, 1)}</text>}
        {showTheory && rho < 1 && <text x={x(rho) + 10} y={y(cur) + 16} className="end-label">{fmt(cur, 1)}</text>}
        {hr !== null && (
          <g>
            <line x1={x(hr)} x2={x(hr)} y1={PAD.t} y2={CH - PAD.b} className="crosshair" />
            <g transform={`translate(${Math.min(x(hr) + 8, CW - 150)} ${PAD.t + 4})`}>
              <rect width={140} height={42} rx={8} className="tip" />
              <text x={10} y={18} className="tip-title">ρ = {fmt(hr * 100, 1)}%</text>
              <text x={10} y={34} className="tip-text">E[Wq] = {fmt(wqAt(hr), 1)} min</text>
            </g>
          </g>
        )}
      </svg>
    </figure>
  );
}

function ShiftSummary({ sim, finished, runs }: { sim: ReturnType<typeof simulateQueue>; finished: boolean; runs: number }) {
  return (
    <div className="stack">
      <div className="card-label">This shift</div>
      {finished ? (
        <table className="mini-table">
          <tbody>
            <tr><td>Guests served</td><td>{sim.customers.length}</td></tr>
            <tr><td>Average wait in line</td><td>{fmt(sim.avgWq, 1)} min</td></tr>
            <tr><td>Average time in the bar</td><td>{fmt(sim.avgWs, 1)} min</td></tr>
            <tr><td>Bruno busy</td><td>{Math.round(sim.busy * 100)}%</td></tr>
            <tr><td>Longest line</td><td>{sim.maxLine}</td></tr>
          </tbody>
        </table>
      ) : <p className="muted">Run a shift to see its numbers. One shift is random: {runs > 1 ? 'you saw how much they move between shifts.' : 'run a few and compare.'}</p>}
      <p className="muted">The formula gives the long-run average. A single shift can land well above or below it.</p>
    </div>
  );
}

const niceMax = (v: number) => {
  const steps = [20, 40, 60, 80, 100, 120, 160, 200, 240, 300, 400];
  return steps.find((s) => s >= v) ?? Math.ceil(v / 100) * 100;
};
