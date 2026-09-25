import { DEFAULT_LINE, phaseAt, procTime, queueLengthAt, simulateLine, singleFlowTime, steadyInterval, doneAt } from './line';

const cfg = (over: Partial<typeof DEFAULT_LINE> = {}) => ({ ...DEFAULT_LINE, ...over });

describe('production line timing (design spec: 0.1 L at 60/40/50 L/h)', () => {
  it('stage times follow quantity / capacity', () => {
    expect(procTime(0.1, 60)).toBeCloseTo(6);
    expect(procTime(0.1, 40)).toBeCloseTo(9);
    expect(procTime(0.1, 50)).toBeCloseTo(7.2);
    expect(procTime(0.2, 60)).toBeCloseTo(12);
  });

  it('one batch: mash 0-6, transfer, ferment 6.5-15.5, transfer, bottle 16-23.2', () => {
    const r = simulateLine(cfg({ order: 1 }));
    const [m, f, b] = r.batches[0].visits;
    expect([m.start, m.end]).toEqual([0, 6]);
    expect(f.start).toBeCloseTo(6.5); expect(f.end).toBeCloseTo(15.5);
    expect(b.start).toBeCloseTo(16); expect(b.end).toBeCloseTo(23.2);
    expect(r.makespan).toBeCloseTo(23.2);
    expect(singleFlowTime(r.config)).toBeCloseTo(23.2);
  });

  it('pipelines: mash starts batch 2 as soon as batch 1 leaves', () => {
    const r = simulateLine(cfg({ order: 3 }));
    expect(r.batches[1].visits[0].start).toBeCloseTo(6);
    expect(r.batches[2].visits[0].start).toBeCloseTo(12);
    // Fermenter is the bottleneck: it starts every 9 s once busy.
    expect(r.batches[1].visits[1].start).toBeCloseTo(15.5);
    expect(r.batches[2].visits[1].start).toBeCloseTo(24.5);
  });

  it('steady state: one bottle every 9 s, process capacity 40 L/h at the fermenter', () => {
    const r = simulateLine(cfg({ order: 10 }));
    expect(r.bottleneck).toBe(1);
    expect(r.processCapacity).toBe(40);
    const gaps = r.batches.slice(1).map((b, i) => b.done - r.batches[i].done);
    gaps.slice(2).forEach((g) => expect(g).toBeCloseTo(9));
    expect(steadyInterval(r.config)).toBeCloseTo(9);
  });

  it('with an unlimited buffer work piles up in front of the fermenter', () => {
    const r = simulateLine(cfg({ order: 10 }));
    const q = (t: number) => queueLengthAt(r, 1, t);
    expect(q(20)).toBeGreaterThan(0);
    expect(q(55)).toBeGreaterThan(q(20));
    expect(queueLengthAt(r, 2, 40)).toBe(0); // bottling is faster, nothing waits there
    expect(r.stats[0][0].blocked).toBe(0);
  });

  it('with buffer 1 the mash tun gets blocked and waits', () => {
    const r = simulateLine(cfg({ order: 8, buffer: 1 }));
    expect(r.stats[0][0].blocked).toBeGreaterThan(0);
    for (let t = 0; t < r.makespan; t += 0.25) expect(queueLengthAt(r, 1, t)).toBeLessThanOrEqual(1);
    // Throughput is still set by the fermenter: same finish times as unlimited.
    const free = simulateLine(cfg({ order: 8 }));
    expect(r.makespan).toBeCloseTo(free.makespan);
  });

  it('buffer 0 still works (direct hand-over only)', () => {
    const r = simulateLine(cfg({ order: 5, buffer: 0 }));
    expect(doneAt(r, r.makespan)).toBe(5);
    for (let t = 0; t < r.makespan; t += 0.25) expect(queueLengthAt(r, 1, t)).toBe(0);
  });

  it('a second fermenter moves the bottleneck to bottling (50 L/h)', () => {
    const c = cfg({ order: 12, machines: [1, 2, 1] });
    const r = simulateLine(c);
    expect(r.bottleneck).toBe(2);
    expect(r.processCapacity).toBe(50);
    const last = r.batches.slice(-4).map((b) => b.done);
    // Mash (6 s) now limits the arrival rate of work before bottling (7.2 s) -> interval 7.2 s.
    expect(last[3] - last[2]).toBeCloseTo(7.2);
  });

  it('all batches finish and phases are consistent', () => {
    const r = simulateLine(cfg({ order: 7, machines: [2, 1, 1], buffer: 2 }));
    expect(doneAt(r, r.makespan)).toBe(7);
    for (const b of r.batches) {
      for (let t = 0; t <= r.makespan + 1; t += 0.5) {
        const ph = phaseAt(r, b, t);
        expect(ph.kind).toBeDefined();
      }
      expect(phaseAt(r, b, r.makespan + 1).kind).toBe('done');
    }
  });
});

describe('mixed machines and scheduled releases (Factory Yard)', () => {
  const base = { ...DEFAULT_LINE, batchL: 1, transfer: 30, buffer: 4 };

  it('stage capacity is the sum of mixed machines', async () => {
    const { stageCapacityLph, bottleneckOf } = await import('./line');
    const c = { ...base, machineCaps: [[30, 30, 30], [40, 20, 20, 20], [25, 25, 25, 25]] };
    expect([0, 1, 2].map((s) => stageCapacityLph(c, s))).toEqual([90, 100, 100]);
    expect(bottleneckOf(c)).toBe(0);
  });

  it('releases at the demand rate: output matches demand when capacity is enough', () => {
    const c = { ...base, order: 120, releaseInterval: 3600 / 60, machineCaps: [[60], [40, 40], [50, 50]] };
    const r = simulateLine(c);
    // steady state: bottles 1 min apart
    const done = r.batches.map((b) => b.done);
    for (let i = 20; i < 100; i++) expect(done[i + 1] - done[i]).toBeCloseTo(60, 5);
  });

  it('when demand exceeds capacity, work waits at the silo and output = capacity', () => {
    const c = { ...base, order: 150, releaseInterval: 3600 / 90, machineCaps: [[60], [40, 40], [50, 50]] };
    const r = simulateLine(c);
    const window = r.batches.filter((b) => b.done >= 1800 && b.done < 5400).length;
    expect(window).toBeGreaterThanOrEqual(59);
    expect(window).toBeLessThanOrEqual(61);
    expect(queueLengthAt(r, 0, 3000)).toBeGreaterThan(5);
    expect(phaseAt(r, r.batches[70], 3000).kind).toBe("waiting");
  });

  it('fastest idle machine is used first', () => {
    const c = { ...base, order: 1, machineCaps: [[20, 60], [40], [50]] };
    const r = simulateLine(c);
    expect(r.batches[0].visits[0].machine).toBe(1);
    expect(r.batches[0].visits[0].end).toBeCloseTo(60);
  });
});
