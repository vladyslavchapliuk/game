// Sampling lab: roll a random variable many times and watch the sample mean,
// standard deviation and cv settle on E[X], σ and cv. One or two distributions.
import { useMemo, useState } from 'react';
import { type Dist, sampleDist } from '../../engine/stochastic';
import { makeRng, newSeed } from '../../engine/rng';
import { fmt } from '../../engine/opm';
import { play } from '../../state/sound';
import { Tex } from '../Rich';

export interface LabDist { label: string; dist: Dist }

interface Props {
  dists: LabDist[];
  /** Unit of the sampled value, e.g. "EUR" or "s". */
  unit: string;
  /** Multiply each drawn x by this (e.g. 3 EUR per beer). */
  scale?: number;
  /** "die" shows pips for the last roll of a 1–6 variable. */
  face?: 'die' | 'value';
  xLabel: string;
}

const stats = (xs: number[]) => {
  const n = xs.length;
  if (!n) return { n, mean: 0, sd: 0, cv: 0 };
  const mean = xs.reduce((s, x) => s + x, 0) / n;
  const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / n);
  return { n, mean, sd, cv: mean ? sd / mean : 0 };
};

export function SampleLab({ dists, unit, scale = 1, face = 'value', xLabel }: Props) {
  const [seed] = useState(newSeed);
  const rng = useMemo(() => makeRng(seed), [seed]);
  const [draws, setDraws] = useState<number[][]>(() => dists.map(() => []));
  const [last, setLast] = useState<number[] | null>(null);
  const [rolling, setRolling] = useState(false);

  const roll = (k: number) => {
    const fresh = dists.map((d) => Array.from({ length: k }, () => sampleDist(d.dist, rng)));
    setDraws((prev) => prev.map((p, i) => [...p, ...fresh[i]]));
    setLast(fresh.map((f) => f[f.length - 1]));
    setRolling(true);
    window.setTimeout(() => setRolling(false), 350);
    play('click');
  };

  const xs = [...new Set(dists.flatMap((d) => d.dist.x))].sort((a, b) => a - b);
  const two = dists.length > 1;
  return (
    <div className="sample-lab stack">
      <div className="parchment row between">
        <div className="row">
          <button className="tb gold" onClick={() => roll(1)}>{face === 'die' ? 'Roll once' : 'Draw once'}</button>
          <button className="tb" onClick={() => roll(10)}>×10</button>
          <button className="tb" onClick={() => roll(100)}>×100</button>
          <button className="tb" onClick={() => roll(1000)}>×1,000</button>
          <button className="tb" disabled={!draws[0].length} onClick={() => { setDraws(dists.map(() => [])); setLast(null); }}>Reset</button>
        </div>
        <div className="row">
          {last && dists.map((d, i) => (
            <div key={d.label} className={`last-draw ${rolling ? 'pop' : ''}`} aria-live="polite">
              {face === 'die' ? <DieFace n={last[i]} /> : <b>{fmt(last[i] * scale, 1)} {unit}</b>}
              {two && <small>{d.label}</small>}
              {face === 'die' && <small>= {fmt(last[i] * scale, 2)} {unit}</small>}
            </div>
          ))}
        </div>
      </div>
      <div className="charts">
        <div className="parchment"><PmfChart dists={dists} xs={xs} draws={draws} xLabel={xLabel} /></div>
        <div className="parchment stack">
          <div className="card-label">Your sample so far</div>
          <table className="mini-table">
            <thead>
              <tr><th />{dists.map((d) => <th key={d.label}>{d.label}</th>)}</tr>
            </thead>
            <tbody>
              <tr><td>Draws <Tex tex="n" /></td>{draws.map((ds, i) => <td key={i}>{ds.length.toLocaleString('en-US')}</td>)}</tr>
              <tr><td>Sample mean</td>{draws.map((ds, i) => <td key={i}>{ds.length ? `${fmt(stats(ds).mean * scale, 2)} ${unit}` : '—'}</td>)}</tr>
              <tr><td>Sample std. dev.</td>{draws.map((ds, i) => <td key={i}>{ds.length > 1 ? `${fmt(stats(ds).sd * scale, 2)} ${unit}` : '—'}</td>)}</tr>
              <tr><td>Sample cv</td>{draws.map((ds, i) => <td key={i}>{ds.length > 1 ? fmt(stats(ds).cv, 2) : '—'}</td>)}</tr>
            </tbody>
          </table>
          <p className="muted">With many draws the sample values settle near <Tex tex="E[X]" />, <Tex tex="\sigma" /> and <Tex tex="cv" />. The exact values come from the formulas, not from rolling.</p>
        </div>
      </div>
    </div>
  );
}

function DieFace({ n }: { n: number }) {
  const P: Record<number, [number, number][]> = {
    1: [[2, 2]], 2: [[1, 1], [3, 3]], 3: [[1, 1], [2, 2], [3, 3]], 4: [[1, 1], [1, 3], [3, 1], [3, 3]],
    5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]], 6: [[1, 1], [1, 2], [1, 3], [3, 1], [3, 2], [3, 3]],
  };
  return (
    <svg viewBox="0 0 64 64" width={56} height={56} role="img" aria-label={`Die shows ${n}`}>
      <rect x={3} y={3} width={58} height={58} rx={12} className="die" />
      {(P[n] ?? []).map(([cx, cy], i) => <circle key={i} cx={cx * 16} cy={cy * 16} r={5.5} className="pip" />)}
    </svg>
  );
}

const W = 560;
const H = 250;
const PAD = { l: 44, r: 16, t: 16, b: 40 };

function PmfChart({ dists, xs, draws, xLabel }: { dists: LabDist[]; xs: number[]; draws: number[][]; xLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const two = dists.length > 1;
  const probs = dists.map((d) => xs.map((x) => { const i = d.dist.x.indexOf(x); return i >= 0 ? d.dist.p[i] : 0; }));
  const shares = draws.map((ds) => xs.map((x) => (ds.length ? ds.filter((v) => v === x).length / ds.length : 0)));
  const top = Math.max(...probs.flat(), ...shares.flat()) * 1.1;
  const step = top <= 0.2 ? 0.05 : top <= 0.4 ? 0.1 : 0.2;
  const yMax = Math.min(1, Math.ceil(top / step) * step);
  const band = (W - PAD.l - PAD.r) / xs.length;
  const bw = two ? Math.min(34, band * 0.36) : Math.min(46, band * 0.55);
  const y = (p: number) => H - PAD.b - (p / yMax) * (H - PAD.t - PAD.b);
  const cx = (i: number) => PAD.l + band * (i + 0.5);
  const ticks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step);
  return (
    <figure className="chart">
      <figcaption>
        <b>Probability <Tex tex="p(x_i)" />{!two && ' vs. your sample'}</b>
        <span>{two ? 'Same average, different spread: which one is more variable?' : 'Bars: the true distribution. Dots: the share of each value in your draws.'}</span>
      </figcaption>
      <div className="legend">
        {two
          ? dists.map((d, i) => <span key={d.label}><i className={`key sq s${i + 1}`} />{d.label}</span>)
          : <><span><i className="key sq s1" />Probability</span><span><i className="key dotkey s2" />Your sample</span></>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Distribution of ${xLabel}: ${xs.map((x, i) => `${x}: ${probs.map((p) => fmt(p[i], 2)).join(' / ')}`).join(', ')}.`}
        onMouseLeave={() => setHover(null)}>
        {ticks.map((p) => (
          <g key={p}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(p)} y2={y(p)} className="grid" />
            <text x={PAD.l - 8} y={y(p) + 4} textAnchor="end" className="tick">{fmt(p, 2)}</text>
          </g>
        ))}
        {xs.map((x, i) => (
          <g key={x} onMouseEnter={() => setHover(i)}>
            <rect x={cx(i) - band / 2} y={PAD.t} width={band} height={H - PAD.t - PAD.b} className={hover === i ? 'col-hl' : 'col-hit'} />
            {probs.map((p, k) => {
              const bx = two ? cx(i) - bw - 1 + k * (bw + 2) : cx(i) - bw / 2;
              const h = H - PAD.b - y(p[i]);
              return h > 0 ? <path key={k} d={barPath(bx, y(p[i]), bw, h)} className={`bar-s${k + 1}`} /> : null;
            })}
            {!two && draws[0].length > 0 && <circle cx={cx(i)} cy={y(shares[0][i])} r={6} className="dot s2" />}
            <text x={cx(i)} y={H - PAD.b + 18} textAnchor="middle" className="tick">{x}</text>
          </g>
        ))}
        <text x={(W + PAD.l) / 2} y={H - 4} textAnchor="middle" className="tick">{xLabel}</text>
        {hover !== null && (
          <g transform={`translate(${Math.min(cx(hover) + 10, W - 170)} ${PAD.t + 4})`}>
            <rect width={160} height={20 + 16 * (two ? 2 : draws[0].length ? 2 : 1)} rx={8} className="tip" />
            <text x={10} y={17} className="tip-title">x = {xs[hover]}</text>
            {two
              ? dists.map((d, k) => <text key={d.label} x={10} y={33 + 16 * k} className="tip-text">{d.label}: p = {fmt(probs[k][hover], 2)}</text>)
              : (
                <>
                  <text x={10} y={33} className="tip-text">p = {fmt(probs[0][hover], 3)}</text>
                  {draws[0].length > 0 && <text x={10} y={49} className="tip-text">sample share = {fmt(shares[0][hover], 3)}</text>}
                </>
              )}
          </g>
        )}
      </svg>
    </figure>
  );
}

/** Bar with 4px rounded top, square base on the axis. */
const barPath = (x: number, y: number, w: number, h: number) => {
  const r = Math.min(4, h, w / 2);
  return `M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h}Z`;
};
