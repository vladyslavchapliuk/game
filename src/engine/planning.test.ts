import {
  LECTURE_AGGREGATE as A, LECTURE_LOTS as LS, chasePlan, evaluateAggregate, evaluateLots, judgeAggregate, judgeLots,
  levelPlan, lotAtCapacity, lotForLot, quantitiesFromSetups, solveAggregate, solveLots, effectiveShare,
} from './planning';
import { makeRng, int } from './rng';

describe('aggregate planning (Lecture II ch. 4)', () => {
  it('chase strategy costs 59,760 EUR (overtime 250/340/60/180)', () => {
    const ev = evaluateAggregate(A, chasePlan(A));
    expect(ev.totals.total).toBe(59760);
    expect(ev.rows.map((r) => r.O)).toEqual([0, 0, 250, 340, 0, 60, 0, 180]);
    expect(ev.totals.invCost).toBe(0);
  });
  it('level strategy costs 33,220 EUR with inventory 160/650/400/60/60/0/180/0', () => {
    const ev = evaluateAggregate(A, levelPlan(A));
    expect(levelPlan(A)[0]).toBe(750);
    expect(ev.rows.map((r) => r.L)).toEqual([160, 650, 400, 60, 60, 0, 180, 0]);
    expect(ev.totals.total).toBe(33220);
  });
  it('the lecture optimal plan costs 30,940 EUR and the solver agrees', () => {
    const lecture = [690, 750, 750, 750, 750, 810, 750, 750];
    const ev = evaluateAggregate(A, lecture);
    expect(ev.rows.map((r) => r.L)).toEqual([100, 590, 340, 0, 0, 0, 180, 0]);
    expect(ev.totals.invCost).toBe(26620);
    expect(ev.totals.otCost).toBe(4320);
    expect(ev.totals.total).toBe(30940);
    expect(solveAggregate(A).cost).toBe(30940);
  });
  it('k_o = 32 gives 22,260 EUR; k_o = 112 gives the level strategy 33,220 EUR', () => {
    expect(solveAggregate({ ...A, ko: 32 }).cost).toBe(22260);
    expect(evaluateAggregate({ ...A, ko: 32 }, [590, 510, 750, 1090, 750, 810, 750, 750]).totals.total).toBe(22260);
    expect(solveAggregate({ ...A, ko: 112 }).cost).toBe(33220);
  });
  it('with backlog (k_b = 18) the optimum is 30,700 EUR', () => {
    const B = { ...A, kb: 18 };
    const plan = [690, 750, 750, 750, 750, 750, 750, 810];
    const ev = evaluateAggregate(B, plan);
    expect(ev.rows.map((r) => r.B)).toEqual([0, 0, 0, 0, 0, 60, 0, 0]);
    expect(ev.totals).toMatchObject({ invCost: 25300, otCost: 4320, blCost: 1080, total: 30700 });
    expect(solveAggregate(B).cost).toBe(30700);
  });
  it('shortage without backlog is infeasible', () => {
    const ev = evaluateAggregate(A, [750, 750, 750, 750, 750, 750, 750, 600]);
    expect(ev.feasible).toBe(false);
    expect(ev.shortage).toEqual([{ t: 8, units: 150 }]);
  });
  it('verdicts', () => {
    expect(judgeAggregate(A, [690, 750, 750, 750, 750, 810, 750, 750]).outcome).toBe('perfect');
    expect(judgeAggregate(A, levelPlan(A)).outcome).toBe('good-enough');
    expect(judgeAggregate(A, chasePlan(A).map((x) => x + 100)).outcome).toBe('too-much');
    expect(judgeAggregate(A, [0, 0, 0, 0, 0, 0, 0, 0]).outcome).toBe('too-little');
  });
  it('solver is never beaten by chase or level on random data', () => {
    for (let seed = 1; seed < 60; seed++) {
      const rng = makeRng(seed);
      const T = int(rng, 5, 8);
      const data = { demand: Array.from({ length: T }, () => int(rng, 20, 120) * 5), c: int(rng, 60, 110) * 5, kl: int(rng, 1, 6) * 5, ko: int(rng, 6, 20) * 5 };
      const best = solveAggregate(data);
      expect(evaluateAggregate(data, best.X).feasible).toBe(true);
      expect(evaluateAggregate(data, best.X).totals.total).toBe(best.cost);
      expect(best.cost).toBeLessThanOrEqual(evaluateAggregate(data, chasePlan(data)).totals.total);
      const lv = evaluateAggregate(data, levelPlan(data));
      if (lv.feasible) expect(best.cost).toBeLessThanOrEqual(lv.totals.total);
    }
  });
});

describe('capacitated lot sizing (Lecture II ch. 5)', () => {
  it('lot-for-lot costs 1,000 EUR', () => {
    expect(evaluateLots(LS, lotForLot(LS)).totals.total).toBe(1000);
  });
  it('lot size = capacity costs 900 EUR (produce 150 in periods 1 and 5)', () => {
    expect(lotAtCapacity(LS)).toEqual([150, 0, 0, 0, 150, 0, 0, 0, 0, 0]);
    const ev = evaluateLots(LS, lotAtCapacity(LS));
    expect(ev.totals).toMatchObject({ setupCost: 200, invCost: 700, total: 900 });
  });
  it('the minimum-cost plan costs 580 EUR (80 / 130 / 90 in periods 1, 4, 8)', () => {
    const X = quantitiesFromSetups(LS, [true, false, false, true, false, false, false, true, false, false]);
    expect(X).toEqual([80, 0, 0, 130, 0, 0, 0, 90, 0, 0]);
    expect(evaluateLots(LS, X).totals).toMatchObject({ setupCost: 300, invCost: 280, total: 580 });
    expect(solveLots(LS).cost).toBe(580);
  });
  it('capacity is respected by the solver and flagged in plans', () => {
    const tight = { ...LS, c: 60 };
    const best = solveLots(tight);
    expect(Math.max(...best.X)).toBeLessThanOrEqual(60);
    expect(evaluateLots(tight, lotAtCapacity(LS)).overCapacity.length).toBeGreaterThan(0);
  });
  it('verdicts', () => {
    expect(judgeLots(LS, [80, 0, 0, 130, 0, 0, 0, 90, 0, 0]).outcome).toBe('perfect');
    expect(judgeLots(LS, lotAtCapacity(LS)).outcome).toBe('good-enough');
    expect(judgeLots(LS, [300, 0, 0, 0, 0, 0, 0, 0, 0, 0]).outcome).toBe('bottleneck-fail');
    expect(judgeLots(LS, [20, 50, 10, 0, 0, 0, 0, 0, 0, 0]).outcome).toBe('too-little');
  });
  it('effective production share rises with lot size', () => {
    expect(effectiveShare(10, 2, 1)).toBeCloseTo(10 / 12);
    expect(effectiveShare(40, 2, 1)).toBeGreaterThan(effectiveShare(10, 2, 1));
  });
});
