// Exam drill: a mixed set of questions drawn from every playable world.
// Each question keeps the learn card that introduced it as its "case".
import type { Question } from './types';
import { WORLDS } from './worlds';
import { makeRng, shuffle, type Rng } from '../engine/rng';

export interface ExamItem {
  q: Question;
  world: number;
  topic: string;
  levelId: string;
  context?: { title: string; body: string };
}

/** Worlds that contain at least one question. */
export const EXAM_WORLDS = WORLDS.filter((w) => w.levels.some((l) => l.steps(makeRng(1)).some((s) => s.kind === 'question')));

export const buildPool = (worldIds: number[], rng: Rng): ExamItem[] => {
  const items: ExamItem[] = [];
  for (const w of WORLDS) {
    if (!worldIds.includes(w.id)) continue;
    for (const l of w.levels) {
      const steps = l.steps(makeRng(Math.floor(rng() * 2 ** 31)));
      let context: ExamItem['context'];
      for (const s of steps) {
        if (s.kind === 'learn') context = { title: s.title, body: s.body };
        if (s.kind === 'question') items.push({ q: s.q, world: w.id, topic: w.topic, levelId: l.id, context });
      }
    }
  }
  return items;
};

/** Draw n questions, spread evenly over the chosen worlds. */
export const drawExam = (pool: ExamItem[], n: number, rng: Rng): ExamItem[] => {
  const byWorld = new Map<number, ExamItem[]>();
  for (const it of shuffle(rng, pool)) byWorld.set(it.world, [...(byWorld.get(it.world) ?? []), it]);
  const queues = shuffle(rng, [...byWorld.values()]);
  const out: ExamItem[] = [];
  while (out.length < n && queues.some((qs) => qs.length)) {
    for (const qs of queues) {
      const it = qs.shift();
      if (it && out.length < n) out.push(it);
    }
  }
  return shuffle(rng, out);
};
