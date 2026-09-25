// Recipe Office: optimal project selection. For two projects the plan is also
// drawn as the lecture's graphical solution: constraint lines, the feasible
// region, integer points and a movable profit line Z = e_1 X_1 + e_2 X_2.
import { useMemo, useState } from 'react';
import { type ProjectData, type SelectionVerdict, checkSelection, judgeSelection, solveIP, solveLP, vertices } from '../../engine/lp';
import { fmt } from '../../engine/opm';
import { play } from '../../state/sound';
import { Stepper } from '../production/ProductionLine';
import { Tex } from '../Rich';

interface Props {
  data: ProjectData;
  start?: number[];
  /** Draw the graphical solution (two projects only). */
  graph?: boolean;
  /** Explore helpers: LP relaxation, rounding, complete enumeration, optimum. */
  helpers?: boolean;
  onSubmit?: (v: SelectionVerdict, x: number[]) => void;
}

const eur = (v: number) => `${Math.round(v).toLocaleString('en-US')} EUR`;
const X = (p: ProjectData, i: number) => `X_{${p.keys[i]}}`;

export function ProjectPlanner({ data, start, graph = data.e.length === 2, helpers = false, onSubmit }: Props) {
  const [x, setX] = useState<number[]>(start ?? data.e.map(() => 0));
  const [lpShown, setLpShown] = useState(false);
  const [enumShown, setEnumShown] = useState(false);
  const check = checkSelection(data, x);
  const lp = useMemo(() => solveLP(data), [data]);
  const ip = useMemo(() => solveIP(data), [data]);
  const set = (i: number, v: number) => setX((prev) => prev.map((xi, k) => (k === i ? Math.max(0, Math.min(data.d[i] + 3, Math.round(v))) : xi)));

  return (
    <div className="projects stack">
      <div className="plan-kpis card">
        <div className="kpi-big">
          <small>Revenue <Tex tex="Z" /></small>
          <b>{eur(check.z)}</b>
          <em><Tex tex={`Z = ${data.e.map((e, i) => `${fmt(e)} \\cdot ${x[i]}`).join(' + ')}`} /></em>
        </div>
        <div className={`kpi-small ${check.feasible ? 'ok' : 'bad'}`}>
          <small>Feasible?</small>
          <b>{check.feasible ? '✓ Yes' : '✗ No'}</b>
          <em>{check.feasible ? 'all resources and demands respected' : problems(data, check)}</em>
        </div>
      </div>

      <div className={graph ? 'charts' : 'stack'}>
        {graph && <div className="parchment"><LpGraph data={data} x={x} onPick={(p) => { setX(p); play('click'); }} showCorner={lpShown} /></div>}
        <div className="parchment stack">
          <div className="card-label">Your selection</div>
          <div className="control-grid proj-grid">
            {data.projects.map((name, i) => (
              <div key={name} className="control-stage">
                <b>{name} <Tex tex={X(data, i)} /></b>
                <Stepper label={`${name} batches`} value={x[i]} unit="batches" step={1} onChange={(v) => set(i, v)} />
                <small className="muted">revenue <Tex tex={`e_{${data.keys[i]}}`} /> = {fmt(data.e[i])} EUR · demand <Tex tex={`d_{${data.keys[i]}}`} /> = {data.d[i]}</small>
              </div>
            ))}
          </div>
          <div className="res-wrap"><table className="res-table">
            <thead><tr><th>Resource <Tex tex="j" /></th><th>Needed <Tex tex={`\\sum_i a_{ij} X_i`} /></th><th>Capacity <Tex tex="c_j" /></th><th /></tr></thead>
            <tbody>
              {data.resources.map((r, j) => {
                const used = check.used[j];
                const over = used > data.c[j];
                return (
                  <tr key={r} className={over ? 'bad' : ''}>
                    <th>{r} <small>({j + 1})</small></th>
                    <td>{data.e.map((_, i) => `${data.a[i][j]}·${x[i]}`).join(' + ')} = <b>{fmt(used)}</b></td>
                    <td>{fmt(data.c[j])}</td>
                    <td className="res-bar"><span className="mastery-bar"><i style={{ width: `${Math.min(100, (used / data.c[j]) * 100)}%` }} className={over ? 'over' : ''} /></span>{over ? ' over!' : used === data.c[j] ? ' binding' : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
          {helpers && (
            <div className="stack helper-box">
              <div className="row">
                <button className="tb small" onClick={() => setLpShown(true)}>Solve the LP relaxation</button>
                <button className="tb small" disabled={!lpShown} onClick={() => setX(lp.x.map((v) => Math.round(v)))}>Round the LP solution</button>
                <button className="tb small" onClick={() => setEnumShown(true)}>Enumerate every integer plan</button>
              </div>
              {lpShown && <p><b>LP relaxation</b> (<Tex tex="X_i" /> may be fractional): <Tex tex={data.e.map((_, i) => `${X(data, i)} = ${fmt(lp.x[i], 2)}`).join(',\\ ')} />, <Tex tex={`Z = ${fmt(lp.z, 2)}`} /> EUR.</p>}
              {enumShown && <p><b>Complete enumeration:</b> {ip.candidates.toLocaleString('en-US')} integer plans with <Tex tex="0 \le X_i \le d_i" />, of which {ip.feasibleCount} are feasible. Best: <Tex tex={data.e.map((_, i) => `${X(data, i)} = ${ip.x[i]}`).join(',\\ ')} />, <Tex tex={`Z = ${fmt(ip.z)}`} /> EUR.</p>}
            </div>
          )}
          {onSubmit && (
            <div className="row between">
              <span className="muted">One submission. Bruno brews exactly this selection.</span>
              <button className="tb green" onClick={() => onSubmit(judgeSelection(data, x), x)}>Send the selection to Bruno</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const problems = (p: ProjectData, c: ReturnType<typeof checkSelection>) => [
  ...c.overCapacity.map((j) => `not enough ${p.resources[j]}`),
  ...c.overDemand.map((i) => `more ${p.projects[i]} than ordered`),
].join(' · ');

// ---------------------------------------------------------------------------

/** Italic variable with a subscript inside SVG text. */
const Sub = ({ v, s }: { v: string; s: string }) => (
  <><tspan fontStyle="italic">{v}</tspan><tspan baselineShift="sub" fontSize="0.72em">{s}</tspan></>
);

const W = 560;
const H = 440;
const PAD = { l: 52, r: 24, t: 20, b: 48 };

function LpGraph({ data, x, onPick, showCorner }: { data: ProjectData; x: number[]; onPick: (x: number[]) => void; showCorner: boolean }) {
  const [z, setZ] = useState(() => Math.round(solveIP(data).z * 0.5 / 100) * 100);
  const [hover, setHover] = useState<number[] | null>(null);
  const xMax = data.d[0] + 1;
  const yMax = data.d[1] + 1;
  const sx = (v: number) => PAD.l + (v / xMax) * (W - PAD.l - PAD.r);
  const sy = (v: number) => H - PAD.b - (v / yMax) * (H - PAD.t - PAD.b);
  const verts = useMemo(() => {
    const vs = vertices(data);
    const cx = vs.reduce((s, v) => s + v[0], 0) / vs.length;
    const cy = vs.reduce((s, v) => s + v[1], 0) / vs.length;
    return vs.sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
  }, [data]);
  const best = useMemo(() => solveIP(data), [data]);
  const lp = useMemo(() => solveLP(data), [data]);
  const zMax = Math.ceil((data.e[0] * xMax + data.e[1] * yMax) / 100) * 100;
  // Segment of a line g0·X1 + g1·X2 = h inside the plot box.
  const seg = (g0: number, g1: number, h: number) => {
    const pts: [number, number][] = [];
    const add = (a: number, b: number) => { if (a >= -1e-9 && a <= xMax + 1e-9 && b >= -1e-9 && b <= yMax + 1e-9) pts.push([a, b]); };
    if (g1 !== 0) { add(0, h / g1); add(xMax, (h - g0 * xMax) / g1); }
    if (g0 !== 0) { add(h / g0, 0); add((h - g1 * yMax) / g0, yMax); }
    const uniq = pts.filter((p, i) => pts.findIndex((q) => Math.abs(q[0] - p[0]) < 1e-6 && Math.abs(q[1] - p[1]) < 1e-6) === i);
    return uniq.length >= 2 ? [uniq[0], uniq[uniq.length - 1]] : null;
  };
  const points: number[][] = [];
  for (let a = 0; a <= xMax; a++) for (let b = 0; b <= yMax; b++) points.push([a, b]);
  const labelFor = (j: number) => `${data.resources[j]}: ${data.a[0][j]}${data.keys[0]} + ${data.a[1][j]}${data.keys[1]} ≤ ${data.c[j]}`;
  const zLine = seg(data.e[0], data.e[1], z);
  const zHit = points.filter((p) => checkSelection(data, p).feasible && Math.abs(data.e[0] * p[0] + data.e[1] * p[1] - z) < 1e-6);

  return (
    <figure className="chart lp-graph">
      <figcaption>
        <b>Graphical solution</b>
        <span>Click an integer point to pick a plan. Move the profit line up until it just leaves the feasible region.</span>
      </figcaption>
      <div className="legend">
        <span><i className="key sq feas" />Feasible region</span>
        <span><i className="key dotkey ink" />Feasible integer plan</span>
        <span><i className="key s2 dash" />Profit line <Tex tex="Z" /></span>
      </div>
      <div className="lp-scroll">
      <svg viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`Graph of the selection problem. Your plan ${data.keys[0]} = ${x[0]}, ${data.keys[1]} = ${x[1]}. Profit line at Z = ${z}.`}>
        <defs>
          <clipPath id="lp-clip"><rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} /></clipPath>
        </defs>
        {Array.from({ length: yMax + 1 }, (_, b) => (
          <g key={`y${b}`}>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(b)} y2={sy(b)} className="grid" />
            <text x={PAD.l - 10} y={sy(b) + 4} textAnchor="end" className="tick">{b}</text>
          </g>
        ))}
        {Array.from({ length: xMax + 1 }, (_, a) => (
          <g key={`x${a}`}>
            <line x1={sx(a)} x2={sx(a)} y1={PAD.t} y2={H - PAD.b} className="grid" />
            <text x={sx(a)} y={H - PAD.b + 18} textAnchor="middle" className="tick">{a}</text>
          </g>
        ))}
        <text x={(W + PAD.l) / 2} y={H - 8} textAnchor="middle" className="axis-title">{data.projects[0]} <Sub v="X" s={data.keys[0]} /></text>
        <text x={14} y={(H - PAD.b + PAD.t) / 2} textAnchor="middle" className="axis-title" transform={`rotate(-90 14 ${(H - PAD.b + PAD.t) / 2})`}>{data.projects[1]} <Sub v="X" s={data.keys[1]} /></text>
        <g clipPath="url(#lp-clip)">
          {verts.length > 2 && <polygon points={verts.map((v) => `${sx(v[0])},${sy(v[1])}`).join(' ')} className="feas-region" />}
          {data.resources.map((_, j) => {
            const s = seg(data.a[0][j], data.a[1][j], data.c[j]);
            return s ? <line key={j} x1={sx(s[0][0])} y1={sy(s[0][1])} x2={sx(s[1][0])} y2={sy(s[1][1])} className="con-line" /> : null;
          })}
          <line x1={sx(data.d[0])} x2={sx(data.d[0])} y1={PAD.t} y2={H - PAD.b} className="con-line demand" />
          <line x1={PAD.l} x2={W - PAD.r} y1={sy(data.d[1])} y2={sy(data.d[1])} className="con-line demand" />
          {zLine && <line x1={sx(zLine[0][0])} y1={sy(zLine[0][1])} x2={sx(zLine[1][0])} y2={sy(zLine[1][1])} className="z-line" />}
        </g>
        {data.resources.map((_, j) => {
          const s = seg(data.a[0][j], data.a[1][j], data.c[j]);
          if (!s) return null;
          const top = s[0][1] > s[1][1] ? s[0] : s[1];
          const lx = Math.min(sx(top[0]) + 8, W - PAD.r - 150);
          const ly = Math.max(sy(top[1]) + 14 + j * 16, PAD.t + 12 + j * 16);
          return <text key={j} x={lx} y={ly} className="con-label">{labelFor(j)}</text>;
        })}
        <text x={sx(data.d[0]) - 6} y={PAD.t + 12} textAnchor="end" className="con-label">{`${data.keys[0]} ≤ ${data.d[0]}`}</text>
        <text x={W - PAD.r - 4} y={sy(data.d[1]) - 6} textAnchor="end" className="con-label">{`${data.keys[1]} ≤ ${data.d[1]}`}</text>
        {points.map((p) => {
          const ok = checkSelection(data, p).feasible;
          const sel = p[0] === x[0] && p[1] === x[1];
          const onZ = zHit.some((q) => q[0] === p[0] && q[1] === p[1]);
          return (
            <g key={p.join(',')} className="lp-pt" onClick={() => onPick(p)} onMouseEnter={() => setHover(p)} onMouseLeave={() => setHover(null)}>
              <circle cx={sx(p[0])} cy={sy(p[1])} r={14} className="hit" />
              <circle cx={sx(p[0])} cy={sy(p[1])} r={ok ? 5.5 : 4} className={ok ? (onZ ? 'pt on-z' : 'pt') : 'pt off'} />
              {sel && <circle cx={sx(p[0])} cy={sy(p[1])} r={11} className="pt-sel" />}
            </g>
          );
        })}
        {showCorner && <circle cx={sx(lp.x[0])} cy={sy(lp.x[1])} r={8} className="lp-corner" />}
        {zLine && (
          <text x={Math.min(sx(zLine[0][0]), sx(zLine[1][0])) + 8} y={Math.max(PAD.t + 14, Math.min(sy(zLine[0][1]), sy(zLine[1][1])) + 16)} className="z-label">Z = {z.toLocaleString('en-US')}</text>
        )}
        {hover && (
          <g transform={`translate(${Math.min(sx(hover[0]) + 12, W - 180)} ${Math.max(PAD.t, sy(hover[1]) - 58)})`} pointerEvents="none">
            <rect width={170} height={48} rx={8} className="tip" />
            <text x={10} y={19} className="tip-title"><Sub v="X" s={data.keys[0]} />{` = ${hover[0]}, `}<Sub v="X" s={data.keys[1]} />{` = ${hover[1]}`}</text>
            <text x={10} y={36} className="tip-text">{checkSelection(data, hover).feasible ? `Z = ${(data.e[0] * hover[0] + data.e[1] * hover[1]).toLocaleString('en-US')} EUR` : 'infeasible'}</text>
          </g>
        )}
      </svg>
      </div>
      <div className="z-slider">
        <label htmlFor="zline">Profit line <Tex tex="Z" /></label>
        <input id="zline" type="range" min={0} max={zMax} step={100} value={z} onChange={(e) => setZ(Number(e.target.value))} />
        <b>{z.toLocaleString('en-US')} EUR</b>
        {showCorner && <button className="tb small" onClick={() => setZ(Math.round(best.z))}>Move to the optimum</button>}
      </div>
    </figure>
  );
}
