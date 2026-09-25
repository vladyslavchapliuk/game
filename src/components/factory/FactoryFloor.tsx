// The production hall, seen from above. Three zones (mash, ferment, bottle)
// with machine slots, barrel buffers between zones, a main belt, a grain silo
// and the shipping truck. Items on the belts come from the simulation.
import { useState, type KeyboardEvent } from 'react';
import { BELT_S, MACHINES, machineById, machineSlotMap, type Plan, STAGE_LABEL } from '../../engine/factory';
import { type LineResult, phaseAt } from '../../engine/line';
import { Barrel, C, Item, type ItemKind, MachineSprite, ProgressRing, Silo, Tree, Truck } from './Sprites';

export const T = 40;
const BELT_Y = 5.5 * T;
const ZONE_X = [3, 10, 17];
const BUF_X = [8, 15];
const DOCK_X = 23.5 * T;
const SILO = { x: 1.5 * T, y: BELT_Y };

export const slotCenter = (stage: number, slot: number): [number, number] => {
  const col = slot % 2;
  const top = slot < 2;
  return [(ZONE_X[stage] + 1.25 + col * 2.5) * T, (top ? 2.3 : 8.7) * T];
};
const BARREL_ROWS = [4.45, 6.55, 3.6, 7.4];
export const barrelPos = (strip: number, i: number): [number, number] => {
  const col = i % 2;
  const row = BARREL_ROWS[Math.floor(i / 2)];
  return [(BUF_X[strip] + 0.5 + col) * T, row * T];
};

/** Queue place q in front of stage s (1 or 2): a barrel if there is one, else on the belt. */
const queueSpot = (plan: Plan, stage: number, q: number): [number, number] => {
  const strip = stage - 1;
  if (q < plan.barrels[strip]) return barrelPos(strip, q);
  return [ZONE_X[stage] * T - 14 - (q - plan.barrels[strip]) * 24, BELT_Y];
};

export type Tool = { kind: 'machine'; id: string } | { kind: 'remove' } | { kind: 'barrel' } | null;

type MState = { kind: 'idle' } | { kind: 'busy'; progress: number } | { kind: 'blocked' };

interface Props {
  plan: Plan;
  slotLimit: number;
  demand: number;
  tool: Tool;
  result: LineResult | null;
  t: number;
  clock: number;
  running: boolean;
  onSlot: (stage: number, slot: number) => void;
  onStrip: (strip: number) => void;
  stageCaps: number[];
}

const pathPoint = (pts: [number, number][], k: number): [number, number] => {
  const segs = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  const total = segs.reduce((a, b) => a + b, 0) || 1;
  let d = Math.max(0, Math.min(1, k)) * total;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i] || i === segs.length - 1) {
      const f = segs[i] ? d / segs[i] : 0;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f];
    }
    d -= segs[i];
  }
  return pts[pts.length - 1];
};

export function FactoryFloor({ plan, slotLimit, demand, tool, result, t, clock, running, onSlot, onStrip, stageCaps }: Props) {
  const [hover, setHover] = useState<string | null>(null);
  const W = 25 * T;
  const H = 11 * T;

  // ---- derive machine states and item positions from the simulation ----
  const mstate: MState[][] = plan.slots.map((row) => row.map(() => ({ kind: 'idle' } as MState)));
  const items: { key: string; x: number; y: number; kind: ItemKind; blocked?: boolean }[] = [];
  const bufferFill: number[][] = [[], []];
  let siloWaiting = 0;
  let shipped = 0;
  if (result) {
    const map = machineSlotMap(plan);
    const kinds: ItemKind[] = ['wort', 'beer', 'crate'];
    for (const b of result.batches) {
      const ph = phaseAt(result, b, t);
      if (ph.kind === 'processing') {
        mstate[ph.stage][map[ph.stage][ph.machine]] = { kind: 'busy', progress: ph.progress };
      } else if (ph.kind === 'blocked') {
        const slot = map[ph.stage][ph.machine];
        mstate[ph.stage][slot] = { kind: 'blocked' };
        const [x, y] = slotCenter(ph.stage, slot);
        items.push({ key: `b${b.id}`, x, y: y < BELT_Y ? y + 44 : y - 44, kind: kinds[ph.stage], blocked: true });
      } else if (ph.kind === 'waiting') {
        if (ph.stage === 0) siloWaiting++;
        else {
          bufferFill[ph.stage - 1].push(ph.position);
          const [x, y] = queueSpot(plan, ph.stage, ph.position);
          items.push({ key: `w${b.id}`, x, y: y - 1, kind: kinds[ph.stage - 1] });
        }
      } else if (ph.kind === 'transfer') {
        const [sx, sy] = slotCenter(ph.from, map[ph.from][b.visits[ph.from].machine]);
        const [tx, ty] = ph.toMachine >= 0 ? slotCenter(ph.to, map[ph.to][ph.toMachine]) : queueSpot(plan, ph.to, ph.queuePos);
        const [x, y] = pathPoint([[sx, sy], [sx, BELT_Y], [tx, BELT_Y], [tx, ty]], ph.progress);
        items.push({ key: `t${b.id}`, x, y, kind: kinds[ph.from] });
      } else if (ph.kind === 'done') {
        shipped++;
        const since = t - ph.at;
        if (since < BELT_S) {
          const [sx, sy] = slotCenter(2, map[2][b.visits[2].machine]);
          const [x, y] = pathPoint([[sx, sy], [sx, BELT_Y], [DOCK_X - 40, BELT_Y]], since / BELT_S);
          items.push({ key: `d${b.id}`, x, y, kind: 'crate' });
        }
      }
    }
  }

  const beltOffset = running ? (t * 7) % 24 : 0;
  const chevrons = (x0: number, x1: number, y: number) => {
    const out = [];
    for (let x = x0 + beltOffset; x < x1 - 6; x += 24) out.push(<path key={x} d={`M${x} ${y - 6} L${x + 6} ${y} L${x} ${y + 6}`} className="fx-chevron" />);
    return out;
  };
  const vChevrons = (x: number, y0: number, y1: number) => {
    const dir = y1 > y0 ? 1 : -1;
    const out = [];
    const len = Math.abs(y1 - y0);
    for (let d = beltOffset; d < len - 6; d += 24) {
      const y = y0 + dir * d;
      out.push(<path key={d} d={`M${x - 5} ${y} L${x} ${y + dir * 5} L${x + 5} ${y}`} className="fx-chevron" />);
    }
    return out;
  };

  const keyAct = (fn: () => void) => (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };
  const toolStage = tool?.kind === 'machine' ? machineById(tool.id).stage : -1;

  return (
    <svg viewBox={`-40 -40 ${W + 80} ${H + 80}`} className="fx-svg" role="group" aria-label="Production hall. Place machines in the zones.">
      <defs>
        <pattern id="fx-grid" width={T} height={T} patternUnits="userSpaceOnUse">
          <path d={`M${T} 0 L0 0 0 ${T}`} fill="none" stroke="rgba(33,27,22,.07)" strokeWidth={1.5} />
        </pattern>
        <pattern id="fx-hatch" width={10} height={10} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={10} height={10} fill="#CDBB94" />
          <line x1={0} y1={0} x2={0} y2={10} stroke="#B09A6E" strokeWidth={5} />
        </pattern>
      </defs>

      {/* grass + trees outside */}
      <rect x={-40} y={-40} width={W + 80} height={H + 80} rx={24} fill="#9DBF6E" />
      <path d={`M-40 ${H + 12} Q${W / 2} ${H + 30} ${W + 40} ${H + 8}`} fill="none" stroke="#D9C38E" strokeWidth={18} strokeLinecap="round" />
      {[[-18, -14, 0.8, 0], [W + 18, -10, 0.9, 1], [-16, H + 18, 0.7, 1], [W + 20, H + 22, 0.8, 0], [W * 0.46, -22, 0.6, 1]].map(([x, y, s, tone], i) => (
        <Tree key={i} x={x} y={y} s={s} tone={tone as 0 | 1} />
      ))}

      {/* hall */}
      <rect x={-8} y={-8} width={W + 16} height={H + 16} rx={14} fill="#573720" stroke={C.ink} strokeWidth={4} />
      <rect x={0} y={0} width={W} height={H} rx={8} fill="#E9DAB6" />
      <rect x={0} y={0} width={W} height={H} rx={8} fill="url(#fx-grid)" />

      {/* zones */}
      {ZONE_X.map((zx, s) => {
        const ok = stageCaps[s] >= demand;
        return (
          <g key={s}>
            <rect x={zx * T + 4} y={6} width={5 * T - 8} height={H - 12} rx={10}
              className={`fx-zone fx-zone-${s}`} />
            <text x={(zx + 2.5) * T} y={30} textAnchor="middle" className="fx-zone-label">{STAGE_LABEL[s].toUpperCase()}</text>
            <g transform={`translate(${(zx + 2.5) * T} ${H - 22})`}>
              <rect x={-58} y={-14} width={116} height={26} rx={13} fill={ok ? '#E3EFD3' : '#F6D3CF'} stroke={ok ? C.green : C.red} strokeWidth={2} />
              <text y={5} textAnchor="middle" className="fx-cap" fill={ok ? C.green : C.red}>{stageCaps[s]} / {demand} L/h</text>
            </g>
          </g>
        );
      })}
      {BUF_X.map((bx, i) => (
        <g key={i}>
          <rect x={bx * T + 4} y={2.9 * T} width={2 * T - 8} height={5.2 * T} rx={8} fill="#D8C49A" stroke="#B09A6E" strokeWidth={2} strokeDasharray="6 5" />
          <text x={(bx + 1) * T} y={2.6 * T} textAnchor="middle" className="fx-small">BUFFER</text>
        </g>
      ))}

      {/* main belt */}
      <rect x={100} y={BELT_Y - 14} width={DOCK_X - 140} height={28} rx={6} className="fx-belt" />
      {chevrons(106, DOCK_X - 40, BELT_Y)}

      {/* feeders */}
      {plan.slots.map((row, s) => row.map((id, i) => {
        if (!id) return null;
        const [x, y] = slotCenter(s, i);
        const y0 = y < BELT_Y ? y + 38 : y - 38;
        const y1 = y < BELT_Y ? BELT_Y - 14 : BELT_Y + 14;
        return (
          <g key={`f${s}${i}`}>
            <rect x={x - 11} y={Math.min(y0, y1)} width={22} height={Math.abs(y1 - y0)} className="fx-belt" />
            {vChevrons(x, s === 0 ? y0 : y1, s === 0 ? y1 : y0).slice(0, 3)}
          </g>
        );
      }))}

      {/* silo + truck */}
      <g transform={`translate(${SILO.x} ${SILO.y})`}><Silo waiting={siloWaiting} /></g>
      <g transform={`translate(${DOCK_X} ${BELT_Y - 10})`}><Truck loaded={shipped} clock={clock} /></g>

      {/* barrels (buffer places) */}
      {plan.barrels.map((n, strip) => (
        <g key={strip}>
          {Array.from({ length: n }, (_, i) => {
            const [x, y] = barrelPos(strip, i);
            return <g key={i} transform={`translate(${x} ${y})`}><Barrel full={bufferFill[strip].includes(i)} /></g>;
          })}
          <rect x={BUF_X[strip] * T + 4} y={2.9 * T} width={2 * T - 8} height={5.2 * T} fill="transparent"
            className={tool?.kind === 'barrel' || tool?.kind === 'remove' ? 'fx-hit' : ''} role="button" tabIndex={0}
            aria-label={`Buffer before ${strip === 0 ? 'fermenting' : 'bottling'}: ${n} barrels. ${tool?.kind === 'barrel' ? 'Add a barrel.' : tool?.kind === 'remove' ? 'Remove a barrel.' : ''}`}
            onClick={() => onStrip(strip)} onKeyDown={keyAct(() => onStrip(strip))} />
        </g>
      ))}

      {/* machine slots */}
      {plan.slots.map((row, s) => row.map((id, i) => {
        const [x, y] = slotCenter(s, i);
        const disabled = i >= slotLimit;
        const key = `${s}-${i}`;
        const st = mstate[s][i];
        const canPlace = !disabled && toolStage === s;
        if (disabled) {
          return (
            <g key={key} transform={`translate(${x} ${y})`}>
              <rect x={-38} y={-38} width={76} height={76} rx={8} fill="url(#fx-hatch)" stroke="#9A8660" strokeWidth={2} />
              <text y={5} textAnchor="middle" className="fx-small">NO SPACE</text>
            </g>
          );
        }
        const ghost = !id && hover === key && tool?.kind === 'machine' && canPlace;
        return (
          <g key={key} transform={`translate(${x} ${y})`} role="button" tabIndex={0}
            aria-label={`${STAGE_LABEL[s]} slot ${i + 1}: ${id ? `${machineById(id).name}, ${machineById(id).cap} L/h` : 'empty'}`}
            className={`fx-slot ${canPlace || (id && tool?.kind === 'remove') ? 'fx-slot-live' : ''}`}
            onMouseEnter={() => setHover(key)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(key)} onBlur={() => setHover(null)}
            onClick={() => onSlot(s, i)} onKeyDown={keyAct(() => onSlot(s, i))}>
            <rect x={-38} y={-38} width={76} height={76} rx={10} className={`fx-pad ${canPlace ? 'fx-pad-on' : ''}`} />
            {id ? (
              <>
                <MachineSprite id={id} active={st.kind === 'busy'} clock={clock} fill={st.kind === 'busy' ? st.progress : st.kind === 'blocked' ? 1 : 0} />
                {st.kind !== 'idle' && <ProgressRing r={41} progress={st.kind === 'busy' ? st.progress : 1} blocked={st.kind === 'blocked'} />}
                {st.kind === 'blocked' && (
                  <g transform="translate(28 -30)"><circle r={11} fill={C.red} stroke={C.ink} strokeWidth={2} /><text y={5} textAnchor="middle" className="fx-badge" fill="#FFF">!</text></g>
                )}
                {result && st.kind === 'idle' && t > 0 && <text x={24} y={-26} className="fx-zzz">z</text>}
                <g transform="translate(-30 26)">
                  <rect x={-2} y={-11} width={34} height={17} rx={8} fill="#FFF6E2" stroke={C.ink} strokeWidth={1.5} />
                  <text x={15} y={2} textAnchor="middle" className="fx-tag">{machineById(id).cap}</text>
                </g>
                {hover === key && tool?.kind === 'remove' && <rect x={-38} y={-38} width={76} height={76} rx={10} fill="rgba(178,58,63,.25)" stroke={C.red} strokeWidth={3} />}
              </>
            ) : ghost ? (
              <g opacity={0.55}><MachineSprite id={(tool as { id: string }).id} active={false} clock={0} fill={0} /></g>
            ) : (
              <text y={6} textAnchor="middle" className="fx-plus">+</text>
            )}
          </g>
        );
      }))}

      {/* items */}
      {items.map((it) => (
        <g key={it.key} transform={`translate(${it.x} ${it.y})`} className={it.blocked ? 'fx-item-blocked' : ''}><Item kind={it.kind} /></g>
      ))}
    </svg>
  );
}

export const MACHINE_TYPES = MACHINES;
