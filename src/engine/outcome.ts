import type { FailKind, OutcomeKind } from '../content/types';
import type { PlanResult } from './opm';
import type { FactoryOutcome } from './factory';
import type { PlanOutcome } from './planning';
import type { SelectionOutcome } from './lp';
import type { StaffOutcome } from './stochastic';

export type QuestionResult = 'first' | 'assisted' | 'revealed';

export type StepRecord =
  | { kind: 'question'; id: string; concept: string; result: QuestionResult }
  | { kind: 'decision'; id: string; concept: string; plan: PlanResult; release: number; demand: number; capacity: number; unit: string }
  | {
      kind: 'factory'; id: string; concept: string; outcome: FactoryOutcome; cost: number; best: number; budget: number;
      capacity: number; demand: number; unmet: number; stageCaps: number[]; idleCapacity: number;
    }
  | {
      kind: 'plan'; id: string; concept: string; model: 'aggregate' | 'lotsize'; outcome: PlanOutcome; cost: number; best: number;
      baseline: number; baselineName: string; shortage: number; overCap: number;
    }
  | {
      kind: 'select'; id: string; concept: string; outcome: SelectionOutcome; z: number; best: number;
      plan: number[]; keys: string[]; bestPlan: number[]; problems: string;
    }
  | {
      kind: 'staff'; id: string; concept: string; outcome: StaffOutcome; choice: string; cost: number; bestCost: number;
      bestName: string; value: number; target: number; metric: 'wq' | 'ws';
    };

export interface Grade {
  outcome: OutcomeKind;
  stars: 0 | 1 | 2 | 3;
  passed: boolean;
  firstTry: number;
  total: number;
  revealed: number;
  failedDecision?: Extract<StepRecord, { kind: 'decision' }>;
  factory?: Extract<StepRecord, { kind: 'factory' }>;
  plan?: Extract<StepRecord, { kind: 'plan' }>;
  select?: Extract<StepRecord, { kind: 'select' }>;
  staff?: Extract<StepRecord, { kind: 'staff' }>;
}

/**
 * Stars: 3 = every question right first time without hints and every plan
 * exact; 2 = no revealed solutions; 1 = passed with some revealed solutions.
 * A level fails when a committed plan is wrong or when more than a third of
 * its questions needed the solution revealed.
 */
export const gradeLevel = (records: StepRecord[], failKind: FailKind): Grade => {
  const qs = records.filter((r): r is Extract<StepRecord, { kind: 'question' }> => r.kind === 'question');
  const firstTry = qs.filter((q) => q.result === 'first').length;
  const revealed = qs.filter((q) => q.result === 'revealed').length;
  const assisted = qs.filter((q) => q.result === 'assisted').length;
  const total = qs.length;
  const failedDecision = records.find(
    (r): r is Extract<StepRecord, { kind: 'decision' }> => r.kind === 'decision' && r.plan.kind !== 'perfect',
  );
  const factory = records.find((r): r is Extract<StepRecord, { kind: 'factory' }> => r.kind === 'factory');
  if (factory) {
    const ok = factory.outcome === 'perfect' || factory.outcome === 'good-enough';
    const cap: 0 | 2 | 3 = factory.outcome === 'perfect' ? 3 : ok ? 2 : 0;
    const qStars = revealed === 0 && assisted === 0 ? 3 : revealed === 0 ? 2 : 1;
    const stars = ok ? (Math.min(cap, qStars) as 1 | 2 | 3) : 0;
    return { outcome: factory.outcome, stars, passed: ok, firstTry, total, revealed, factory };
  }
  const mission = records.find(
    (r): r is Extract<StepRecord, { kind: 'plan' | 'select' | 'staff' }> => r.kind === 'plan' || r.kind === 'select' || r.kind === 'staff',
  );
  if (mission) {
    const ok = mission.outcome === 'perfect' || mission.outcome === 'good-enough';
    const cap: 0 | 2 | 3 = mission.outcome === 'perfect' ? 3 : ok ? 2 : 0;
    const qStars = revealed === 0 && assisted === 0 ? 3 : revealed === 0 ? 2 : 1;
    const stars = ok ? (Math.min(cap, qStars) as 1 | 2 | 3) : 0;
    return { outcome: mission.outcome, stars, passed: ok, firstTry, total, revealed, [mission.kind]: mission };
  }
  if (failedDecision) {
    return { outcome: failedDecision.plan.kind as FailKind, stars: 0, passed: false, firstTry, total, revealed, failedDecision };
  }
  if (revealed > Math.floor(total / 3)) {
    return { outcome: failKind, stars: 0, passed: false, firstTry, total, revealed };
  }
  const stars: 1 | 2 | 3 = revealed === 0 && assisted === 0 ? 3 : revealed === 0 ? 2 : 1;
  return { outcome: stars === 3 ? 'perfect' : 'good-enough', stars, passed: true, firstTry, total, revealed };
};

export const coinsFor = (g: Grade): number => (g.passed ? 10 + 10 * g.stars : 5);
