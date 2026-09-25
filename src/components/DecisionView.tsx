import { useState } from 'react';
import type { PlanDecision } from '../content/types';
import { evaluatePlan, fmt, processCapacity, type PlanResult } from '../engine/opm';
import { Rich } from './Rich';
import { propSrc } from '../state/assets';
import { useStore } from '../state/store';
import { play } from '../state/sound';

/** A one-shot plan: the committed release rate decides Bruno's fate. */
export function DecisionView({ d, onCommit }: { d: PlanDecision; onCommit: (release: number, plan: PlanResult, capacity: number) => void }) {
  const { settings } = useStore();
  const [value, setValue] = useState(0);
  const capacity = processCapacity(d.stages);
  const commit = () => {
    const plan = evaluatePlan(value, capacity, d.demand);
    play(plan.kind === 'perfect' ? 'correct' : 'wrong');
    onCommit(value, plan, capacity);
  };
  return (
    <div className="play-grid">
      <div className="parchment stack">
        <div className="card-label">Plan the shift · one try</div>
        <div className="prompt"><Rich text={d.story} as="span" /></div>
        <div className="line" aria-label="Stations">
          {d.stages.map((s, i) => (
            <div key={i} className="stage">
              {(s.machines ?? 1) > 1 && <span className="machines">×{s.machines}</span>}
              {s.prop && <img src={propSrc(s.prop, settings.soda)} alt="" />}
              <b>{s.name}</b>
              <span className="meta">{fmt(s.minutes)} min{(s.machines ?? 1) > 1 ? ` · ${s.machines} machines` : ''}</span>
            </div>
          ))}
        </div>
        <p className="muted">Starting more than the line can handle floods it. Starting more than guests want fills the cellar. Starting too little leaves guests thirsty.</p>
      </div>
      <div className="parchment stack">
        <div className="card-label">{d.prompt}</div>
        <label className="prompt" htmlFor={`${d.id}-rate`}>Release rate: {fmt(value)} {d.unit}</label>
        <input id={`${d.id}-rate`} className="slider" type="range" min={0} max={d.max} step={d.step} value={value} onChange={(e) => setValue(Number(e.target.value))} />
        <div className="unit-row">
          <input className="field" inputMode="decimal" aria-label={`Release rate in ${d.unit}`} value={value}
            onChange={(e) => { const v = Number(e.target.value.replace(',', '.')); if (!Number.isNaN(v)) setValue(Math.max(0, Math.min(d.max, v))); }} />
          <span>{d.unit}</span>
        </div>
        <button className="tb gold wide" onClick={commit}>Commit plan</button>
        <small className="muted">Careful: Bruno lives with this number. Capacity of a station = 60 ÷ minutes × machines.</small>
      </div>
    </div>
  );
}
