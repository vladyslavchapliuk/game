// Optimal project selection (OPM 301 Lecture II, ch. 3).
// max Z = Σ_i e_i X_i  s.t.  Σ_i a_ij X_i ≤ c_j ∀j,  X_i ≤ d_i,  X_i ≥ 0 (integer).
// Small instances only: the LP is solved by vertex enumeration, the IP by
// complete enumeration (both solution approaches named in the lecture).

export interface ProjectData {
  /** Project names, e.g. ['Cream Ale', 'Tripel']. */
  projects: string[];
  /** Short index labels used in the notation, e.g. ['C', 'T'] or ['1', '2', '3']. */
  keys: string[];
  /** Resource names, e.g. ['malt sacks', 'hop bales']. */
  resources: string[];
  /** Revenue e_i per project. */
  e: number[];
  /** a[i][j]: capacity of resource j needed for one project i. */
  a: number[][];
  /** Capacity c_j of each resource. */
  c: number[];
  /** Demand d_i per project. */
  d: number[];
}

/** Lecture example "Chair vs. Table" re-skinned: Cream Ale (C) and Tripel (T), malt sacks (1) and hop bales (2). */
export const CHAIR_TABLE: ProjectData = {
  projects: ['Cream Ale', 'Tripel'],
  keys: ['C', 'T'],
  resources: ['malt sacks', 'hop bales'],
  e: [1000, 2500],
  a: [[2, 1], [2, 2]],
  c: [12, 8],
  d: [6, 3],
};

/** Lecture example with 3 projects and 6 resources (slide 13). */
export const THREE_PROJECTS: ProjectData = {
  projects: ['Project 1', 'Project 2', 'Project 3'],
  keys: ['1', '2', '3'],
  resources: ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'],
  e: [800, 400, 1000],
  a: [[12, 5, 3, 13, 9, 16], [10, 8, 9, 6, 2, 10], [8, 14, 15, 12, 4, 5]],
  c: [40, 36, 52, 64, 26, 54],
  d: [5, 8, 7],
};

const EPS = 1e-7;

export const revenue = (p: ProjectData, x: number[]): number => x.reduce((s, xi, i) => s + p.e[i] * xi, 0);

/** Use of resource j by plan x. */
export const usage = (p: ProjectData, x: number[], j: number): number => x.reduce((s, xi, i) => s + p.a[i][j] * xi, 0);

export interface SelectionCheck {
  z: number;
  used: number[];
  /** Resources whose capacity is exceeded. */
  overCapacity: number[];
  /** Projects above demand. */
  overDemand: number[];
  negative: boolean;
  fractional: boolean;
  feasible: boolean;
}

export const checkSelection = (p: ProjectData, x: number[]): SelectionCheck => {
  const used = p.c.map((_, j) => usage(p, x, j));
  const overCapacity = used.map((u, j) => (u > p.c[j] + EPS ? j : -1)).filter((j) => j >= 0);
  const overDemand = x.map((xi, i) => (xi > p.d[i] + EPS ? i : -1)).filter((i) => i >= 0);
  const negative = x.some((xi) => xi < -EPS);
  const fractional = x.some((xi) => Math.abs(xi - Math.round(xi)) > EPS);
  return { z: revenue(p, x), used, overCapacity, overDemand, negative, fractional, feasible: !overCapacity.length && !overDemand.length && !negative };
};

// Constraints in the form g·x ≤ h: resources, demand, non-negativity.
const constraintRows = (p: ProjectData): { g: number[]; h: number }[] => {
  const n = p.e.length;
  const rows = p.c.map((cj, j) => ({ g: p.a.map((ai) => ai[j]), h: cj }));
  for (let i = 0; i < n; i++) rows.push({ g: Array.from({ length: n }, (_, k) => (k === i ? 1 : 0)), h: p.d[i] });
  for (let i = 0; i < n; i++) rows.push({ g: Array.from({ length: n }, (_, k) => (k === i ? -1 : 0)), h: 0 });
  return rows;
};

/** Solve M·x = v (Gaussian elimination); undefined if singular. */
const solveSquare = (M: number[][], v: number[]): number[] | undefined => {
  const n = v.length;
  const A = M.map((r, i) => [...r, v[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    if (Math.abs(A[piv][col]) < 1e-12) return undefined;
    [A[col], A[piv]] = [A[piv], A[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = A[r][col] / A[col][col];
      for (let k = col; k <= n; k++) A[r][k] -= f * A[col][k];
    }
  }
  return A.map((r, i) => r[n] / r[i]);
};

const combinations = (m: number, k: number): number[][] => {
  const out: number[][] = [];
  const rec = (start: number, acc: number[]) => {
    if (acc.length === k) { out.push(acc); return; }
    for (let i = start; i < m; i++) rec(i + 1, [...acc, i]);
  };
  rec(0, []);
  return out;
};

/** All vertices of the feasible region (corner points of the LP). */
export const vertices = (p: ProjectData): number[][] => {
  const rows = constraintRows(p);
  const n = p.e.length;
  const out: number[][] = [];
  for (const combo of combinations(rows.length, n)) {
    const x = solveSquare(combo.map((r) => rows[r].g), combo.map((r) => rows[r].h));
    if (!x) continue;
    if (rows.some((r) => r.g.reduce((s, g, i) => s + g * x[i], 0) > r.h + 1e-6)) continue;
    const clean = x.map((v) => (Math.abs(v) < 1e-9 ? 0 : v));
    if (!out.some((o) => o.every((v, i) => Math.abs(v - clean[i]) < 1e-6))) out.push(clean);
  }
  return out;
};

/** LP relaxation optimum (continuous X). */
export const solveLP = (p: ProjectData): { x: number[]; z: number } => {
  let best = { x: p.e.map(() => 0), z: 0 };
  for (const v of vertices(p)) {
    const z = revenue(p, v);
    if (z > best.z + 1e-9) best = { x: v, z };
  }
  return best;
};

/** Every feasible integer plan (complete enumeration within 0..d_i). */
export const integerPlans = (p: ProjectData): number[][] => {
  const out: number[][] = [];
  const rec = (i: number, acc: number[]) => {
    if (i === p.e.length) { if (checkSelection(p, acc).feasible) out.push(acc); return; }
    for (let v = 0; v <= p.d[i]; v++) rec(i + 1, [...acc, v]);
  };
  rec(0, []);
  return out;
};

/** Integer optimum by complete enumeration (ties: fewest total projects, then lexicographic). */
export const solveIP = (p: ProjectData): { x: number[]; z: number; feasibleCount: number; candidates: number } => {
  const plans = integerPlans(p);
  let best = { x: p.e.map(() => 0), z: 0 };
  for (const x of plans) {
    const z = revenue(p, x);
    if (z > best.z + 1e-9) best = { x, z };
  }
  const candidates = p.d.reduce((s, d) => s * (d + 1), 1);
  return { ...best, feasibleCount: plans.length, candidates };
};

export type SelectionOutcome = 'perfect' | 'good-enough' | 'too-much' | 'too-little';

export interface SelectionVerdict {
  outcome: SelectionOutcome;
  z: number;
  best: number;
  check: SelectionCheck;
}

/**
 * Accepting more than the resources or the demand allow = too much (promised
 * beer nobody can brew or nobody ordered). Feasible: optimum = perfect,
 * ≥ 90% of the optimum = good enough, else too little revenue.
 */
export const judgeSelection = (p: ProjectData, x: number[]): SelectionVerdict => {
  const check = checkSelection(p, x);
  const best = solveIP(p).z;
  let outcome: SelectionOutcome;
  if (!check.feasible || check.fractional) outcome = 'too-much';
  else if (check.z >= best - 1e-9) outcome = 'perfect';
  else if (check.z >= 0.9 * best) outcome = 'good-enough';
  else outcome = 'too-little';
  return { outcome, z: check.z, best, check };
};
