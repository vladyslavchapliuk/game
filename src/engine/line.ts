// Discrete-event simulation of Bruno's production line:
// mash -> transfer -> ferment -> transfer -> bottle.
// Stages work in parallel (a pipeline): as soon as the mash tun hands a batch
// over, it starts the next one. Waiting batches queue in a buffer in front of
// the next stage; with a finite buffer a finished machine is BLOCKED until
// there is room downstream.
//
// The simulation runs once up front and returns a timeline per batch, so the
// animation can show the exact state at any time t and any playback speed.

export interface LineConfig {
  /** Batch size in litres. */
  batchL: number;
  /** Capacity per machine in L/h, one entry per stage. */
  caps: number[];
  /** Parallel machines per stage. */
  machines: number[];
  /** Batches in the order. */
  order: number;
  /** Buffer places in front of each downstream stage (Infinity = unlimited). */
  buffer: number;
  /** Transfer time between stages in seconds. */
  transfer: number;
  /** Optional mixed machines: capacity (L/h) of each machine, per stage. Overrides caps × machines. */
  machineCaps?: number[][];
  /** Seconds between raw batches arriving at the first stage (0 or absent = as fast as mashing can take them). */
  releaseInterval?: number;
  /** Optional buffer places per downstream stage (index 0 = in front of stage 1). Overrides buffer. */
  buffers?: number[];
}

export const STAGE_NAMES = ['Mash', 'Ferment', 'Bottle'] as const;

export const DEFAULT_LINE: LineConfig = {
  batchL: 0.1,
  caps: [60, 40, 50],
  machines: [1, 1, 1],
  order: 6,
  buffer: Infinity,
  transfer: 0.5,
};

/** Processing time of one batch on one machine: quantity / capacity × 3600 s. */
export const procTime = (batchL: number, capLph: number) => (batchL / capLph) * 3600;

export interface StageVisit {
  machine: number;
  /** Arrived at this stage (end of transfer; for stage 0 = start). */
  arrive: number;
  start: number;
  end: number;
  /** Left the machine (transfer start); end < leave means it was blocked. */
  leave: number;
}

export interface BatchTimeline {
  id: number;
  visits: StageVisit[];
  done: number;
}

export interface MachineStats { busy: number; blocked: number }

export interface LineResult {
  config: LineConfig;
  batches: BatchTimeline[];
  /** Time the last bottle is finished. */
  makespan: number;
  /** stats[stage][machine] */
  stats: MachineStats[][];
  /** Queue length changes before stages 1..n-1: [time, length] steps. */
  queues: [number, number][][];
  /** Theoretical process capacity in L/h and the bottleneck stage. */
  processCapacity: number;
  bottleneck: number;
}

/** Capacity (L/h) of every machine at stage s. */
export const capsOf = (c: LineConfig, s: number): number[] =>
  c.machineCaps?.[s] ?? Array.from({ length: c.machines[s] }, () => c.caps[s]);

export const stageCapacityLph = (c: LineConfig, s: number) => capsOf(c, s).reduce((a, b) => a + b, 0);

export const bottleneckOf = (c: LineConfig) => {
  let b = 0;
  c.caps.forEach((_, s) => { if (stageCapacityLph(c, s) < stageCapacityLph(c, b) - 1e-9) b = s; });
  return b;
};

type EvBody =
  | { t: number; type: 'finish'; stage: number; machine: number }
  | { t: number; type: 'arrive'; stage: number; batch: number }
  | { t: number; type: 'raw'; batch: number };
type Ev = EvBody & { seq: number };

export function simulateLine(config: LineConfig): LineResult {
  const S = config.caps.length;
  const mcaps = config.caps.map((_, s) => capsOf(config, s));
  const p = mcaps.map((list) => list.map((cap) => procTime(config.batchL, cap)));
  const scheduled = (config.releaseInterval ?? 0) > 0;
  const T = config.transfer;
  const B = config.buffer;

  const batches: BatchTimeline[] = Array.from({ length: config.order }, (_, id) => ({ id, visits: [], done: NaN }));
  const machines = mcaps.map((list) =>
    list.map(() => ({ batch: -1, state: 'idle' as 'idle' | 'busy' | 'blocked', since: 0 })));
  const stats: MachineStats[][] = mcaps.map((list) => list.map(() => ({ busy: 0, blocked: 0 })));
  // Idle machines are used fastest-first.
  const order = mcaps.map((list) => list.map((_, i) => i).sort((a, b) => list[b] - list[a]));
  const queue: number[][] = Array.from({ length: S }, () => []);
  const inTransit = new Array(S).fill(0);
  const queues: [number, number][][] = Array.from({ length: S - 1 }, () => [[0, 0]]);
  const blockedOrder: { stage: number; machine: number; since: number }[] = [];

  let released = 0;
  let seq = 0;
  const events: Ev[] = [];
  const push = (e: EvBody) => events.push({ ...e, seq: seq++ });
  const logQueue = (stage: number, t: number) => {
    if (stage >= 1) queues[stage - 1].push([t, queue[stage].length]);
  };

  const idleCount = (s: number) => machines[s].filter((m) => m.state === 'idle').length;
  const bufferAt = (s: number) => config.buffers?.[s - 1] ?? B;
  const space = (s: number) => bufferAt(s) + idleCount(s) - queue[s].length - inTransit[s];

  const startOn = (s: number, mi: number, batch: number, t: number) => {
    const m = machines[s][mi];
    m.batch = batch; m.state = 'busy'; m.since = t;
    const v = batches[batch].visits[s];
    v.machine = mi; v.start = t; v.end = t + p[s][mi];
    stats[s][mi].busy += p[s][mi];
    push({ t: t + p[s][mi], type: 'finish', stage: s, machine: mi });
  };

  const release = (t: number) => {
    if (scheduled) { pullInto(0, t); return; }
    // Mash pulls new batches whenever a mash machine is idle.
    order[0].forEach((mi) => {
      const m = machines[0][mi];
      if (m.state === 'idle' && released < config.order) {
        const b = released++;
        batches[b].visits[0] = { machine: mi, arrive: t, start: t, end: t, leave: t };
        startOn(0, mi, b, t);
      }
    });
  };

  const sendOn = (s: number, mi: number, t: number) => {
    // Machine mi at stage s hands its batch to stage s+1 (or finishes it).
    const m = machines[s][mi];
    const b = m.batch;
    batches[b].visits[s].leave = t;
    if (m.state === 'blocked') stats[s][mi].blocked += t - m.since;
    m.batch = -1; m.state = 'idle'; m.since = t;
    if (s === S - 1) {
      batches[b].done = t;
    } else {
      inTransit[s + 1]++;
      batches[b].visits[s + 1] = { machine: -1, arrive: t + T, start: NaN, end: NaN, leave: NaN };
      push({ t: t + T, type: 'arrive', stage: s + 1, batch: b });
    }
  };

  const pullInto = (s: number, t: number) => {
    // Idle machines at stage s take waiting batches from its queue.
    order[s].forEach((mi) => {
      const m = machines[s][mi];
      if (m.state === 'idle' && queue[s].length > 0) {
        const b = queue[s].shift()!;
        logQueue(s, t);
        startOn(s, mi, b, t);
      }
    });
  };

  const unblock = (t: number) => {
    // Blocked machines release in the order they got blocked, if there is room.
    let moved = true;
    while (moved) {
      moved = false;
      for (let i = 0; i < blockedOrder.length; i++) {
        const { stage, machine } = blockedOrder[i];
        if (space(stage + 1) > 0) {
          blockedOrder.splice(i, 1);
          sendOn(stage, machine, t);
          if (stage === 0) release(t);
          else pullInto(stage, t);
          moved = true;
          break;
        }
      }
    }
  };

  if (scheduled) {
    for (let b = 0; b < config.order; b++) push({ t: b * config.releaseInterval!, type: 'raw', batch: b });
  } else {
    release(0);
  }
  let guard = 0;
  while (events.length && guard++ < 400_000) {
    events.sort((a, b) => a.t - b.t || a.seq - b.seq);
    const e = events.shift()!;
    const t = e.t;
    if (e.type === 'finish') {
      const s = e.stage;
      const mi = e.machine;
      const m = machines[s][mi];
      if (s === S - 1 || space(s + 1) > 0) {
        sendOn(s, mi, t);
        if (s === 0) release(t);
        else pullInto(s, t);
        unblock(t);
      } else {
        m.state = 'blocked'; m.since = t;
        blockedOrder.push({ stage: s, machine: mi, since: t });
      }
    } else if (e.type === 'raw') {
      // A raw batch arrives at the silo in front of the first stage.
      batches[e.batch].visits[0] = { machine: -1, arrive: t, start: NaN, end: NaN, leave: NaN };
      const idle = order[0].find((mi) => machines[0][mi].state === 'idle');
      if (idle !== undefined && queue[0].length === 0) startOn(0, idle, e.batch, t);
      else queue[0].push(e.batch);
    } else {
      const s = e.stage;
      inTransit[s]--;
      const idle = order[s].find((mi) => machines[s][mi].state === 'idle') ?? -1;
      if (idle >= 0 && queue[s].length === 0) {
        startOn(s, idle, e.batch, t);
      } else {
        queue[s].push(e.batch);
        logQueue(s, t);
        pullInto(s, t);
      }
      unblock(t);
    }
  }

  const makespan = Math.max(0, ...batches.map((b) => b.done).filter((x) => !Number.isNaN(x)));
  const bottleneck = bottleneckOf(config);
  return {
    config, batches, makespan, stats, queues,
    processCapacity: stageCapacityLph(config, bottleneck),
    bottleneck,
  };
}

// ---------- Views of the result ----------

export type BatchPhase =
  | { kind: 'not-started' }
  | { kind: 'processing'; stage: number; machine: number; progress: number }
  | { kind: 'blocked'; stage: number; machine: number }
  | { kind: 'transfer'; from: number; to: number; progress: number; toMachine: number; queuePos: number }
  | { kind: 'waiting'; stage: number; position: number }
  | { kind: 'done'; at: number };

/** Where is batch b at time t? */
export function phaseAt(r: LineResult, b: BatchTimeline, t: number): BatchPhase {
  const v = b.visits;
  if (!v[0] || t < v[0].arrive) return { kind: 'not-started' };
  for (let s = 0; s < v.length; s++) {
    const x = v[s];
    if (s > 0) {
      const prev = v[s - 1];
      if (t >= prev.leave && t < x.arrive) {
        // Heading to a machine directly if it starts on arrival, else to the queue.
        const direct = x.start <= x.arrive + 1e-9;
        return {
          kind: 'transfer', from: s - 1, to: s, progress: (t - prev.leave) / (x.arrive - prev.leave),
          toMachine: direct ? x.machine : -1, queuePos: direct ? -1 : queuePosition(r, s, b.id, x.arrive),
        };
      }
      if (t >= x.arrive && t < x.start) return { kind: 'waiting', stage: s, position: queuePosition(r, s, b.id, t) };
    }
    if (s === 0 && t >= x.arrive && t < x.start) return { kind: 'waiting', stage: 0, position: queuePosition(r, 0, b.id, t) };
    if (t >= x.start && t < x.end) return { kind: 'processing', stage: s, machine: x.machine, progress: (t - x.start) / (x.end - x.start) };
    if (t >= x.end && t < x.leave) return { kind: 'blocked', stage: s, machine: x.machine };
  }
  if (!Number.isNaN(b.done) && t >= b.done) return { kind: 'done', at: b.done };
  return { kind: 'not-started' };
}

/** 0-based position in the queue before stage s at time t (FIFO by arrival). */
function queuePosition(r: LineResult, s: number, id: number, t: number): number {
  let pos = 0;
  for (const other of r.batches) {
    if (other.id === id) continue;
    const x = other.visits[s];
    if (!x) continue;
    const mine = r.batches[id].visits[s];
    if (x.arrive <= t && x.start > t && (x.arrive < mine.arrive || (x.arrive === mine.arrive && other.id < id))) pos++;
  }
  return pos;
}

export const queueLengthAt = (r: LineResult, stage: number, t: number): number =>
  r.batches.filter((b) => { const x = b.visits[stage]; return x && x.arrive <= t && x.start > t; }).length;

export const doneAt = (r: LineResult, t: number) => r.batches.filter((b) => b.done <= t).length;

/** Busy and blocked seconds per stage up to time t (summed over machines). */
export function stageTimesUntil(r: LineResult, t: number) {
  const S = r.config.caps.length;
  const out = Array.from({ length: S }, () => ({ busy: 0, blocked: 0 }));
  for (const b of r.batches) {
    b.visits.forEach((x, s) => {
      if (!x || Number.isNaN(x.start)) return;
      out[s].busy += Math.max(0, Math.min(t, x.end) - x.start);
      if (!Number.isNaN(x.leave)) out[s].blocked += Math.max(0, Math.min(t, x.leave) - x.end);
    });
  }
  return out;
}

/** Steady-state time between finished bottles (s) = batch / process capacity. */
export const steadyInterval = (c: LineConfig) => (c.batchL / stageCapacityLph(c, bottleneckOf(c))) * 3600;

/** Flow time of a single batch through an empty line (s), including transfers. */
export const singleFlowTime = (c: LineConfig) =>
  c.caps.reduce((s, cap) => s + procTime(c.batchL, cap), 0) + c.transfer * (c.caps.length - 1);
