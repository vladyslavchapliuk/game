import { MISSIONS, bestPlan, judgePlan, emptyPlan, planStats, simulateShift, measuredOutput } from './factory';

describe('Factory Yard missions', () => {
  it('every mission has a feasible best plan within budget', () => {
    for (const m of MISSIONS) {
      const b = bestPlan(m.demand, m.slots);
      expect(b).not.toBeNull();
      expect(b!.cost).toBeLessThanOrEqual(m.budget);
      expect(planStats(b!.plan, m.demand).processCapacity).toBeGreaterThanOrEqual(m.demand);
      console.log(m.id, 'best', b!.cost, JSON.stringify(b!.plan.slots.map((r) => r.filter(Boolean))));
    }
  });
  it('the best plan is judged perfect, an empty hall too little', () => {
    for (const m of MISSIONS) {
      expect(judgePlan(bestPlan(m.demand, m.slots)!.plan, m).outcome).toBe('perfect');
      expect(judgePlan(emptyPlan(), m).outcome).toBe('too-little');
    }
  });
  it('overbuilding is too much', () => {
    const m = MISSIONS[0];
    const plan = emptyPlan();
    plan.slots = [['mash-2', 'mash-2', null, null], ['ferm-2', 'ferm-2', null, null], ['bott-2', 'bott-2', null, null]];
    expect(judgePlan(plan, m).outcome).toBe('too-much');
  });
  it('the shift simulation delivers demand when capacity suffices', () => {
    for (const m of MISSIONS) {
      const r = simulateShift(bestPlan(m.demand, m.slots)!.plan, m.demand)!;
      expect(measuredOutput(r)).toBeGreaterThanOrEqual(m.demand - 2);
    }
  });
  it('and delivers only process capacity when it does not', () => {
    const m = MISSIONS[1];
    const r = simulateShift(m.start!, m.demand)!;
    const cap = planStats(m.start!, m.demand).processCapacity;
    expect(measuredOutput(r)).toBeLessThanOrEqual(cap + 1.5);
    expect(measuredOutput(r)).toBeGreaterThanOrEqual(cap - 3);
  });
});
