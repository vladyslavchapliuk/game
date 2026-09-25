// Animated production scene. Pure view of a simulated LineResult at time t:
// only the active parts move (paddle, fermenter liquid + bubbles, bottle fill,
// cap, finished bottle lift). Batches travel as 0.1 L tokens.
import { memo } from 'react';
import { MASH, FERMENT, PADDLE, CONVEYOR, BOTTLE_GLASS, BOTTLE_LABEL, CAP } from './art';
import { type LineResult, phaseAt, procTime, STAGE_NAMES, queueLengthAt } from '../../engine/line';
import { fmt } from '../../engine/opm';

export const SCENE_W = 1280;
export const SCENE_H = 470;
const FLOOR = 318; // machine feet (original art y=461)
const DY = FLOOR - 461;
const STAGE_X = [185, 640, 1005];
const BUFFER_X = [412, 830];
const OUTPUT_X = 1222;
const TOKEN_R = 19;

const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);

/** Machine x positions for a stage. */
export const machineXs = (stage: number, count: number) =>
  count === 1 ? [STAGE_X[stage]] : stage === 2 ? [STAGE_X[2] - 52, STAGE_X[2] + 52] : [STAGE_X[stage] - 76, STAGE_X[stage] + 76];

const machineScale = (stage: number, count: number) => (count === 1 || stage === 2 ? 1 : 0.7);

/** Where a token sits when it is "at" a machine (top of the machine). */
const machineTokenPos = (stage: number, count: number, m: number): [number, number] => {
  const x = machineXs(stage, count)[m];
  return stage === 2 ? [x, FLOOR - 70] : [x, FLOOR - 88 * machineScale(stage, count)];
};

const bufferSlot = (buffer: number, pos: number): [number, number] => {
  const col = pos % 3;
  const row = Math.floor(pos / 3);
  return [BUFFER_X[buffer] - 44 + col * 44, FLOOR - 8 - row * 40];
};
const MAX_VISIBLE = 12;

function Token({ x, y, label, tone = 'normal' }: { x: number; y: number; label: string; tone?: 'normal' | 'blocked' }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={TOKEN_R} fill={tone === 'blocked' ? '#F2B8A8' : '#F6C34D'} stroke="#211B16" strokeWidth={3} />
      <text y={5} textAnchor="middle" fontSize={12} fontWeight={900} fill="#211B16">{label}</text>
    </g>
  );
}

function Bar({ x, y, w, progress, blocked }: { x: number; y: number; w: number; progress: number; blocked?: boolean }) {
  return (
    <g>
      <rect x={x - w / 2} y={y} width={w} height={12} rx={6} fill="#C3B48C" stroke="#211B16" strokeWidth={1.5} />
      <rect x={x - w / 2} y={y} width={Math.max(0, Math.min(1, progress)) * w} height={12} rx={6} fill={blocked ? '#9B3036' : '#4A693C'} />
    </g>
  );
}

type MState = { kind: 'idle' } | { kind: 'busy'; progress: number; left: number; batch: number } | { kind: 'blocked'; batch: number };

function SceneImpl({ r, t, motion, soda, revealBottleneck }: { r: LineResult; t: number; motion: boolean; soda: boolean; revealBottleneck: boolean }) {
  const c = r.config;
  const tokenLabel = `${fmt(c.batchL)} L`;
  const p = c.caps.map((cap) => procTime(c.batchL, cap));

  // Machine states and token positions from batch phases.
  const mstate: MState[][] = c.machines.map((m) => Array.from({ length: m }, () => ({ kind: 'idle' } as MState)));
  const moving: { id: number; x: number; y: number }[] = [];
  const waiting: number[][] = [[], []];
  const lifting: { m: number; k: number }[] = [];
  let done = 0;

  for (const b of r.batches) {
    const ph = phaseAt(r, b, t);
    if (ph.kind === 'processing') {
      mstate[ph.stage][ph.machine] = { kind: 'busy', progress: ph.progress, left: (1 - ph.progress) * p[ph.stage], batch: b.id };
    } else if (ph.kind === 'blocked') {
      mstate[ph.stage][ph.machine] = { kind: 'blocked', batch: b.id };
    } else if (ph.kind === 'waiting') {
      waiting[ph.stage - 1].push(ph.position);
    } else if (ph.kind === 'transfer') {
      const [x0, y0] = machineTokenPos(ph.from, c.machines[ph.from], b.visits[ph.from].machine);
      const [x1, y1] = ph.toMachine >= 0
        ? machineTokenPos(ph.to, c.machines[ph.to], ph.toMachine)
        : bufferSlot(ph.to - 1, Math.min(ph.queuePos, MAX_VISIBLE - 1));
      const k = motion ? ease(ph.progress) : 1;
      const lift = motion ? -70 * Math.sin(Math.PI * k) : 0;
      moving.push({ id: b.id, x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k + lift });
    } else if (ph.kind === 'done') {
      done++;
      const since = t - ph.at;
      if (since < 0.5) lifting.push({ m: b.visits[2].machine, k: since / 0.5 });
    }
  }

  const bottleneck = r.bottleneck;
  const headers = STAGE_NAMES.map((name, s) => ({
    name: soda && s === 1 ? 'Chill' : name,
    sub: `${fmt(p[s])} s / ${fmt(c.caps[s])} L per hour${c.machines[s] > 1 ? ` · ×${c.machines[s]}` : ''}`,
  }));

  return (
    <svg viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} className="scene-svg" role="img"
      aria-label={`Production line at ${fmt(t, 1)} seconds: ${done} of ${c.order} bottles finished.`}>
      {/* floor */}
      <path d={`M0 ${FLOOR - 40}Q640 ${FLOOR - 56} 1280 ${FLOOR - 36}V${SCENE_H}H0Z`} fill="var(--scene-floor)" />
      <path d={`M0 ${FLOOR + 60}L1280 ${FLOOR + 56}`} stroke="var(--scene-line)" strokeWidth={2} />

      {headers.map((h, s) => (
        <g key={s}>
          <text x={STAGE_X[s]} y={38} textAnchor="middle" className="scene-h">{h.name.toUpperCase()}</text>
          <text x={STAGE_X[s]} y={62} textAnchor="middle" className="scene-sub">{h.sub}</text>
          {revealBottleneck && s === bottleneck && (
            <g transform={`translate(${STAGE_X[s]} 86)`}>
              <rect x={-66} y={-15} width={132} height={26} rx={8} fill="#9B3036" stroke="#211B16" strokeWidth={2} />
              <text y={4} textAnchor="middle" fontSize={13} fontWeight={900} fill="#FFF1D0">BOTTLENECK</text>
            </g>
          )}
        </g>
      ))}

      {/* buffers */}
      {[0, 1].map((bi) => {
        const n = queueLengthAt(r, bi + 1, t);
        const full = Number.isFinite(c.buffer) && n >= c.buffer && c.buffer > 0;
        const x = BUFFER_X[bi];
        return (
          <g key={bi}>
            <rect x={x - 72} y={FLOOR + 14} width={144} height={16} rx={4} fill="#8C6033" stroke="#211B16" strokeWidth={2.5} />
            <path d={`M${x - 64} ${FLOOR + 22}H${x + 64}`} stroke="#D9B66A" strokeWidth={2} />
            <text x={x} y={FLOOR + 52} textAnchor="middle" className={`scene-sub ${full ? 'scene-danger' : ''}`}>
              {`Waiting: ${n}${Number.isFinite(c.buffer) ? ` / ${c.buffer}` : ''}`}
            </text>
            {Number.isFinite(c.buffer) && c.buffer === 0 && (
              <text x={x} y={FLOOR + 72} textAnchor="middle" className="scene-sub">no buffer</text>
            )}
          </g>
        );
      })}

      {/* MASH */}
      {machineXs(0, c.machines[0]).map((x, m) => {
        const st = mstate[0][m];
        const k = machineScale(0, c.machines[0]);
        const angle = st.kind === 'busy' && motion ? 7 * Math.sin((t * 2 * Math.PI) / 1.3) : 0;
        return (
          <g key={`m${m}`}>
            <ellipse cx={x} cy={FLOOR + 10} rx={120 * k} ry={14 * k} fill="var(--scene-shadow)" />
            <g transform={`translate(${x} ${FLOOR}) scale(${k}) translate(-294 -461)`}>
              <g dangerouslySetInnerHTML={{ __html: MASH }} />
              <g transform={`rotate(${angle} 294 318)`} dangerouslySetInnerHTML={{ __html: PADDLE }} />
            </g>
            <MachineStatus x={x} k={k} st={st} />
          </g>
        );
      })}

      {/* FERMENT */}
      {machineXs(1, c.machines[1]).map((x, m) => {
        const st = mstate[1][m];
        const k = machineScale(1, c.machines[1]);
        const fill = st.kind === 'busy' ? st.progress : st.kind === 'blocked' ? 1 : 0;
        const id = `fw-${m}`;
        return (
          <g key={`f${m}`}>
            <ellipse cx={x} cy={FLOOR + 10} rx={120 * k} ry={14 * k} fill="var(--scene-shadow)" />
            <g transform={`translate(${x} ${FLOOR}) scale(${k}) translate(-636 -461)`}>
              <g dangerouslySetInnerHTML={{ __html: FERMENT }} />
              <defs><clipPath id={id}><circle cx={638} cy={373} r={21} /></clipPath></defs>
              <g clipPath={`url(#${id})`}>
                <rect x={616} y={394 - 42 * fill} width={44} height={42 * fill} fill={soda ? '#F4E37A' : '#E6AC3E'} />
                {st.kind === 'busy' && motion && [0, 1, 2].map((i) => {
                  const ph = ((t * 0.9 + i * 0.33) % 1);
                  return <circle key={i} cx={629 + i * 8} cy={396 - ph * 40} r={2 + (i % 2)} fill="#FFF4BC" opacity={1 - ph} />;
                })}
              </g>
            </g>
            <MachineStatus x={x} k={k} st={st} />
          </g>
        );
      })}

      {/* BOTTLE station */}
      <g transform={`translate(${STAGE_X[2] - 1015} ${DY})`} dangerouslySetInnerHTML={{ __html: CONVEYOR }} />
      {machineXs(2, c.machines[2]).map((x, m) => {
        const st = mstate[2][m];
        const lift = lifting.find((l) => l.m === m);
        const fill = st.kind === 'busy' ? st.progress : st.kind === 'blocked' ? 1 : 0;
        const show = st.kind !== 'idle' || lift;
        const liftY = lift && motion ? -58 * ease(lift.k) : 0;
        return (
          <g key={`b${m}`}>
            {show ? (
              <g transform={`translate(${x - 978} ${DY + liftY})`} opacity={lift ? 1 - lift.k * 0.6 : 1}>
                <g dangerouslySetInnerHTML={{ __html: BOTTLE_GLASS }} />
                <rect x={960} y={421 - 47.8 * (lift ? 1 : fill)} width={36} height={47.8 * (lift ? 1 : fill)} fill={soda ? '#F2DE63' : '#D99D30'} />
                <g dangerouslySetInnerHTML={{ __html: BOTTLE_LABEL.replace('100 mL', `${fmt(c.batchL * 1000)} mL`) }} />
                {(fill >= 0.999 || lift) && <g dangerouslySetInnerHTML={{ __html: CAP }} />}
              </g>
            ) : (
              <path transform={`translate(${x - 900} ${DY})`} d="M895 362H913V384L909 391V435H888V391L895 384Z" fill="#D7C8A2" stroke="#84795E" strokeWidth={2} />
            )}
            <MachineStatus x={x} k={c.machines[2] > 1 ? 0.62 : 1} st={st} />
          </g>
        );
      })}

      {/* OUTPUT crate */}
      <g>
        <rect x={OUTPUT_X - 52} y={FLOOR - 64} width={104} height={74} rx={6} fill="#A56634" stroke="#211B16" strokeWidth={3} />
        <path d={`M${OUTPUT_X - 52} ${FLOOR - 40}H${OUTPUT_X + 52}M${OUTPUT_X - 52} ${FLOOR - 16}H${OUTPUT_X + 52}`} stroke="#6B3E1E" strokeWidth={2} />
        {Array.from({ length: Math.min(done, 10) }, (_, i) => (
          <rect key={i} x={OUTPUT_X - 46 + (i % 5) * 19} y={FLOOR - 98 - Math.floor(i / 5) * 32} width={13} height={30} rx={4}
            fill={soda ? '#E9E07A' : '#C0D2A0'} stroke="#211B16" strokeWidth={2} />
        ))}
        <text x={OUTPUT_X} y={FLOOR + 40} textAnchor="middle" className="scene-h" fontSize={20}>{`${done} / ${c.order}`}</text>
        <text x={OUTPUT_X} y={FLOOR + 62} textAnchor="middle" className="scene-sub">bottled</text>
      </g>

      {/* waiting tokens */}
      {waiting.map((list, bi) => (
        <g key={`w${bi}`}>
          {list.filter((pos) => pos < MAX_VISIBLE).map((pos) => {
            const [x, y] = bufferSlot(bi, pos);
            return <Token key={pos} x={x} y={y - TOKEN_R} label={tokenLabel} />;
          })}
          {list.length > MAX_VISIBLE && (
            <text x={BUFFER_X[bi]} y={FLOOR - 176} textAnchor="middle" className="scene-h" fontSize={18}>{`+${list.length - MAX_VISIBLE}`}</text>
          )}
        </g>
      ))}

      {/* blocked tokens sit on their machine */}
      {mstate.map((ms, s) => ms.map((st, m) => {
        if (st.kind !== 'blocked') return null;
        const [x, y] = machineTokenPos(s, c.machines[s], m);
        return <Token key={`bl${s}${m}`} x={x} y={y} label={tokenLabel} tone="blocked" />;
      }))}

      {moving.map((mv) => <Token key={`mv${mv.id}`} x={mv.x} y={mv.y} label={tokenLabel} />)}
    </svg>
  );
}

function MachineStatus({ x, k, st }: { x: number; k: number; st: MState }) {
  const w = 190 * k;
  const y = FLOOR + 76;
  return (
    <g>
      <Bar x={x} y={y} w={w} progress={st.kind === 'busy' ? st.progress : st.kind === 'blocked' ? 1 : 0} blocked={st.kind === 'blocked'} />
      <text x={x} y={y + 36} textAnchor="middle" className={`scene-status ${st.kind === 'blocked' ? 'scene-danger' : ''}`}>
        {st.kind === 'busy' ? `● ${fmt(st.left, 1)} s left` : st.kind === 'blocked' ? '■ Blocked: no room' : '○ Idle'}
      </text>
    </g>
  );
}

export const Scene = memo(SceneImpl);
