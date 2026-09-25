// Core OPM 301 formulas. Everything the game grades is computed here, so the
// tests in opm.test.ts pin these to the numbers in the lecture slides.

export interface Stage {
  name: string;
  /** Processing time per unit in minutes (one machine). */
  minutes: number;
  /** Parallel machines at this stage (default 1). */
  machines?: number;
  prop?: string;
}

/** Resource capacity in units per hour. */
export const stageCapacity = (s: Stage): number => (60 / s.minutes) * (s.machines ?? 1);

/** Cycle time W_s of one unit through the line = sum of activity durations (minutes). */
export const cycleTime = (stages: Stage[]): number => stages.reduce((sum, s) => sum + s.minutes, 0);

/** Index of the bottleneck: the resource with the smallest capacity (first one on ties). */
export const bottleneckIndex = (stages: Stage[]): number => {
  let best = 0;
  stages.forEach((s, i) => {
    if (stageCapacity(s) < stageCapacity(stages[best]) - 1e-9) best = i;
  });
  return best;
};

/** Process capacity = min over resource capacities. */
export const processCapacity = (stages: Stage[]): number => Math.min(...stages.map(stageCapacity));

/** Throughput = min(demand, process capacity). */
export const throughput = (stages: Stage[], demand = Infinity): number => Math.min(demand, processCapacity(stages));

/** Utilization = actual production rate / maximum production rate. */
export const utilization = (actualRate: number, capacity: number): number => actualRate / capacity;

export const utilizations = (stages: Stage[], demand = Infinity): number[] => {
  const th = throughput(stages, demand);
  return stages.map((s) => utilization(th, stageCapacity(s)));
};

export type ConstraintKind = 'supply-constrained' | 'demand-constrained';
export const constraintKind = (stages: Stage[], demand: number): ConstraintKind =>
  demand >= processCapacity(stages) ? 'supply-constrained' : 'demand-constrained';

/** Units finished in `hours` in the long run (steady state). */
export const outputOver = (stages: Stage[], hours: number, demand = Infinity): number => throughput(stages, demand) * hours;

// ---------- Brew plan decision (release rate vs. capacity and demand) ----------

export type PlanResult =
  | { kind: 'perfect'; target: number }
  | { kind: 'bottleneck-fail'; target: number; wipGrowth: number }
  | { kind: 'too-much'; target: number; surplus: number }
  | { kind: 'too-little'; target: number; shortfall: number };

/**
 * Bruno releases `release` units/h into a line with capacity `capacity` facing
 * demand `demand`. The right plan is min(demand, capacity):
 * - release above capacity -> work piles up before the bottleneck
 * - release above demand (but feasible) -> surplus stock
 * - release below the achievable throughput -> thirsty customers
 */
export const evaluatePlan = (release: number, capacity: number, demand: number, tol = 1e-6): PlanResult => {
  const target = Math.min(capacity, demand);
  if (release > capacity + tol) return { kind: 'bottleneck-fail', target, wipGrowth: release - capacity };
  if (release > demand + tol) return { kind: 'too-much', target, surplus: release - demand };
  if (release < target - tol) return { kind: 'too-little', target, shortfall: target - release };
  return { kind: 'perfect', target };
};

// ---------- Formatting ----------

export const round = (x: number, digits = 2): number => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};

export const fmt = (x: number, digits = 2): string => {
  const r = round(x, digits);
  return Number.isInteger(r) ? r.toString() : r.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '');
};

export const pct = (x: number, digits = 2): string => `${fmt(x * 100, digits)}%`;
