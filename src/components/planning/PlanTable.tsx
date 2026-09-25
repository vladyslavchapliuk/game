// Period-by-period production plan in the lecture's table layout, with a chart.
// Aggregate planning: d_t, X_t, L_t, (B_t), O_t and their costs.
// Lot sizing: d_t, Γ_t, X_t, L_t, setup and holding costs.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  type AggregateData, type LotData, type PlanVerdict, chasePlan, evaluateAggregate, evaluateLots, judgeAggregate, judgeLots,
  levelPlan, lotAtCapacity, lotForLot, quantitiesFromSetups, solveAggregate, solveLots,
} from '../../engine/planning';
import { Tex } from '../Rich';
import { play } from '../../state/sound';

export type Preset = 'chase' | 'level' | 'optimal' | 'clear' | 'lfl' | 'cap';

const n0 = (x: number) => Math.round(x).toLocaleString('en-US');
const eur = (x: number) => `${n0(x)} EUR`;

interface CommonProps {
  editable?: boolean;
  presets?: Preset[];
  /** Show the cheapest possible cost as a target ("par"). */
  showPar?: boolean;
  /** Sandbox: edit demand and cost parameters. */
  paramsEditable?: boolean;
  submitLabel?: string;
  onSubmit?: (verdict: PlanVerdict, X: number[]) => void;
  note?: ReactNode;
}

type Props =
  | (CommonProps & { model: 'aggregate'; data: AggregateData; initial: number[] })
  | (CommonProps & { model: 'lotsize'; data: LotData; initial: number[] });

export function PlanTable(props: Props) {
  const { editable = false, presets = [], showPar = false, paramsEditable = false, submitLabel = 'Submit plan to Bruno', onSubmit, note } = props;
  const [data, setData] = useState(props.data);
  const [X, setX] = useState<number[]>(props.initial);
  const [draft, setDraft] = useState<string[]>(props.initial.map(String));
  const [hover, setHover] = useState<number | null>(null);
  const agg = props.model === 'aggregate';

  useEffect(() => { setData(props.data); }, [props.data]);
  useEffect(() => { setX(props.initial); setDraft(props.initial.map(String)); }, [props.initial]);

  const setPlan = (next: number[]) => { setX(next); setDraft(next.map(String)); };

  const ev = useMemo(() => (agg ? evaluateAggregate(data as AggregateData, X) : evaluateLots(data as LotData, X)), [agg, data, X]);
  const par = useMemo(() => (agg ? solveAggregate(data as AggregateData) : solveLots(data as LotData)), [agg, data]);

  const applyPreset = (p: Preset) => {
    play('click');
    if (p === 'clear') return setPlan(data.demand.map(() => 0));
    if (p === 'optimal') return setPlan(par.X);
    if (agg) {
      const d = data as AggregateData;
      setPlan(p === 'chase' ? chasePlan(d) : levelPlan(d));
    } else {
      const d = data as LotData;
      setPlan(p === 'lfl' ? lotForLot(d) : lotAtCapacity(d));
    }
  };

  const setCell = (i: number, raw: string) => {
    const nextDraft = [...draft]; nextDraft[i] = raw; setDraft(nextDraft);
    const v = Number(raw.replace(',', '.'));
    if (raw.trim() === '' || (!Number.isNaN(v) && v >= 0)) {
      const next = [...X]; next[i] = raw.trim() === '' ? 0 : Math.round(v); setX(next);
    }
  };
  const toggleSetup = (i: number) => {
    if (!editable) return;
    const setups = X.map((x) => x > 0);
    setups[i] = !setups[i];
    setPlan(quantitiesFromSetups(data as LotData, setups));
    play('click');
  };
  const setDemand = (i: number, raw: string) => {
    const v = Math.max(0, Math.round(Number(raw) || 0));
    setData({ ...data, demand: data.demand.map((d, j) => (j === i ? v : d)) } as typeof data);
  };
  const setParam = (key: string, v: number | undefined) => setData({ ...data, [key]: v } as typeof data);

  const submit = () => {
    if (!onSubmit) return;
    const verdict = agg ? judgeAggregate(data as AggregateData, X) : judgeLots(data as LotData, X);
    onSubmit(verdict, X);
  };

  const presetLabel: Record<Preset, string> = {
    chase: 'Chase (X = d)', level: 'Level (constant X)', optimal: 'Optimal plan', clear: 'Clear', lfl: 'Lot-for-lot', cap: 'Lot size = capacity',
  };

  const shortage = ev.shortage.reduce((s, x) => s + x.units, 0);
  const overCap = agg ? 0 : (ev as ReturnType<typeof evaluateLots>).overCapacity.reduce((s, x) => s + x.units, 0);

  return (
    <div className="plan">
      <div className="plan-head card">
        <div className="plan-kpis">
          <div className="kpi-big"><small>Relevant costs</small><b>{eur(ev.totals.total)}</b>
            <em>{agg
              ? `inventory ${n0(ev.totals.invCost)} + overtime ${n0((ev.totals as { otCost: number }).otCost)}${(data as AggregateData).kb !== undefined ? ` + backlog ${n0((ev.totals as { blCost: number }).blCost)}` : ''}`
              : `setups ${n0((ev.totals as { setupCost: number }).setupCost)} + holding ${n0((ev.totals as { invCost: number }).invCost)}`}</em>
          </div>
          {showPar && <div className="kpi-small"><small>Par (cheapest possible)</small><b>{eur(par.cost)}</b></div>}
          <div className={`kpi-small ${ev.feasible ? 'ok' : 'bad'}`}>
            <small>Feasible?</small>
            <b>{ev.feasible ? '✓ Yes' : '✗ No'}</b>
            <em>{shortage > 0 ? `${n0(shortage)} units of demand not met` : overCap > 0 ? `capacity exceeded by ${n0(overCap)}` : agg ? 'demand met in time' : 'demand met, X ≤ c'}</em>
          </div>
        </div>
        {note && <div className="plan-note">{note}</div>}
      </div>

      <div className="card plan-chart-card">
        <PlanChart model={props.model} data={data} ev={ev} hover={hover} setHover={setHover} />
      </div>

      <div className="card">
        {paramsEditable && <ParamBar model={props.model} data={data} setParam={setParam} />}
        {(presets.length > 0 || editable) && (
          <div className="plan-presets">
            {presets.length > 0 && <span className="muted">Start from:</span>}
            {presets.map((p) => <button key={p} className="tb small" onClick={() => applyPreset(p)}>{presetLabel[p]}</button>)}
            {editable && !agg && <span className="muted plan-tip">Tip: click a Γ<sub>t</sub> cell to brew in that period; X<sub>t</sub> then covers demand up to the next brew.</span>}
          </div>
        )}
        <div className="plan-scroll" role="region" aria-label="Production plan table" tabIndex={0}>
          <table className="plan-table">
            <thead>
              <tr><th scope="row">Period <Tex tex="t" /></th>{data.demand.map((_, i) => <th key={i} scope="col" className={hover === i ? 'hl' : ''}>{i + 1}</th>)}<th scope="col">Sum</th></tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Demand <Tex tex="d_t" /> <small>[units]</small></th>
                {data.demand.map((d, i) => (
                  <td key={i} className={hover === i ? 'hl' : ''}>
                    {paramsEditable ? <input className="cell-input" aria-label={`Demand period ${i + 1}`} inputMode="numeric" value={d} onChange={(e) => setDemand(i, e.target.value)} /> : n0(d)}
                  </td>
                ))}
                <td className="sum">{n0(ev.totals.d)}</td>
              </tr>
              {!agg && (
                <tr>
                  <th scope="row">Setup <Tex tex="\Gamma_t" /></th>
                  {(ev as ReturnType<typeof evaluateLots>).rows.map((r, i) => (
                    <td key={i} className={hover === i ? 'hl' : ''}>
                      {editable
                        ? <button className={`setup-toggle ${r.setup ? 'on' : ''}`} aria-pressed={r.setup} aria-label={`Setup in period ${i + 1}`} onClick={() => toggleSetup(i)}>{r.setup ? '1' : '0'}</button>
                        : <span className={`setup-flag ${r.setup ? 'on' : ''}`}>{r.setup ? '1' : '0'}</span>}
                    </td>
                  ))}
                  <td className="sum">{(ev.totals as { setups: number }).setups}</td>
                </tr>
              )}
              <tr className="row-x">
                <th scope="row">Production quantity <Tex tex="X_t" /> <small>[units]</small></th>
                {X.map((x, i) => {
                  const over = !agg && x > (data as LotData).c;
                  return (
                    <td key={i} className={`${hover === i ? 'hl' : ''} ${over ? 'bad' : ''}`}>
                      {editable
                        ? <input className={`cell-input ${over ? 'bad' : ''}`} aria-label={`Production in period ${i + 1}`} inputMode="numeric" value={draft[i] ?? ''} onChange={(e) => setCell(i, e.target.value)} onFocus={(e) => e.target.select()} />
                        : n0(x)}
                    </td>
                  );
                })}
                <td className="sum">{n0(ev.totals.X)}</td>
              </tr>
              {agg ? <AggRows ev={ev as ReturnType<typeof evaluateAggregate>} backlog={(data as AggregateData).kb !== undefined} hover={hover} />
                : <LotRows ev={ev as ReturnType<typeof evaluateLots>} hover={hover} />}
            </tbody>
          </table>
        </div>
        {editable && onSubmit && (
          <div className="row between plan-actions">
            <span className="muted">{ev.feasible ? `Your plan: ${eur(ev.totals.total)}.` : 'The plan is not feasible yet.'}</span>
            <button className="tb green" onClick={submit}>{submitLabel}</button>
          </div>
        )}
        {paramsEditable && (
          <p className="muted plan-par">Cheapest possible plan for these numbers: <b>{eur(par.cost)}</b>. <button className="tb small" onClick={() => applyPreset('optimal')}>Show it</button></p>
        )}
      </div>
    </div>
  );
}

function AggRows({ ev, backlog, hover }: { ev: ReturnType<typeof evaluateAggregate>; backlog: boolean; hover: number | null }) {
  const short = new Set(ev.shortage.map((s) => s.t - 1));
  const hl = (i: number, extra = '') => `${hover === i ? 'hl' : ''} ${extra}`;
  return (
    <>
      <tr><th scope="row">Inventory level <Tex tex="L_t" /> <small>[units]</small></th>{ev.rows.map((r, i) => <td key={i} className={hl(i, short.has(i) ? 'bad' : '')}>{short.has(i) ? `−${n0(ev.shortage.find((s) => s.t === i + 1)!.units)}` : n0(r.L)}</td>)}<td className="sum" /></tr>
      {backlog && <tr><th scope="row">Backlog <Tex tex="B_t" /> <small>[units]</small></th>{ev.rows.map((r, i) => <td key={i} className={hl(i, r.B > 0 ? 'warn' : '')}>{n0(r.B)}</td>)}<td className="sum" /></tr>}
      <tr><th scope="row">Overtime <Tex tex="O_t" /> <small>[units]</small></th>{ev.rows.map((r, i) => <td key={i} className={hl(i, r.O > 0 ? 'warn' : '')}>{n0(r.O)}</td>)}<td className="sum">{n0(ev.rows.reduce((s, r) => s + r.O, 0))}</td></tr>
      <tr className="cost"><th scope="row">Inventory costs <small>[EUR]</small></th>{ev.rows.map((r, i) => <td key={i} className={hl(i)}>{n0(r.invCost)}</td>)}<td className="sum">{n0(ev.totals.invCost)}</td></tr>
      <tr className="cost"><th scope="row">Overtime costs <small>[EUR]</small></th>{ev.rows.map((r, i) => <td key={i} className={hl(i)}>{n0(r.otCost)}</td>)}<td className="sum">{n0(ev.totals.otCost)}</td></tr>
      {backlog && <tr className="cost"><th scope="row">Backlog costs <small>[EUR]</small></th>{ev.rows.map((r, i) => <td key={i} className={hl(i)}>{n0(r.blCost)}</td>)}<td className="sum">{n0(ev.totals.blCost)}</td></tr>}
      <tr className="total"><th scope="row">Relevant costs <small>[EUR]</small></th>{ev.rows.map((r, i) => <td key={i} className={hl(i)}>{n0(r.total)}</td>)}<td className="sum">{n0(ev.totals.total)}</td></tr>
    </>
  );
}

function LotRows({ ev, hover }: { ev: ReturnType<typeof evaluateLots>; hover: number | null }) {
  const short = new Set(ev.shortage.map((s) => s.t - 1));
  const hl = (i: number, extra = '') => `${hover === i ? 'hl' : ''} ${extra}`;
  return (
    <>
      <tr><th scope="row">Inventory level <Tex tex="L_t" /> <small>[units]</small></th>{ev.rows.map((r, i) => <td key={i} className={hl(i, short.has(i) ? 'bad' : '')}>{short.has(i) ? `−${n0(ev.shortage.find((s) => s.t === i + 1)!.units)}` : n0(r.L)}</td>)}<td className="sum" /></tr>
      <tr className="cost"><th scope="row">Setup costs <small>[EUR]</small></th>{ev.rows.map((r, i) => <td key={i} className={hl(i)}>{n0(r.setupCost)}</td>)}<td className="sum">{n0(ev.totals.setupCost)}</td></tr>
      <tr className="cost"><th scope="row">Inventory holding costs <small>[EUR]</small></th>{ev.rows.map((r, i) => <td key={i} className={hl(i)}>{n0(r.invCost)}</td>)}<td className="sum">{n0(ev.totals.invCost)}</td></tr>
      <tr className="total"><th scope="row">Relevant costs <small>[EUR]</small></th>{ev.rows.map((r, i) => <td key={i} className={hl(i)}>{n0(r.total)}</td>)}<td className="sum">{n0(ev.totals.total)}</td></tr>
    </>
  );
}

function ParamBar({ model, data, setParam }: { model: 'aggregate' | 'lotsize'; data: AggregateData | LotData; setParam: (k: string, v: number | undefined) => void }) {
  const num = (k: string, label: ReactNode, value: number, step = 1) => (
    <label className="param">
      <span>{label}</span>
      <input className="cell-input" inputMode="decimal" value={value} onChange={(e) => setParam(k, Math.max(0, Number(e.target.value) || 0))} step={step} />
    </label>
  );
  if (model === 'aggregate') {
    const d = data as AggregateData;
    return (
      <div className="param-bar">
        {num('c', <>Capacity <Tex tex="c" /></>, d.c, 10)}
        {num('kl', <>Holding <Tex tex="k^l" /></>, d.kl)}
        {num('ko', <>Overtime <Tex tex="k^o" /></>, d.ko)}
        <label className="param check">
          <input type="checkbox" checked={d.kb !== undefined} onChange={(e) => setParam('kb', e.target.checked ? 18 : undefined)} />
          <span>Allow backlog</span>
        </label>
        {d.kb !== undefined && num('kb', <>Backlog <Tex tex="k^b" /></>, d.kb)}
        <span className="muted">Edit demand <Tex tex="d_t" /> directly in the table.</span>
      </div>
    );
  }
  const d = data as LotData;
  return (
    <div className="param-bar">
      {num('c', <>Capacity <Tex tex="c" /></>, d.c, 10)}
      {num('s', <>Setup cost <Tex tex="s" /></>, d.s, 10)}
      {num('kl', <>Holding <Tex tex="k^l" /></>, d.kl)}
      <span className="muted">Edit demand <Tex tex="d_t" /> directly in the table.</span>
    </div>
  );
}

// ---------------------------------------------------------------- chart

function PlanChart({ model, data, ev, hover, setHover }: {
  model: 'aggregate' | 'lotsize'; data: AggregateData | LotData;
  ev: ReturnType<typeof evaluateAggregate> | ReturnType<typeof evaluateLots>;
  hover: number | null; setHover: (i: number | null) => void;
}) {
  const agg = model === 'aggregate';
  const rows = ev.rows as (ReturnType<typeof evaluateAggregate>['rows'][number] & ReturnType<typeof evaluateLots>['rows'][number])[];
  const T = rows.length;
  const W = 760; const H = 280; const L = 56; const R = 70; const TOP = 18; const B = 36;
  const backlog = agg && (data as AggregateData).kb !== undefined;
  const maxB = backlog ? Math.max(0, ...rows.map((r) => r.B)) : 0;
  const maxV = Math.max(data.c, ...rows.map((r) => Math.max(r.X, r.d, r.L)), 1) * 1.08;
  const step = niceStep(maxV / 5);
  const top = Math.ceil(maxV / step) * step;
  const bottom = maxB > 0 ? -Math.ceil(maxB / step) * step : 0;
  const y = (v: number) => TOP + ((top - v) / (top - bottom)) * (H - TOP - B);
  const band = (W - L - R) / T;
  const x0 = (i: number) => L + i * band;
  const bw = Math.min(28, band * 0.42);
  const ticks: number[] = [];
  for (let v = bottom; v <= top + 1e-9; v += step) ticks.push(v);
  const invPts = rows.map((r, i) => [x0(i) + band / 2, y(r.L)] as const);
  const h = hover;

  return (
    <figure className="chart" style={{ margin: 0 }}>
      <figcaption>
        <b>{agg ? 'Demand, production and inventory per period' : 'Demand, lots and inventory per period'}</b>
        <span>{agg ? 'Bars show production (striped top = overtime), ticks show demand, the blue line shows end-of-period inventory.' : 'Each bar is one lot (S = setup), ticks show demand, the blue line shows end-of-period inventory.'}</span>
      </figcaption>
      <div className="legend">
        <span><i className="key s1 sq" />Production <Tex tex="X_t" /></span>
        {agg && <span><i className="key ot sq" />Overtime <Tex tex="O_t" /></span>}
        <span><i className="key demand" />Demand <Tex tex="d_t" /></span>
        <span><i className="key s2" />Inventory <Tex tex="L_t" /></span>
        {backlog && <span><i className="key blocked sq" />Backlog <Tex tex="B_t" /></span>}
        <span><i className="key cap" />Capacity <Tex tex="c" /></span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Chart of the plan; the table below has the same numbers." onMouseLeave={() => setHover(null)}>
        <defs>
          <pattern id="ot-stripe" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" className="stripe-bg" /><rect width="3" height="6" className="stripe-fg" />
          </pattern>
          <pattern id="bl-stripe" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(135)">
            <rect width="6" height="6" className="stripe-bg" /><rect width="3" height="6" className="stripe-bl" />
          </pattern>
        </defs>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className={v === 0 ? 'axis0' : 'grid'} />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" className="tick">{n0(v)}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const cx = x0(i) + band / 2;
          const reg = agg ? Math.min(r.X, data.c) : r.X;
          const ot = agg ? r.O : 0;
          const over = !agg && r.X > data.c;
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect x={x0(i)} y={TOP} width={band} height={H - TOP - B} className={h === i ? 'col-hl' : 'col-hit'} />
              {reg > 0 && <path d={barPath(cx - bw / 2, y(reg), bw, y(0) - y(reg), ot > 0 ? 0 : 4)} className={over ? 'bar-over' : 'bar-x'} />}
              {ot > 0 && <path d={barPath(cx - bw / 2, y(reg + ot), bw, y(reg) - y(reg + ot) - 2, 4)} className="bar-ot" />}
              {backlog && r.B > 0 && <rect x={cx - bw / 2} y={y(0)} width={bw} height={y(-r.B) - y(0)} className="bar-bl" />}
              <line x1={cx - bw / 2 - 5} x2={cx + bw / 2 + 5} y1={y(r.d)} y2={y(r.d)} className="demand-mark" />
              {!agg && r.setup && <g transform={`translate(${cx} ${y(r.X) - 12})`}><circle r={8} className="setup-dot" /><text y={4} textAnchor="middle" className="setup-dot-t">S</text></g>}
              <text x={cx} y={H - B + 18} textAnchor="middle" className="tick">{i + 1}</text>
            </g>
          );
        })}
        <line x1={L} x2={W - R} y1={y(data.c)} y2={y(data.c)} className="cap-line" />
        <text x={W - R + 8} y={y(data.c) + 4} className="tick cap-label">c = {n0(data.c)}</text>
        <polyline points={invPts.map((p) => p.join(',')).join(' ')} className="inv-line" />
        {invPts.map(([px, py], i) => <circle key={i} cx={px} cy={py} r={4.5} className="inv-dot" />)}
        <text x={L + (W - L - R) / 2} y={H - 4} textAnchor="middle" className="tick">Period t</text>
        {h !== null && (() => {
          const r = rows[h];
          const lines = [`Demand ${n0(r.d)}`, `Production ${n0(r.X)}`, `Inventory ${n0(r.L)}`];
          if (agg) lines.push(`Overtime ${n0(r.O)}`);
          if (backlog) lines.push(`Backlog ${n0(r.B)}`);
          if (!agg) lines.push(r.setup ? 'Setup: yes' : 'Setup: no');
          lines.push(`Costs ${n0(r.total)} EUR`);
          const tx = Math.min(x0(h) + band + 6, W - R - 150);
          const ty = TOP + 4;
          return (
            <g transform={`translate(${tx} ${ty})`} pointerEvents="none">
              <rect width={146} height={22 + lines.length * 16} rx={8} className="tip" />
              <text x={10} y={18} className="tip-title">Period {h + 1}</text>
              {lines.map((l, k) => <text key={k} x={10} y={36 + k * 16} className="tip-text">{l}</text>)}
            </g>
          );
        })()}
      </svg>
    </figure>
  );
}

const niceStep = (raw: number) => {
  const p = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
};

/** Bar with a 4px rounded data end, square at the baseline. */
const barPath = (x: number, y: number, w: number, h: number, r: number) => {
  if (h <= 0) return '';
  const rr = Math.min(r, h, w / 2);
  return `M${x} ${y + h}V${y + rr}Q${x} ${y} ${x + rr} ${y}H${x + w - rr}Q${x + w} ${y} ${x + w} ${y + rr}V${y + h}Z`;
};
