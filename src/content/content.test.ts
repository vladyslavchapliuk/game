import { WORLDS, findLevel } from './worlds';
import { makeRng } from '../engine/rng';
import { BREW_LINE, randomLine } from './world2';
import { bottleneckIndex, cycleTime, evaluatePlan, processCapacity, stageCapacity, utilizations } from '../engine/opm';
import { gradeLevel } from '../engine/outcome';

describe('lecture numbers (OPM 301 Lecture I, knife production re-skinned)', () => {
  it('brew line: cycle time 26 min, bottleneck boiling, 6/h, utilizations 80/100/50/20/10', () => {
    expect(cycleTime(BREW_LINE)).toBe(26);
    expect(bottleneckIndex(BREW_LINE)).toBe(1);
    expect(processCapacity(BREW_LINE)).toBe(6);
    expect(utilizations(BREW_LINE).map((u) => Math.round(u * 1000) / 10)).toEqual([80, 100, 50, 20, 10]);
  });
  it('second kettle: 7.5/h, mashing becomes the bottleneck, 100/62.5/62.5/25/12.5', () => {
    const two = BREW_LINE.map((s, i) => (i === 1 ? { ...s, machines: 2 } : s));
    expect(processCapacity(two)).toBe(7.5);
    expect(bottleneckIndex(two)).toBe(0);
    expect(utilizations(two).map((u) => Math.round(u * 1000) / 10)).toEqual([100, 62.5, 62.5, 25, 12.5]);
  });
  it('packing machine: 2 min -> 30/h, demand 25 -> 83.33%', () => {
    expect(stageCapacity({ name: 'p', minutes: 2 })).toBe(30);
    expect(Math.round((25 / 30) * 10000) / 100).toBe(83.33);
  });
});

describe('plan decisions', () => {
  it('classifies release rates', () => {
    expect(evaluatePlan(6, 6, 7).kind).toBe('perfect');
    expect(evaluatePlan(8, 6, 7).kind).toBe('bottleneck-fail');
    expect(evaluatePlan(6, 6, 5).kind).toBe('too-much');
    expect(evaluatePlan(4, 6, 5).kind).toBe('too-little');
    expect(evaluatePlan(5, 6, 5).kind).toBe('perfect');
  });
});

describe('every level builds for many seeds with valid answers', () => {
  const levels = WORLDS.flatMap((w) => w.levels);
  it.each(levels.map((l) => [l.id]))('level %s', (id) => {
    const { level } = findLevel(id)!;
    for (let seed = 1; seed <= 150; seed++) {
      const steps = level.steps(makeRng(seed));
      expect(steps.length).toBeGreaterThan(0);
      for (const s of steps) {
        if (s.kind !== 'question') continue;
        const q = s.q;
        expect(q.hints).toHaveLength(3);
        if (q.type === 'numeric') { expect(Number.isFinite(q.answer)).toBe(true); expect(q.answer).toBeGreaterThanOrEqual(0); }
        if (q.type === 'mc') expect(q.answer).toBeLessThan(q.options.length);
        if (q.type === 'tf') expect(q.reasonAnswer).toBeLessThan(q.reasons.length);
        if (q.type === 'classify') q.items.forEach((it) => expect(it.answer).toBeLessThan(q.categories.length));
        if (q.type === 'stage') expect(q.answer).toBe(bottleneckIndex(q.stages));
      }
    }
  });
});

describe('random lines always have a unique bottleneck', () => {
  it('capacity gap >= 0.5/h', () => {
    for (let seed = 1; seed < 500; seed++) {
      const caps = randomLine(makeRng(seed)).map(stageCapacity).sort((a, b) => a - b);
      expect(caps[1] - caps[0]).toBeGreaterThanOrEqual(0.5);
    }
  });
});

describe('grading', () => {
  const q = (result: 'first' | 'assisted' | 'revealed') => ({ kind: 'question' as const, id: 'x', concept: 'c', result });
  it('stars and outcomes', () => {
    expect(gradeLevel([q('first'), q('first'), q('first')], 'bottleneck-fail')).toMatchObject({ stars: 3, outcome: 'perfect', passed: true });
    expect(gradeLevel([q('first'), q('assisted'), q('first')], 'bottleneck-fail')).toMatchObject({ stars: 2, outcome: 'good-enough' });
    expect(gradeLevel([q('first'), q('revealed'), q('first')], 'bottleneck-fail')).toMatchObject({ stars: 1, passed: true });
    expect(gradeLevel([q('revealed'), q('revealed'), q('first')], 'wrong-classification')).toMatchObject({ stars: 0, outcome: 'wrong-classification', passed: false });
  });
  it('a failed plan decides the outcome', () => {
    const d = { kind: 'decision' as const, id: 'd', concept: 'c', plan: evaluatePlan(6, 6, 5), release: 6, demand: 5, capacity: 6, unit: 'x' };
    expect(gradeLevel([q('first'), d], 'too-little').outcome).toBe('too-much');
  });
});

import type { Step } from './types';
import { evaluateAggregate, evaluateLots, solveAggregate, solveLots, chasePlan, levelPlan, lotForLot, lotAtCapacity, judgeAggregate, judgeLots, type AggregateData, type LotData } from '../engine/planning';

describe('planning steps (worlds 4 + 5) are solvable and fair', () => {
  const planSteps = () => {
    const out: { level: string; step: Extract<Step, { kind: 'plan' }> }[] = [];
    for (const w of WORLDS) for (const l of w.levels) {
      if (w.id !== 4 && w.id !== 5) continue;
      for (let seed = 1; seed <= 25; seed++) {
        for (const s of l.steps(makeRng(seed))) if (s.kind === 'plan') out.push({ level: l.id, step: s });
      }
    }
    return out;
  };

  it('every plan step has a feasible optimum no worse than the simple rules', () => {
    const steps = planSteps();
    expect(steps.length).toBeGreaterThan(20);
    for (const { level, step } of steps) {
      if (step.model === 'aggregate') {
        const d = step.data as AggregateData;
        const opt = solveAggregate(d);
        const e = evaluateAggregate(d, opt.X);
        expect(e.feasible, level).toBe(true);
        expect(e.totals.total, level).toBe(opt.cost);
        for (const X of [chasePlan(d), levelPlan(d)]) {
          const b = evaluateAggregate(d, X);
          if (b.feasible) expect(opt.cost, level).toBeLessThanOrEqual(b.totals.total);
        }
        if (step.mission) expect(judgeAggregate(d, opt.X).outcome, level).toBe('perfect');
      } else {
        const d = step.data as LotData;
        const opt = solveLots(d);
        const e = evaluateLots(d, opt.X);
        expect(e.feasible, level).toBe(true);
        expect(e.totals.total, level).toBe(opt.cost);
        for (const X of [lotForLot(d), lotAtCapacity(d)]) {
          const b = evaluateLots(d, X);
          if (b.feasible) expect(opt.cost, level).toBeLessThanOrEqual(b.totals.total);
        }
        if (step.mission) expect(judgeLots(d, opt.X).outcome, level).toBe('perfect');
      }
    }
  });
});
