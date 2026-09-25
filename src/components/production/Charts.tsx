// Bottleneck charts: waiting batches over time (step lines) and machine time
// (busy / blocked / idle) per stage. Colors validated with the dataviz
// validator: light #9A4F1C / #1F6FA8 on #FFF8E8, dark #D07A34 / #3E93D1 on #273A30.
import { useMemo, useState } from 'react';
import { type LineResult, STAGE_NAMES, queueLengthAt, stageTimesUntil } from '../../engine/line';
import { fmt } from '../../engine/opm';

const W = 560;
const H = 230;
const PAD = { l: 40, r: 100, t: 16, b: 34 };

export function QueueChart({ r, t, soda }: { r: LineResult; t: number; soda: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const end = Math.max(r.makespan, 1);
  const series = useMemo(() => r.queues.map((steps) => steps), [r]);
  const maxQ = Math.max(2, ...series.flatMap((s) => s.map(([, q]) => q)));
  const x = (time: number) => PAD.l + (time / end) * (W - PAD.l - PAD.r);
  const y = (q: number) => H - PAD.b - (q / maxQ) * (H - PAD.t - PAD.b);
  const now = Math.min(t, end);
  const names = [`Before ${soda ? 'chilling' : 'fermenting'}`, 'Before bottling'];

  const path = (steps: [number, number][]) => {
    let d = `M${x(0)} ${y(0)}`;
    let last = 0;
    for (const [time, q] of steps) {
      if (time > now) break;
      d += `H${x(time)}V${y(q)}`;
      last = q;
    }
    d += `H${x(now)}`;
    return { d, last };
  };
  const ticksY = Array.from({ length: maxQ + 1 }, (_, i) => i).filter((i) => maxQ <= 6 || i % 2 === 0);
  const tickStep = end > 120 ? 30 : end > 60 ? 15 : 10;
  const ticksX = Array.from({ length: Math.floor(end / tickStep) + 1 }, (_, i) => i * tickStep);
  const hoverT = hover ?? null;

  return (
    <figure className="chart">
      <figcaption>
        <b>Batches waiting in front of each stage</b>
        <span>A line that keeps climbing = work piling up before the bottleneck.</span>
      </figcaption>
      <div className="legend">
        {names.map((n, i) => <span key={n}><i className={`key s${i + 1}`} />{n}</span>)}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Waiting batches over time. Now: ${names.map((n, i) => `${n} ${queueLengthAt(r, i + 1, now)}`).join(', ')}.`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - box.left) / box.width) * W;
          const time = ((px - PAD.l) / (W - PAD.l - PAD.r)) * end;
          setHover(time >= 0 && time <= now ? time : null);
        }}>
        {ticksY.map((q) => (
          <g key={q}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(q)} y2={y(q)} className="grid" />
            <text x={PAD.l - 8} y={y(q) + 4} textAnchor="end" className="tick">{q}</text>
          </g>
        ))}
        {ticksX.map((s) => <text key={s} x={x(s)} y={H - PAD.b + 20} textAnchor="middle" className="tick">{s} s</text>)}
        {series.map((steps, i) => {
          const { d, last } = path(steps);
          return (
            <g key={i}>
              <path d={d} className={`line s${i + 1}`} />
              {now > 0 && <circle cx={x(now)} cy={y(last)} r={5} className={`dot s${i + 1}`} />}
              {now > 0 && <text x={x(now) + 10} y={y(last) + 4 + (i === 1 && last === path(series[0]).last ? 16 : 0)} className="end-label">{last}</text>}
            </g>
          );
        })}
        {hoverT !== null && (
          <g>
            <line x1={x(hoverT)} x2={x(hoverT)} y1={PAD.t} y2={H - PAD.b} className="crosshair" />
            <g transform={`translate(${Math.min(x(hoverT) + 8, W - 150)} ${PAD.t + 4})`}>
              <rect width={142} height={56} rx={8} className="tip" />
              <text x={10} y={18} className="tip-title">{fmt(hoverT, 1)} s</text>
              {names.map((n, i) => (
                <text key={n} x={10} y={34 + i * 15} className="tip-text">{`${i === 0 ? 'Ferment' : 'Bottle'}: ${queueLengthAt(r, i + 1, hoverT)} waiting`}</text>
              ))}
            </g>
          </g>
        )}
      </svg>
    </figure>
  );
}

export function MachineTimeChart({ r, t, soda }: { r: LineResult; t: number; soda: boolean }) {
  const now = Math.max(0.001, Math.min(t, r.makespan));
  const times = stageTimesUntil(r, now);
  const rows = STAGE_NAMES.map((name, s) => {
    const cap = now * r.config.machines[s];
    const busy = t > 0 ? times[s].busy / cap : 0;
    const blocked = t > 0 ? times[s].blocked / cap : 0;
    return { name: soda && s === 1 ? 'Chill' : name, busy, blocked, idle: Math.max(0, 1 - busy - blocked) };
  });
  const [hover, setHover] = useState<number | null>(null);
  return (
    <figure className="chart">
      <figcaption>
        <b>How each stage spent its time so far</b>
        <span>The bottleneck is busy nearly all the time; faster stages wait.</span>
      </figcaption>
      <div className="legend">
        <span><i className="key busy" />Working</span>
        <span><i className="key blocked" />Blocked (no room)</span>
        <span><i className="key idle" />Idle</span>
      </div>
      <div className="bars" role="table" aria-label="Machine time per stage">
        {rows.map((row, i) => (
          <div key={row.name} className="bar-row" role="row" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0}>
            <span role="rowheader" className="bar-name">{row.name}{i === r.bottleneck && t >= r.makespan ? ' · bottleneck' : ''}</span>
            <span className="bar-track" role="cell">
              <i className="busy" style={{ width: `${row.busy * 100}%` }} />
              {row.blocked > 0.001 && <i className="blocked" style={{ width: `${row.blocked * 100}%` }} />}
            </span>
            <span role="cell" className="bar-value">{Math.round(row.busy * 100)}%</span>
            {hover === i && (
              <span className="bar-tip">{`Working ${Math.round(row.busy * 100)}% · blocked ${Math.round(row.blocked * 100)}% · idle ${Math.round(row.idle * 100)}%`}</span>
            )}
          </div>
        ))}
      </div>
    </figure>
  );
}
