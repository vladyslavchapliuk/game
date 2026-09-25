// Stochastic variability and single-server queues (OPM 301 tutorials 6 and 7).
// Notation follows the exercise solutions: E[X], V[X], σ, cv; λ, µ, ρ = λ/µ,
// cv_a², cv_s², E[W_q], E[W_s], E[L_s] and Little's law E[L_s] = λ·E[W_s].
import type { Rng } from './rng';

/** A discrete random variable: values x_i with probabilities p(x_i). */
export interface Dist { x: number[]; p: number[] }

export const expected = (d: Dist): number => d.x.reduce((s, x, i) => s + x * d.p[i], 0);

export const variance = (d: Dist): number => {
  const e = expected(d);
  return d.x.reduce((s, x, i) => s + (x - e) ** 2 * d.p[i], 0);
};

export const stdev = (d: Dist): number => Math.sqrt(variance(d));

/** Coefficient of variation cv = σ / E[X]. */
export const cv = (d: Dist): number => stdev(d) / expected(d);

/** Y = k·X: every value scaled (E and σ scale by k, V by k², cv unchanged). */
export const scaleDist = (d: Dist, k: number): Dist => ({ x: d.x.map((x) => x * k), p: d.p });

export const sampleDist = (d: Dist, rng: Rng): number => {
  let u = rng();
  for (let i = 0; i < d.x.length; i++) {
    u -= d.p[i];
    if (u <= 0) return d.x[i];
  }
  return d.x[d.x.length - 1];
};

/** Tutorial 6 "Dice Bar": one fair die, 3 EUR per beer. */
export const DICE: Dist = { x: [1, 2, 3, 4, 5, 6], p: [1, 1, 1, 1, 1, 1].map((v) => v / 6) };
export const DICE_BEER_COST = 3;

/** Exercise 6: processing times (s) of two machines at one station. */
export const MACHINE_1: Dist = { x: [25, 30, 35, 40, 45], p: [0.13, 0.13, 0.4, 0.17, 0.17] };
export const MACHINE_2: Dist = { x: [25, 30, 35, 40, 45], p: [0.03, 0.07, 0.7, 0.15, 0.05] };

// ---------------------------------------------------------------------------
// Single-server queue (G/G/1 approximation from the lecture / exercise 7).
// All rates and times in the same time unit (the game uses minutes).

export interface QueueParams {
  /** Arrival rate λ (customers per minute). */
  lambda: number;
  /** Service rate µ (customers per minute); mean service time = 1/µ. */
  mu: number;
  /** Squared coefficient of variation of inter-arrival times. */
  cva2: number;
  /** Squared coefficient of variation of service times. */
  cvs2: number;
}

export interface QueueMetrics {
  rho: number;
  /** Expected waiting time in line E[W_q] (∞ if ρ ≥ 1). */
  wq: number;
  /** Expected cycle time (time in system) E[W_s] = E[W_q] + 1/µ. */
  ws: number;
  /** Expected number in line E[L_q] = λ·E[W_q]. */
  lq: number;
  /** Expected number in system E[L_s] = λ·E[W_s]. */
  ls: number;
  stable: boolean;
}

export const utilization = (q: QueueParams): number => q.lambda / q.mu;

export const queueMetrics = (q: QueueParams): QueueMetrics => {
  const rho = utilization(q);
  if (rho >= 1) return { rho, wq: Infinity, ws: Infinity, lq: Infinity, ls: Infinity, stable: false };
  const wq = ((q.cva2 + q.cvs2) / 2) * (rho / (1 - rho)) * (1 / q.mu);
  const ws = wq + 1 / q.mu;
  return { rho, wq, ws, lq: q.lambda * wq, ls: q.lambda * ws, stable: true };
};

/** Largest cv_s² that keeps E[W_s] ≤ maxWs (exercise 7b). Negative = impossible. */
export const maxCvs2ForCycleTime = (q: Omit<QueueParams, 'cvs2'>, maxWs: number): number => {
  const rho = q.lambda / q.mu;
  if (rho >= 1) return -Infinity;
  return (2 * (maxWs - 1 / q.mu) * q.mu * (1 - rho)) / rho - q.cva2;
};

/** Tutorial 7: library, λ = 10/h, σ_a = 6 min (mean 6 min → cv_a² = 1), 1/µ = 5 min, cv_s² = 1. */
export const LIBRARY: QueueParams = { lambda: 10 / 60, mu: 1 / 5, cva2: 1, cvs2: 1 };
/** Exercise 7, problem 2: clock-controlled release every 90 min, 1/µ = 80 min, cv_s² = 1.2. */
export const CLOCKED_MACHINE: QueueParams = { lambda: 1 / 90, mu: 1 / 80, cva2: 0, cvs2: 1.2 };

// ---------------------------------------------------------------------------
// Simulation of one shift at a single-server FIFO queue.

/** Standard normal via Box–Muller. */
const normal = (rng: Rng): number => {
  const u = Math.max(1e-12, rng());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
};

/** Gamma(shape k, scale 1) via Marsaglia–Tsang. */
const gamma1 = (rng: Rng, k: number): number => {
  if (k < 1) return gamma1(rng, k + 1) * rng() ** (1 / k);
  const d = k - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do { x = normal(rng); v = 1 + c * x; } while (v <= 0);
    v = v ** 3;
    const u = rng();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
};

/**
 * A positive random time with the given mean and squared cv:
 * cv² = 0 → deterministic, cv² = 1 → exponential, otherwise gamma.
 */
export const randomTime = (rng: Rng, mean: number, cv2: number): number => {
  if (cv2 <= 1e-9) return mean;
  const k = 1 / cv2;
  return gamma1(rng, k) * mean * cv2;
};

export interface SimCustomer { id: number; arrive: number; start: number; depart: number }
export interface QueueSim {
  customers: SimCustomer[];
  horizon: number;
  /** Averages over customers who started service within the horizon. */
  avgWq: number;
  avgWs: number;
  /** Time-average number in system / in line over [0, horizon]. */
  avgLs: number;
  avgLq: number;
  /** Share of time the server was busy. */
  busy: number;
  served: number;
  maxLine: number;
}

/** Simulate arrivals over [0, horizon] minutes (customers keep being served after closing). */
export const simulateQueue = (q: QueueParams, horizon: number, rng: Rng, warmup = 0): QueueSim => {
  const customers: SimCustomer[] = [];
  let t = 0;
  let free = 0;
  let id = 0;
  for (;;) {
    t += randomTime(rng, 1 / q.lambda, q.cva2);
    if (t > horizon) break;
    const start = Math.max(t, free);
    const depart = start + randomTime(rng, 1 / q.mu, q.cvs2);
    free = depart;
    customers.push({ id: id++, arrive: t, start, depart });
  }
  const counted = customers.filter((c) => c.arrive >= warmup);
  const avgWq = counted.length ? counted.reduce((s, c) => s + c.start - c.arrive, 0) / counted.length : 0;
  const avgWs = counted.length ? counted.reduce((s, c) => s + c.depart - c.arrive, 0) / counted.length : 0;
  const span = Math.max(1e-9, horizon - warmup);
  const overlap = (a: number, b: number) => Math.max(0, Math.min(b, horizon) - Math.max(a, warmup));
  const avgLs = customers.reduce((s, c) => s + overlap(c.arrive, c.depart), 0) / span;
  const avgLq = customers.reduce((s, c) => s + overlap(c.arrive, c.start), 0) / span;
  const busy = customers.reduce((s, c) => s + overlap(c.start, c.depart), 0) / span;
  // FIFO: start times rise with the index, so a sliding pointer finds the line length at each arrival.
  let maxLine = 0;
  let j = 0;
  customers.forEach((c, i) => {
    while (j <= i && customers[j].start <= c.arrive) j++;
    maxLine = Math.max(maxLine, i - j + 1);
  });
  return { customers, horizon, avgWq, avgWs, avgLs, avgLq, busy, served: counted.length, maxLine };
};

/** Customers waiting in line / in service at time t. */
export const stateAt = (sim: QueueSim, t: number) => {
  const line = sim.customers.filter((c) => c.arrive <= t && c.start > t);
  const serving = sim.customers.find((c) => c.start <= t && c.depart > t);
  const done = sim.customers.filter((c) => c.depart <= t).length;
  return { line, serving, done };
};

/** Number in line as a step series sampled every `dt` minutes. */
export const lineSeries = (sim: QueueSim, dt: number, until = sim.horizon): { t: number; n: number }[] => {
  const out: { t: number; n: number }[] = [];
  for (let t = 0; t <= until + 1e-9; t += dt) {
    out.push({ t, n: sim.customers.filter((c) => c.arrive <= t && c.start > t).length });
  }
  return out;
};

// ---------------------------------------------------------------------------
// Staffing mission: pick one bartender setup for a target waiting time.

export interface StaffOption { name: string; note: string; serviceMin: number; cvs2: number; cost: number }
export interface StaffMission {
  /** Arrival rate in guests per hour. */
  lambdaPerHour: number;
  cva2: number;
  /** Upper limit for the metric, in minutes. */
  target: number;
  metric: 'wq' | 'ws';
  options: StaffOption[];
}
export type StaffOutcome = 'perfect' | 'good-enough' | 'too-much' | 'queue-fail';

export const optionParams = (m: StaffMission, o: StaffOption): QueueParams =>
  ({ lambda: m.lambdaPerHour / 60, mu: 1 / o.serviceMin, cva2: m.cva2, cvs2: o.cvs2 });

export const staffMetric = (m: StaffMission, o: StaffOption): number => {
  const r = queueMetrics(optionParams(m, o));
  return m.metric === 'wq' ? r.wq : r.ws;
};

export interface StaffVerdict { outcome: StaffOutcome; choice: number; value: number; cost: number; best: number; bestCost: number }

/**
 * Misses the target (or unstable) = queue fail. Meets it: cheapest = perfect,
 * within 20% of the cheapest = good enough, otherwise overstaffed (too much).
 */
export const judgeStaffing = (m: StaffMission, choice: number): StaffVerdict => {
  const ok = m.options.map((o) => staffMetric(m, o) <= m.target + 1e-9);
  const best = m.options.reduce((b, o, i) => (ok[i] && (b < 0 || o.cost < m.options[b].cost) ? i : b), -1);
  const o = m.options[choice];
  const value = staffMetric(m, o);
  const bestCost = best >= 0 ? m.options[best].cost : Infinity;
  let outcome: StaffOutcome;
  if (!ok[choice]) outcome = 'queue-fail';
  else if (o.cost <= bestCost) outcome = 'perfect';
  else if (o.cost <= bestCost * 1.2) outcome = 'good-enough';
  else outcome = 'too-much';
  return { outcome, choice, value, cost: o.cost, best, bestCost };
};
