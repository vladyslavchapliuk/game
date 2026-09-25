import { CLOCKED_MACHINE, DICE, DICE_BEER_COST, LIBRARY, MACHINE_1, MACHINE_2, cv, expected, maxCvs2ForCycleTime, queueMetrics, randomTime, scaleDist, simulateQueue, stdev, variance } from './stochastic';
import { makeRng } from './rng';

const r2 = (x: number) => Math.round(x * 100) / 100;

describe('tutorial 6: Dice Bar (3 EUR per beer)', () => {
  const cost = scaleDist(DICE, DICE_BEER_COST);
  it('E = 10.50 EUR, V = 26.25 EUR², σ = 5.12 EUR, cv = 0.49', () => {
    expect(r2(expected(cost))).toBe(10.5);
    expect(r2(variance(cost))).toBe(26.25);
    expect(r2(stdev(cost))).toBe(5.12);
    expect(r2(cv(cost))).toBe(0.49);
  });
  it('scaling by 3 leaves cv unchanged', () => {
    expect(cv(cost)).toBeCloseTo(cv(DICE), 10);
  });
});

describe('exercise 6: two machines', () => {
  it('machine 1: E = 35.60 s, V = 37.14 s², σ = 6.09 s, cv = 0.17', () => {
    expect(r2(expected(MACHINE_1))).toBe(35.6);
    expect(r2(variance(MACHINE_1))).toBe(37.14);
    expect(r2(stdev(MACHINE_1))).toBe(6.09);
    expect(r2(cv(MACHINE_1))).toBe(0.17);
  });
  it('machine 2: E = 35.60 s, V = 13.14 s², σ = 3.62 s, cv = 0.10', () => {
    expect(r2(expected(MACHINE_2))).toBe(35.6);
    expect(r2(variance(MACHINE_2))).toBe(13.14);
    expect(r2(stdev(MACHINE_2))).toBe(3.62);
    expect(r2(cv(MACHINE_2))).toBe(0.1);
  });
});

describe('tutorial 7: library queue', () => {
  it('ρ = 5/6, E[Wq] = 25 min, E[Ws] = 30 min, E[Ls] = 5', () => {
    const m = queueMetrics(LIBRARY);
    expect(m.rho).toBeCloseTo(5 / 6, 10);
    expect(m.wq).toBeCloseTo(25, 10);
    expect(m.ws).toBeCloseTo(30, 10);
    expect(m.ls).toBeCloseTo(5, 10);
  });
});

describe('exercise 7: clock-controlled machine', () => {
  it('ρ = 8/9, E[Wq] = 384 min, E[Ws] = 464 min, E[Ls] = 5.16', () => {
    const m = queueMetrics(CLOCKED_MACHINE);
    expect(m.rho).toBeCloseTo(8 / 9, 10);
    expect(m.wq).toBeCloseTo(384, 8);
    expect(m.ws).toBeCloseTo(464, 8);
    expect(r2(m.ls)).toBe(5.16);
  });
  it('E[Ws] ≤ 5 h needs cv_s² ≤ 0.69 (a reduction of 0.51)', () => {
    const max = maxCvs2ForCycleTime(CLOCKED_MACHINE, 300);
    expect(r2(max)).toBe(0.69);
    expect(r2(1.2 - max)).toBe(0.51);
  });
  it('utilization does not depend on variability', () => {
    expect(queueMetrics({ ...CLOCKED_MACHINE, cvs2: 3 }).rho).toBe(queueMetrics(CLOCKED_MACHINE).rho);
  });
  it('ρ ≥ 1 is unstable', () => {
    expect(queueMetrics({ ...LIBRARY, lambda: 0.25 }).stable).toBe(false);
  });
});

describe('random times and simulation', () => {
  it('random times have the requested mean and cv²', () => {
    for (const cv2 of [0, 0.3, 1, 2]) {
      const rng = makeRng(7);
      const xs = Array.from({ length: 40000 }, () => randomTime(rng, 5, cv2));
      const m = xs.reduce((s, x) => s + x, 0) / xs.length;
      const v = xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length;
      expect(m).toBeCloseTo(5, 0);
      expect(v / (m * m)).toBeCloseTo(cv2, 1);
    }
  });
  it('M/M/1 simulation matches the formula in the long run', () => {
    const sim = simulateQueue(LIBRARY, 200_000, makeRng(3), 1000);
    expect(sim.avgWq).toBeGreaterThan(22);
    expect(sim.avgWq).toBeLessThan(28);
    expect(sim.busy).toBeCloseTo(5 / 6, 1);
    // Little's law holds for the simulated averages too.
    expect(sim.avgLs / ((LIBRARY.lambda) * sim.avgWs)).toBeCloseTo(1, 1);
  });
});

import { judgeStaffing, staffMetric, type StaffMission } from './stochastic';

describe('staffing verdicts', () => {
  const m: StaffMission = {
    lambdaPerHour: 10, cva2: 1, target: 10, metric: 'wq',
    options: [
      { name: 'A', note: '', serviceMin: 5, cvs2: 1, cost: 90 },
      { name: 'B', note: '', serviceMin: 4.5, cvs2: 0, cost: 130 },
      { name: 'C', note: '', serviceMin: 4, cvs2: 1, cost: 150 },
      { name: 'D', note: '', serviceMin: 3, cvs2: 2, cost: 200 },
    ],
  };
  it('formula values', () => {
    expect(staffMetric(m, m.options[0])).toBeCloseTo(25, 8);
    expect(staffMetric(m, m.options[1])).toBeCloseTo(6.75, 8);
    expect(staffMetric(m, m.options[2])).toBeCloseTo(8, 8);
  });
  it('cheapest option that meets the target is perfect', () => {
    expect(judgeStaffing(m, 1).outcome).toBe('perfect');
    expect(judgeStaffing(m, 2).outcome).toBe('good-enough');
    expect(judgeStaffing(m, 3).outcome).toBe('too-much');
    expect(judgeStaffing(m, 0).outcome).toBe('queue-fail');
  });
});
