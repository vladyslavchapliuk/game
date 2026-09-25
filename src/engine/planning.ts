// Production planning over time (OPM 301, Lecture II ch. 4–5).
// Notation follows the lecture:
//   t ∈ {1..T} periods, d_t demand, c capacity per period,
//   k^l holding cost per unit and period, k^o overtime cost per unit,
//   k^b backlog cost per unit and period, s setup cost,
//   X_t production, L_t inventory, O_t overtime, B_t backlog, Γ_t setup (0/1).

// ---------------------------------------------------------------- aggregate

export interface AggregateData {
  demand: number[];
  c: number;
  kl: number;
  ko: number;
  /** Backlog cost per unit and period; undefined = backlog not allowed. */
  kb?: number;
}

export interface AggregateRow {
  t: number;
  d: number;
  X: number;
  L: number;
  B: number;
  O: number;
  invCost: number;
  otCost: number;
  blCost: number;
  total: number;
}

export interface AggregateEval {
  rows: AggregateRow[];
  totals: { X: number; d: number; invCost: number; otCost: number; blCost: number; total: number };
  /** Periods with unmet demand when backlog is not allowed, or B_T > 0 with backlog. */
  shortage: { t: number; units: number }[];
  feasible: boolean;
}

export const LECTURE_AGGREGATE: AggregateData = {
  demand: [590, 260, 1000, 1090, 750, 810, 570, 930],
  c: 750,
  kl: 22,
  ko: 72,
};

export function evaluateAggregate(data: AggregateData, X: number[]): AggregateEval {
  const backlog = data.kb !== undefined;
  let net = 0;
  const shortage: { t: number; units: number }[] = [];
  const rows = data.demand.map((d, i) => {
    const x = Math.max(0, X[i] ?? 0);
    net += x - d;
    let L = Math.max(0, net);
    let B = Math.max(0, -net);
    if (!backlog && net < 0) {
      shortage.push({ t: i + 1, units: -net });
      // Unmet demand is lost in the no-backlog model; carry on from zero stock.
      net = 0; L = 0; B = 0;
    }
    const O = Math.max(0, x - data.c);
    const invCost = data.kl * L;
    const otCost = data.ko * O;
    const blCost = backlog ? (data.kb as number) * B : 0;
    return { t: i + 1, d, X: x, L, B, O, invCost, otCost, blCost, total: invCost + otCost + blCost };
  });
  if (backlog && net < 0) shortage.push({ t: data.demand.length, units: -net });
  const sum = (k: keyof AggregateRow) => rows.reduce((s, r) => s + (r[k] as number), 0);
  return {
    rows,
    totals: { X: sum('X'), d: sum('d'), invCost: sum('invCost'), otCost: sum('otCost'), blCost: sum('blCost'), total: sum('total') },
    shortage,
    feasible: shortage.length === 0,
  };
}

export const chasePlan = (data: AggregateData) => [...data.demand];

/** Constant production; the lecture uses average demand. Raised if needed so no period runs short. */
export function levelPlan(data: AggregateData): number[] {
  const T = data.demand.length;
  const avg = data.demand.reduce((a, b) => a + b, 0) / T;
  let x = avg;
  if (data.kb === undefined) {
    let cum = 0;
    data.demand.forEach((d, i) => { cum += d; x = Math.max(x, cum / (i + 1)); });
  }
  const level = Math.ceil(x - 1e-9);
  return Array.from({ length: T }, () => level);
}

// Min-cost flow (successive shortest paths with Bellman-Ford). Small graphs only.
interface Edge { to: number; cap: number; cost: number; flow: number; rev: number }
class Flow {
  g: Edge[][];
  constructor(n: number) { this.g = Array.from({ length: n }, () => []); }
  add(u: number, v: number, cap: number, cost: number) {
    const a: Edge = { to: v, cap, cost, flow: 0, rev: this.g[v].length };
    const b: Edge = { to: u, cap: 0, cost: -cost, flow: 0, rev: this.g[u].length };
    this.g[u].push(a); this.g[v].push(b);
    return a;
  }
  run(s: number, t: number, need: number) {
    const n = this.g.length;
    let sent = 0;
    let cost = 0;
    while (sent < need - 1e-9) {
      const dist = new Array(n).fill(Infinity);
      const prev: [number, number][] = new Array(n);
      dist[s] = 0;
      for (let it = 0; it < n; it++) {
        let changed = false;
        for (let u = 0; u < n; u++) {
          if (dist[u] === Infinity) continue;
          this.g[u].forEach((e, i) => {
            if (e.cap - e.flow > 1e-9 && dist[u] + e.cost < dist[e.to] - 1e-9) {
              dist[e.to] = dist[u] + e.cost; prev[e.to] = [u, i]; changed = true;
            }
          });
        }
        if (!changed) break;
      }
      if (dist[t] === Infinity) break;
      let push = need - sent;
      for (let v = t; v !== s; v = prev[v][0]) {
        const e = this.g[prev[v][0]][prev[v][1]];
        push = Math.min(push, e.cap - e.flow);
      }
      for (let v = t; v !== s; v = prev[v][0]) {
        const e = this.g[prev[v][0]][prev[v][1]];
        e.flow += push;
        this.g[v][e.rev].flow -= push;
      }
      sent += push;
      cost += push * dist[t];
    }
    return { sent, cost };
  }
}

const BIG = 1e12;

/** Cost-minimal aggregate plan (the lecture's LP), solved as a min-cost flow. */
export function solveAggregate(data: AggregateData): { X: number[]; O: number[]; cost: number } {
  const T = data.demand.length;
  const S = 0;
  const K = T + 1;
  const f = new Flow(T + 2);
  const reg: Edge[] = [];
  const ot: Edge[] = [];
  for (let t = 1; t <= T; t++) {
    reg.push(f.add(S, t, data.c, 0));
    ot.push(f.add(S, t, BIG, data.ko));
    f.add(t, K, data.demand[t - 1], 0);
    if (t < T) f.add(t, t + 1, BIG, data.kl);
    if (t < T && data.kb !== undefined) f.add(t + 1, t, BIG, data.kb);
  }
  const need = data.demand.reduce((a, b) => a + b, 0);
  const { cost } = f.run(S, K, need);
  const X = reg.map((e, i) => Math.round(e.flow + ot[i].flow));
  const O = ot.map((e) => Math.round(e.flow));
  return { X, O, cost: Math.round(cost) };
}

// ---------------------------------------------------------------- lot sizing

export interface LotData {
  demand: number[];
  c: number;
  s: number;
  kl: number;
}

export interface LotRow { t: number; d: number; X: number; setup: boolean; L: number; setupCost: number; invCost: number; total: number; overCap: number }
export interface LotEval {
  rows: LotRow[];
  totals: { X: number; d: number; setupCost: number; invCost: number; total: number; setups: number };
  shortage: { t: number; units: number }[];
  overCapacity: { t: number; units: number }[];
  feasible: boolean;
}

export const LECTURE_LOTS: LotData = { demand: [20, 50, 10, 50, 50, 10, 20, 40, 20, 30], c: 150, s: 100, kl: 1 };

export function evaluateLots(data: LotData, X: number[]): LotEval {
  let L = 0;
  const shortage: { t: number; units: number }[] = [];
  const overCapacity: { t: number; units: number }[] = [];
  const rows = data.demand.map((d, i) => {
    const x = Math.max(0, X[i] ?? 0);
    const setup = x > 0;
    L += x - d;
    if (L < 0) { shortage.push({ t: i + 1, units: -L }); L = 0; }
    const overCap = Math.max(0, x - data.c);
    if (overCap > 0) overCapacity.push({ t: i + 1, units: overCap });
    const setupCost = setup ? data.s : 0;
    const invCost = data.kl * L;
    return { t: i + 1, d, X: x, setup, L, setupCost, invCost, total: setupCost + invCost, overCap };
  });
  const sum = (k: 'X' | 'd' | 'setupCost' | 'invCost' | 'total') => rows.reduce((s, r) => s + r[k], 0);
  return {
    rows,
    totals: { X: sum('X'), d: sum('d'), setupCost: sum('setupCost'), invCost: sum('invCost'), total: sum('total'), setups: rows.filter((r) => r.setup).length },
    shortage,
    overCapacity,
    feasible: shortage.length === 0 && overCapacity.length === 0,
  };
}

export const lotForLot = (data: LotData) => [...data.demand];

/** "Lot size = production capacity": produce c (or the rest of total demand) whenever stock can't cover this period. */
export function lotAtCapacity(data: LotData): number[] {
  let L = 0;
  let remaining = data.demand.reduce((a, b) => a + b, 0);
  return data.demand.map((d) => {
    let x = 0;
    if (L < d) x = Math.min(data.c, remaining - L);
    L += x - d;
    remaining -= d;
    return x;
  });
}

/** Produce, in each setup period, the demand up to the next setup period (zero-inventory ordering). */
export function quantitiesFromSetups(data: LotData, setups: boolean[]): number[] {
  const X = data.demand.map(() => 0);
  let current = -1;
  data.demand.forEach((d, i) => {
    if (setups[i]) current = i;
    if (current >= 0) X[current] += d;
  });
  return X;
}

/** Exact capacitated lot sizing by dynamic programming over the inventory level. */
export function solveLots(data: LotData): { X: number[]; cost: number } {
  const T = data.demand.length;
  const total = data.demand.reduce((a, b) => a + b, 0);
  let cost = new Map<number, number>([[0, 0]]);
  const back: Map<number, [number, number]>[] = [];
  let remaining = total;
  for (let t = 0; t < T; t++) {
    const next = new Map<number, number>();
    const bk = new Map<number, [number, number]>();
    const d = data.demand[t];
    remaining -= d;
    for (const [L0, c0] of cost) {
      const maxX = Math.min(data.c, remaining + d - L0);
      for (let x = Math.max(0, d - L0); x <= maxX; x++) {
        const L1 = L0 + x - d;
        const c1 = c0 + (x > 0 ? data.s : 0) + data.kl * L1;
        if (c1 < (next.get(L1) ?? Infinity) - 1e-9) { next.set(L1, c1); bk.set(L1, [L0, x]); }
      }
    }
    back.push(bk);
    cost = next;
  }
  const best = cost.get(0);
  if (best === undefined) return { X: data.demand.map(() => 0), cost: Infinity };
  const X: number[] = new Array(T).fill(0);
  let L = 0;
  for (let t = T - 1; t >= 0; t--) { const [L0, x] = back[t].get(L)!; X[t] = x; L = L0; }
  return { X, cost: best };
}

/** Share of capacity used productively in one production cycle (lecture ch. 5). */
export const effectiveShare = (lot: number, setupTime: number, timePerUnit: number) =>
  (lot * timePerUnit) / (setupTime + lot * timePerUnit);

// ---------------------------------------------------------------- verdicts

export type PlanOutcome = 'perfect' | 'good-enough' | 'too-much' | 'too-little' | 'bottleneck-fail';
export interface PlanVerdict {
  outcome: PlanOutcome;
  cost: number;
  best: number;
  baseline: number;
  baselineName: string;
  shortage: number;
  overCap: number;
}

/**
 * perfect: feasible and within 1% of the optimum.
 * good enough: feasible and at least as cheap as the best simple rule.
 * too much: feasible but more expensive than the simple rules.
 * too little: demand not met. bottleneck: capacity exceeded (lot sizing).
 */
export function judge(cost: number, best: number, baselines: [string, number][], shortage: number, overCap = 0): PlanVerdict {
  const [baselineName, baseline] = baselines.reduce((a, b) => (b[1] < a[1] ? b : a));
  let outcome: PlanOutcome;
  if (overCap > 0) outcome = 'bottleneck-fail';
  else if (shortage > 0) outcome = 'too-little';
  else if (cost <= best * 1.01 + 0.5) outcome = 'perfect';
  else if (cost <= baseline + 0.5) outcome = 'good-enough';
  else outcome = 'too-much';
  return { outcome, cost, best, baseline, baselineName, shortage, overCap };
}

export function judgeAggregate(data: AggregateData, X: number[]): PlanVerdict {
  const ev = evaluateAggregate(data, X);
  const best = solveAggregate(data).cost;
  const chase = evaluateAggregate(data, chasePlan(data));
  const level = evaluateAggregate(data, levelPlan(data));
  const baselines: [string, number][] = [['chase strategy', chase.totals.total]];
  if (level.feasible) baselines.push(['level strategy', level.totals.total]);
  return judge(ev.totals.total, best, baselines, ev.shortage.reduce((s, x) => s + x.units, 0));
}

export function judgeLots(data: LotData, X: number[]): PlanVerdict {
  const ev = evaluateLots(data, X);
  const best = solveLots(data).cost;
  const baselines: [string, number][] = [
    ['lot-for-lot', evaluateLots(data, lotForLot(data)).totals.total],
    ['lot size = capacity', evaluateLots(data, lotAtCapacity(data)).totals.total],
  ];
  return judge(ev.totals.total, best, baselines, ev.shortage.reduce((s, x) => s + x.units, 0), ev.overCapacity.reduce((s, x) => s + x.units, 0));
}
