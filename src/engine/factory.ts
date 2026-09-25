// Factory Yard: plan a production hall by placing machines in stage zones.
// Capacity planning (how much capacity to set) under a budget and floor space.
import { type LineConfig, simulateLine, type LineResult } from './line';

export type StageIdx = 0 | 1 | 2;

export interface MachineType {
  id: string;
  stage: StageIdx;
  name: string;
  /** Capacity in L/h. */
  cap: number;
  /** Purchase cost in EUR. */
  cost: number;
  tier: 1 | 2;
}

// Bigger machines are cheaper per L/h (economies of scale) except bottling,
// where hand bottling is cheap but slow. Floor space makes the puzzle.
export const MACHINES: MachineType[] = [
  { id: 'mash-1', stage: 0, name: 'Mash tub', cap: 30, cost: 240, tier: 1 },
  { id: 'mash-2', stage: 0, name: 'Copper mash tun', cap: 60, cost: 420, tier: 2 },
  { id: 'ferm-1', stage: 1, name: 'Small fermenter', cap: 20, cost: 180, tier: 1 },
  { id: 'ferm-2', stage: 1, name: 'Big fermenter', cap: 40, cost: 300, tier: 2 },
  { id: 'bott-1', stage: 2, name: 'Hand bottler', cap: 25, cost: 150, tier: 1 },
  { id: 'bott-2', stage: 2, name: 'Auto bottler', cap: 50, cost: 350, tier: 2 },
];
export const machineById = (id: string) => MACHINES.find((m) => m.id === id)!;

export const STAGE_LABEL = ['Mash', 'Ferment', 'Bottle'] as const;
export const MAX_SLOTS = 4;
export const MAX_BARRELS = 8;

export interface Plan {
  /** slots[stage][slot] = machine id or null */
  slots: (string | null)[][];
  /** Barrels (buffer places) in front of ferment and bottle. */
  barrels: [number, number];
}

export const emptyPlan = (): Plan => ({ slots: [[null, null, null, null], [null, null, null, null], [null, null, null, null]], barrels: [2, 2] });

export interface Mission {
  id: string;
  title: string;
  story: string;
  /** Demand in L/h. */
  demand: number;
  budget: number;
  /** Usable machine slots per stage (floor space). */
  slots: number;
  start?: Plan;
  learn: { title: string; body: string };
}

export interface PlanStats {
  stageCaps: number[];
  processCapacity: number;
  bottleneck: number;
  cost: number;
  missing: number[];
  /** Utilization of each stage when producing min(demand, capacity). */
  utilization: number[];
  machineCount: number;
}

export function planStats(plan: Plan, demand: number): PlanStats {
  const stageCaps = plan.slots.map((row) => row.reduce((s, id) => s + (id ? machineById(id).cap : 0), 0));
  const processCapacity = Math.min(...stageCaps);
  let bottleneck = 0;
  stageCaps.forEach((c, i) => { if (c < stageCaps[bottleneck]) bottleneck = i; });
  const cost = plan.slots.flat().reduce((s, id) => s + (id ? machineById(id).cost : 0), 0);
  const missing = stageCaps.map((c, i) => (c === 0 ? i : -1)).filter((i) => i >= 0);
  const out = Math.min(demand, processCapacity);
  return {
    stageCaps, processCapacity, bottleneck, cost, missing,
    utilization: stageCaps.map((c) => (c > 0 ? out / c : 0)),
    machineCount: plan.slots.flat().filter(Boolean).length,
  };
}

/** Cheapest set of at most `slots` machines per stage reaching `demand`. */
export function bestPlan(demand: number, slots: number): { cost: number; plan: Plan } | null {
  const plan = emptyPlan();
  let cost = 0;
  for (const stage of [0, 1, 2] as StageIdx[]) {
    const types = MACHINES.filter((m) => m.stage === stage);
    let best: { cost: number; ids: string[] } | null = null;
    for (let a = 0; a <= slots; a++) {
      for (let b = 0; a + b <= slots; b++) {
        const cap = a * types[0].cap + b * types[1].cap;
        const c = a * types[0].cost + b * types[1].cost;
        if (cap >= demand && (!best || c < best.cost)) {
          best = { cost: c, ids: [...Array(b).fill(types[1].id), ...Array(a).fill(types[0].id)] };
        }
      }
    }
    if (!best) return null;
    cost += best.cost;
    plan.slots[stage] = [...best.ids, ...Array(MAX_SLOTS - best.ids.length).fill(null)];
  }
  return { cost, plan };
}

export type FactoryOutcome = 'perfect' | 'good-enough' | 'too-much' | 'too-little';

export interface FactoryVerdict {
  outcome: FactoryOutcome;
  stars: 0 | 2 | 3;
  stats: PlanStats;
  best: number;
  unmet: number;
  idleCapacity: number;
}

/**
 * perfect: meets demand at the lowest possible equipment cost.
 * good enough: meets demand within 15% of the lowest cost.
 * too much: meets demand but overbuilt (or over budget).
 * too little: some demand stays unmet.
 */
export function judgePlan(plan: Plan, m: Mission): FactoryVerdict {
  const stats = planStats(plan, m.demand);
  const best = bestPlan(m.demand, m.slots)?.cost ?? Infinity;
  const unmet = Math.max(0, m.demand - stats.processCapacity);
  const idleCapacity = stats.stageCaps.reduce((s, c) => s + Math.max(0, c - m.demand), 0);
  let outcome: FactoryOutcome;
  if (unmet > 0) outcome = 'too-little';
  else if (stats.cost > m.budget) outcome = 'too-much';
  else if (stats.cost <= best + 0.5) outcome = 'perfect';
  else if (stats.cost <= best * 1.15) outcome = 'good-enough';
  else outcome = 'too-much';
  return { outcome, stars: outcome === 'perfect' ? 3 : outcome === 'good-enough' ? 2 : 0, stats, best, unmet, idleCapacity };
}

// ---------- Simulation of one shift ----------

export const BATCH_L = 1;
export const SHIFT_S = 90 * 60; // 30 min warm-up + 60 min measured
export const WARMUP_S = 30 * 60;
export const BELT_S = 60; // one minute on the belt between zones
/** Batches the belt itself can hold in front of a zone, on top of the barrels. */
export const BELT_HOLD = 3;

export function lineConfigFor(plan: Plan, demand: number): LineConfig {
  const machineCaps = plan.slots.map((row) => row.filter(Boolean).map((id) => machineById(id!).cap));
  return {
    batchL: BATCH_L,
    caps: machineCaps.map((l) => l[0] ?? 0),
    machines: machineCaps.map((l) => l.length),
    machineCaps,
    order: Math.ceil((demand * SHIFT_S) / 3600) + 2,
    buffer: 0,
    buffers: plan.barrels.map((b) => b + BELT_HOLD),
    transfer: BELT_S,
    releaseInterval: 3600 / demand,
  };
}

/** Slot index (in the plan) for each simulated machine index, per stage. */
export const machineSlotMap = (plan: Plan): number[][] =>
  plan.slots.map((row) => row.map((id, i) => (id ? i : -1)).filter((i) => i >= 0));

export function simulateShift(plan: Plan, demand: number): LineResult | null {
  if (planStats(plan, demand).missing.length) return null;
  return simulateLine(lineConfigFor(plan, demand));
}

/** L/h bottled in the measured hour (after warm-up). */
export const measuredOutput = (r: LineResult, until = SHIFT_S) => {
  const end = Math.min(until, SHIFT_S);
  if (end <= WARMUP_S) return 0;
  const n = r.batches.filter((b) => b.done >= WARMUP_S && b.done < end).length;
  return (n * BATCH_L * 3600) / (end - WARMUP_S);
};

// ---------- Missions ----------

export const MISSIONS: Mission[] = [
  {
    id: 'opening-day',
    title: 'Opening Day',
    story: 'Bruno\'s new hall is empty. The village pub wants **30 L per hour**. Build a line that can deliver it, as cheaply as possible.',
    demand: 30, budget: 1300, slots: 4,
    learn: {
      title: 'A line needs every stage',
      body: 'Beer flows **mash → ferment → bottle**. A stage\'s capacity is the sum of its machines (in L/h). The whole line can only deliver its **process capacity = the smallest stage capacity**.\n\nPlace machines in the three zones, check the capacity chart, then run the shift.',
    },
  },
  {
    id: 'festival-rush',
    title: 'Festival Rush',
    story: 'Oktoberfest! Demand doubles to **60 L per hour**. Your opening-day line is already built. Expand it, but only where it matters.',
    demand: 60, budget: 2200, slots: 4,
    start: {
      slots: [['mash-1', null, null, null], ['ferm-1', 'ferm-1', null, null], ['bott-1', 'bott-1', null, null]],
      barrels: [2, 2],
    },
    learn: {
      title: 'Only the bottleneck limits output',
      body: 'Adding a machine at a stage that is **not** the bottleneck adds cost but no output. Find the stage(s) below demand and add capacity there.\n\nBigger machines cost more but are often **cheaper per L/h**. Compare € per L/h in the build bar.',
    },
  },
  {
    id: 'big-contract',
    title: 'The Big Contract',
    story: 'A supermarket chain signs for **90 L per hour**. Each zone still has room for only **4 machines**.',
    demand: 90, budget: 3200, slots: 4,
    learn: {
      title: 'Capacity planning under constraints',
      body: 'Now floor space bites: with 4 slots, small machines alone may not reach 90 L/h. Mix small and big machines to hit the demand at the **lowest cost**.\n\nThis is capacity planning: you decide how much capacity to **set**, not how to use it.',
    },
  },
  {
    id: 'tiny-hall',
    title: 'The Tiny Hall',
    story: 'Bruno rents a second, narrow hall: only **2 machine slots per zone**. The order: **80 L per hour**.',
    demand: 80, budget: 3000, slots: 2,
    learn: {
      title: 'Space changes the best answer',
      body: 'When floor space is scarce, the machine with the best € per L/h may not fit enough capacity. The cheapest feasible plan changes with the constraint: that is why planning problems need **constraints** in the model.',
    },
  },
];

export const missionById = (id: string) => MISSIONS.find((m) => m.id === id)!;
