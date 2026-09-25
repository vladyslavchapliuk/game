import { useEffect, useMemo, useRef, useState } from 'react';
import { FactoryFloor, type Tool } from './FactoryFloor';
import { Barrel, MachineSprite } from './Sprites';
import {
  MACHINES, MAX_BARRELS, type Mission, type Plan, SHIFT_S, STAGE_LABEL, WARMUP_S, emptyPlan, judgePlan,
  machineById, measuredOutput, planStats, simulateShift, type FactoryVerdict,
} from '../../engine/factory';
import { doneAt, type LineResult, stageTimesUntil } from '../../engine/line';
import { fmt } from '../../engine/opm';
import { Rich } from '../Rich';
import { brunoSrc, type Mood } from '../../state/assets';
import { useStore } from '../../state/store';
import { play } from '../../state/sound';

const SIM_PER_SEC = 60; // one simulated minute per real second at 1×
const SPEEDS = [1, 2, 4, 8];
const clonePlan = (p: Plan): Plan => ({ slots: p.slots.map((r) => [...r]), barrels: [...p.barrels] as [number, number] });

interface Props {
  mission?: Mission;
  onSubmit?: (verdict: FactoryVerdict, plan: Plan) => void;
}

export function FactoryPlanner({ mission, onSubmit }: Props) {
  const { settings } = useStore();
  const free = !mission;
  const [plan, setPlan] = useState<Plan>(() => clonePlan(mission?.start ?? emptyPlan()));
  const [freeDemand, setFreeDemand] = useState(60);
  const demand = mission?.demand ?? freeDemand;
  const budget = mission?.budget ?? Infinity;
  const slotLimit = mission?.slots ?? 4;
  const [tool, setTool] = useState<Tool>({ kind: 'machine', id: MACHINES[0].id });
  const [toast, setToast] = useState<string>();
  const [result, setResult] = useState<LineResult | null>(null);
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(4);
  const [clock, setClock] = useState(0);
  const [tested, setTested] = useState(false);
  const clockRef = useRef(0);

  const stats = useMemo(() => planStats(plan, demand), [plan, demand]);
  const motion = !settings.reducedMotion;

  // Real-time clock drives decorative motion; simulated time advances while running.
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      clockRef.current += dt;
      setClock(motion ? clockRef.current : 0);
      setT((prev) => {
        const next = Math.min(SHIFT_S, prev + dt * SIM_PER_SEC * speed);
        if (next >= SHIFT_S) { setRunning(false); play('win'); }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, speed, motion]);

  const flash = (msg: string) => { setToast(msg); play('wrong'); window.setTimeout(() => setToast(undefined), 2600); };
  const edit = (next: Plan) => { setPlan(next); setResult(null); setRunning(false); setT(0); setTested(false); };

  const onSlot = (stage: number, slot: number) => {
    if (running) return;
    const cur = plan.slots[stage][slot];
    if (tool?.kind === 'remove') {
      if (!cur) return;
      const next = clonePlan(plan); next.slots[stage][slot] = null; edit(next); play('click');
      return;
    }
    if (tool?.kind !== 'machine') return;
    const m = machineById(tool.id);
    if (m.stage !== stage) { flash(`A ${m.name} belongs in the ${STAGE_LABEL[m.stage]} zone.`); return; }
    if (cur === m.id) return;
    const newCost = stats.cost - (cur ? machineById(cur).cost : 0) + m.cost;
    if (newCost > budget) { flash(`Not enough budget: this would cost €${newCost} of €${budget}.`); return; }
    const next = clonePlan(plan); next.slots[stage][slot] = m.id; edit(next); play('click');
  };
  const onStrip = (strip: number) => {
    if (running) return;
    const next = clonePlan(plan);
    if (tool?.kind === 'barrel') next.barrels[strip] = Math.min(MAX_BARRELS, next.barrels[strip] + 1);
    else if (tool?.kind === 'remove') next.barrels[strip] = Math.max(0, next.barrels[strip] - 1);
    else return;
    edit(next); play('click');
  };

  const run = () => {
    const r = simulateShift(plan, demand);
    if (!r) { flash('Every zone needs at least one machine before the shift can start.'); return; }
    setResult(r); setT(0); setRunning(true); setTested(true); play('click');
  };

  const finished = !!result && t >= SHIFT_S;
  const measured = result && t > WARMUP_S ? measuredOutput(result, t) : null;
  const tip = brunoTip(stats, demand, free);

  return (
    <div className="factory">
      <div className="fx-top card">
        <div className="fx-brief">
          <div className="card-label">{free ? 'Free build' : `Mission · ${mission!.title}`}</div>
          {free ? <p>Pick a machine in the <b>Build</b> bar, then click a <b>+</b> slot in its zone. Watch the capacity chart, then test the shift.</p> : <p><Rich text={mission!.story} as="span" /></p>}
        </div>
        <div className="fx-facts">
          <div className="fact"><small>Demand</small>
            {free ? (
              <span className="mini-stepper">
                <button onClick={() => { setFreeDemand((d) => Math.max(10, d - 10)); setResult(null); setT(0); }} aria-label="Lower demand">−</button>
                <b>{freeDemand}</b>
                <button onClick={() => { setFreeDemand((d) => Math.min(200, d + 10)); setResult(null); setT(0); }} aria-label="Raise demand">+</button>
              </span>
            ) : <b>{demand}</b>}<em>L/h</em></div>
          <div className="fact"><small>Equipment</small><b className={stats.cost > budget ? 'bad' : ''}>€{stats.cost}</b><em>{free ? 'no limit' : `of €${budget}`}</em></div>
          <div className="fact"><small>Process capacity</small><b className={stats.processCapacity >= demand ? 'good' : 'bad'}>{stats.processCapacity}</b><em>L/h</em></div>
        </div>
      </div>

      <div className="fx-stage card">
        <div className="fx-toolbar">
          <div className="row">
            {!running && <button className="tb gold" onClick={run}>{tested ? 'Run the shift again' : 'Test the shift'}</button>}
            {running && <button className="tb" onClick={() => setRunning(false)}>Pause</button>}
            {!running && result && !finished && t > 0 && <button className="tb green" onClick={() => setRunning(true)}>Resume</button>}
            {!free && <button className="tb green" disabled={running || stats.missing.length > 0} onClick={() => onSubmit?.(judgePlan(plan, mission!), plan)}>Submit plan to Bruno</button>}
          </div>
          <div className="seg" role="group" aria-label="Playback speed">
            {SPEEDS.map((s) => <button key={s} className={speed === s ? 'on' : ''} aria-pressed={speed === s} onClick={() => setSpeed(s)}>{s}×</button>)}
          </div>
          <div className="clock">
            <b>{result ? `${Math.floor(t / 60)} min` : 'Planning'}</b>
            <small>{result ? (t < WARMUP_S ? 'warm-up (first 30 min)' : t < SHIFT_S ? 'measuring output' : 'shift over') : `1 real second = ${speed} min`}</small>
          </div>
        </div>
        <div className="fx-floor-wrap">
          <FactoryFloor plan={plan} slotLimit={slotLimit} demand={demand} tool={tool} result={result} t={t} clock={clock}
            running={running} onSlot={onSlot} onStrip={onStrip} stageCaps={stats.stageCaps} />
          {toast && <div className="fx-toast" role="alert">{toast}</div>}
        </div>
        <div className="fx-bruno" aria-live="polite">
            <img src={brunoSrc(tip.mood, settings.soda)} alt="" />
            <p>{tip.text}</p>
          </div>
      </div>

      <div className="fx-panels">
        <div className="card">
          <div className="card-label">Build</div>
          <div className="fx-catalog">
            {[0, 1, 2].map((s) => (
              <div key={s} className="fx-cat-group">
                <b>{STAGE_LABEL[s]}</b>
                {MACHINES.filter((m) => m.stage === s).map((m) => {
                  const on = tool?.kind === 'machine' && tool.id === m.id;
                  return (
                    <button key={m.id} className={`fx-tool ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => setTool({ kind: 'machine', id: m.id })}>
                      <svg viewBox="-44 -44 88 88" aria-hidden="true"><MachineSprite id={m.id} active={false} clock={0} fill={0.6} /></svg>
                      <span><b>{m.name}</b><small>{m.cap} L/h · €{m.cost}</small><small className="muted">€{fmt(m.cost / m.cap, 1)} per L/h</small></span>
                    </button>
                  );
                })}
              </div>
            ))}
            <div className="fx-cat-group">
              <b>Tools</b>
              <button className={`fx-tool ${tool?.kind === 'barrel' ? 'on' : ''}`} aria-pressed={tool?.kind === 'barrel'} onClick={() => setTool({ kind: 'barrel' })}>
                <svg viewBox="-22 -22 44 44" aria-hidden="true"><Barrel full={false} /></svg><span><b>Barrel</b><small>1 buffer place · free</small><small className="muted">click a buffer strip</small></span>
              </button>
              <button className={`fx-tool ${tool?.kind === 'remove' ? 'on' : ''}`} aria-pressed={tool?.kind === 'remove'} onClick={() => setTool({ kind: 'remove' })}>
                <span className="fx-emoji" aria-hidden="true">✕</span><span><b>Remove</b><small>full refund</small><small className="muted">click a machine or strip</small></span>
              </button>
              <button className="fx-tool" disabled={running} onClick={() => edit(clonePlan(mission?.start ?? emptyPlan()))}>
                <span className="fx-emoji" aria-hidden="true">↺</span><span><b>Reset hall</b><small>back to the start</small></span>
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <CapacityChart plan={plan} demand={demand} stats={stats} />
          <p className="muted fx-note">Process capacity = min(<b>{stats.stageCaps.join(', ')}</b>) = <b>{stats.processCapacity} L/h</b>. Output = min(demand, process capacity).</p>
        </div>

        <div className="card">
          {stats.processCapacity > 0 && stats.missing.length === 0 && (
            <a className="season-link" href={`#/sandbox/season?c=${stats.processCapacity * 8}`}>
              <b>Plan a season with this hall →</b>
              <span>Capacity c = {stats.processCapacity} L/h × 8 h = {stats.processCapacity * 8} L per period. Opens the season planner (aggregate planning).</span>
            </a>
          )}
          <div className="card-label">Shift report</div>
          {!result && <p className="muted">Press <b>Test the shift</b> to run 90 minutes of production. The first 30 minutes warm the line up; the next 60 are measured.</p>}
          {result && (
            <>
              <div className="fx-kpis">
                <div><small>Bottled so far</small><b>{doneAt(result, t)} L</b></div>
                <div><small>Measured output</small><b>{measured === null ? '…' : `${fmt(measured, 1)} L/h`}</b></div>
                <div><small>Waiting at silo</small><b>{result.batches.filter((b) => b.visits[0] && b.visits[0].arrive <= t && !(b.visits[0].start <= t)).length}</b></div>
              </div>
              <UtilBars result={result} t={t} />
              {finished && measured !== null && (
                <p className={`feedback ${measured >= demand - 1 ? 'ok' : 'bad'}`} style={{ marginTop: 10 }}>
                  <span className="icon">{measured >= demand - 1 ? '✓' : '!'}</span>
                  <span>{measured >= demand - 1
                    ? `The hall delivered ${fmt(measured, 1)} L/h: demand met.${free ? '' : ' Is it the cheapest way? Submit when you think so.'}`
                    : `Only ${fmt(measured, 1)} L/h of ${demand}. ${STAGE_LABEL[stats.bottleneck]} is the bottleneck; work piles up in front of it.`}</span>
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function brunoTip(stats: ReturnType<typeof planStats>, demand: number, free: boolean): { mood: Mood; text: string } {
  if (stats.missing.length) {
    const names = stats.missing.map((s) => STAGE_LABEL[s].toLowerCase());
    const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
    return { mood: 'worried', text: `The ${list} zone${names.length > 1 ? 's are' : ' is'} empty. Beer needs all three steps!` };
  }
  if (stats.processCapacity < demand) {
    const s = stats.bottleneck;
    return { mood: 'sweaty', text: `${STAGE_LABEL[s]} is the bottleneck: ${stats.stageCaps[s]} of ${demand} L/h. Add capacity there.` };
  }
  const over = stats.stageCaps.map((c, i) => [c - demand, i]).sort((a, b) => b[0] - a[0])[0];
  if (!free && over[0] >= 20) return { mood: 'focused', text: `${STAGE_LABEL[over[1]]} has ${over[0]} L/h more than needed. Could a cheaper mix still cover ${demand}?` };
  return { mood: 'proud', text: `Every stage covers ${demand} L/h. Test the shift${free ? '' : ', then submit'}!` };
}

function CapacityChart({ plan, demand, stats }: { plan: Plan; demand: number; stats: ReturnType<typeof planStats> }) {
  const max = Math.max(demand * 1.5, ...stats.stageCaps) + 5;
  const W = 340; const L = 66; const R = 12; const rowH = 40;
  const x = (v: number) => L + (v / max) * (W - L - R);
  return (
    <figure className="chart" style={{ margin: 0 }}>
      <figcaption><b>Capacity plan</b><span>Each block is one machine. The line needs every stage past the demand mark.</span></figcaption>
      <svg viewBox={`0 0 ${W} ${rowH * 3 + 40}`} role="img" aria-label={`Stage capacities ${stats.stageCaps.join(', ')} L/h against demand ${demand} L/h.`}>
        {[0, 1, 2].map((s) => {
          let acc = 0;
          const y = 14 + s * rowH;
          const cap = stats.stageCaps[s];
          return (
            <g key={s}>
              <text x={0} y={y + 18} className="tick" style={{ fontSize: 14, fontWeight: 800 }}>{STAGE_LABEL[s]}</text>
              <rect x={L} y={y + 4} width={W - L - R} height={20} rx={4} className="cap-track" />
              {plan.slots[s].filter(Boolean).map((id, i) => {
                const m = machineById(id!);
                const x0 = x(acc); acc += m.cap;
                return <rect key={i} x={x0 + (i ? 1 : 0)} y={y + 4} width={Math.max(2, x(acc) - x0 - 2)} height={20} rx={4} className={cap >= demand ? 'cap-ok' : 'cap-short'} />;
              })}
              {cap < demand && <rect x={x(cap)} y={y + 4} width={x(demand) - x(cap)} height={20} className="cap-gap" />}
              <text x={Math.min(x(Math.max(cap, 0)) + 6, W - R - 40)} y={y + 19} className="end-label">{cap}{s === stats.bottleneck && cap < demand ? ' ◀' : ''}</text>
            </g>
          );
        })}
        <line x1={x(demand)} x2={x(demand)} y1={8} y2={rowH * 3 + 16} className="demand-line" />
        <text x={x(demand)} y={rowH * 3 + 34} textAnchor="middle" className="tip-title" style={{ fontSize: 13 }}>demand {demand} L/h</text>
      </svg>
    </figure>
  );
}

function UtilBars({ result, t }: { result: LineResult; t: number }) {
  const now = Math.max(1, Math.min(t, SHIFT_S));
  const times = stageTimesUntil(result, now);
  return (
    <div className="bars" aria-label="Machine time so far">
      {[0, 1, 2].map((s) => {
        const denom = now * Math.max(1, result.config.machines[s]);
        const busy = times[s].busy / denom;
        const blocked = times[s].blocked / denom;
        return (
          <div key={s} className="bar-row" style={{ gridTemplateColumns: '70px 1fr 48px' }}>
            <span className="bar-name">{STAGE_LABEL[s]}</span>
            <span className="bar-track"><i className="busy" style={{ width: `${busy * 100}%` }} />{blocked > 0.005 && <i className="blocked" style={{ width: `${blocked * 100}%` }} />}</span>
            <span className="bar-value">{Math.round(busy * 100)}%</span>
          </div>
        );
      })}
      <div className="legend"><span><i className="key busy" />Working</span><span><i className="key blocked" />Blocked</span><span><i className="key idle" />Idle</span></div>
    </div>
  );
}
