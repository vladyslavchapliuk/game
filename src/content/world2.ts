// World 2 — Brewhouse: Process Analysis.
// Source: OPM 301 Lecture I, section 2 (Cachon & Terwiesch 2013, ch. 3).
// Lecture examples re-skinned: packing machine -> bottling machine,
// knife production (8/10/5/2/1 min) -> brew line with the same times.
import type { Level, PlanDecision, Question, Step, World } from './types';
import type { Stage } from '../engine/opm';
import {
  bottleneckIndex, constraintKind, cycleTime, fmt, processCapacity, stageCapacity, throughput, utilization,
} from '../engine/opm';
import { type Rng, int, pick, shuffle } from '../engine/rng';

export const BREW_LINE: Stage[] = [
  { name: 'Mashing', minutes: 8, prop: 'mash-tun' },
  { name: 'Boiling', minutes: 10, prop: 'kettle' },
  { name: 'Cooling', minutes: 5, prop: 'keg' },
  { name: 'Bottling', minutes: 2, prop: 'bottle' },
  { name: 'Taste test', minutes: 1, prop: 'mug' },
];
const KNIFE = 'Knife production: forging 8, grinding 10, handle 5, blade finishing 2, inspection 1 min';

const u = (x: number) => fmt(x * 100, 2);

const numeric = (
  id: string, concept: string, prompt: string, answer: number, unit: string, tolerance: number,
  hints: [string, string, string], explain: string, inLecture?: string,
): Question => ({ id, type: 'numeric', concept, prompt, answer, unit, tolerance, hints, explain, inLecture });

// ---------- Generators ----------
const MINUTES = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20] as const;
const STAGE_POOL: { name: string; prop: string }[] = [
  { name: 'Milling', prop: 'sack' },
  { name: 'Mashing', prop: 'mash-tun' },
  { name: 'Boiling', prop: 'kettle' },
  { name: 'Cooling', prop: 'keg' },
  { name: 'Bottling', prop: 'bottle' },
  { name: 'Labelling', prop: 'crate' },
  { name: 'Taste test', prop: 'mug' },
];

/** Random line with a unique bottleneck and capacities in steps of 0.5/h. */
export const randomLine = (rng: Rng, n = int(rng, 4, 5)): Stage[] => {
  for (;;) {
    const names = STAGE_POOL.slice(0, 7);
    const chosen = shuffle(rng, names).slice(0, n).sort((a, b) => STAGE_POOL.indexOf(a) - STAGE_POOL.indexOf(b));
    const stages = chosen.map((s) => ({ ...s, minutes: pick(rng, MINUTES), machines: rng() < 0.25 ? 2 : 1 }));
    const caps = stages.map(stageCapacity).sort((a, b) => a - b);
    if (caps[1] - caps[0] >= 0.5) return stages;
  }
};

const stageList = (stages: Stage[]) =>
  stages.map((s) => `${s.name} ${s.minutes} min${(s.machines ?? 1) > 1 ? ` (${s.machines} machines)` : ''}`).join(', ');

// ---------- Levels ----------
const LINE_CASE = 'Design case: 0.1 L batches, mash 60 L/h, ferment 40 L/h, bottle 50 L/h';

const L2_1: Level = {
  id: '2.1',
  world: 2,
  title: 'Brew a Batch',
  subtitle: 'Watch one batch, then a whole order, flow through the line',
  failKind: 'bottleneck-fail',
  steps: () => [
    {
      kind: 'learn',
      title: 'Capacity decides the clock',
      body:
        'Bruno brews tiny **0.1 L** test batches. Each machine has a capacity in litres per hour: **mash 60 L/h, ferment 40 L/h, bottle 50 L/h**.\n\nThe time one batch spends on a machine = quantity ÷ capacity. Moving a batch to the next machine takes **0.5 s**.',
      formula: 't = \\frac{\\text{batch size}}{\\text{capacity}} \\times 3600 \\text{ s}',
    },
    {
      kind: 'line',
      title: 'One batch through the brewery',
      brief: 'Press **Start brewing** and follow the single batch: mash, transfer, ferment, transfer, bottle.',
      config: { order: 1 },
      reveal: 'never',
      mustFinish: true,
    },
    {
      kind: 'question',
      q: numeric('2.1-a', 'w2.cycle-time', 'How long did the batch take from the start of mashing until the bottle was finished (including both transfers)?', 23.2, 's', 0.05,
        ['Add up the time on every machine, then the moves.', 'Mash $0.1/60 \\times 3600$, ferment $0.1/40 \\times 3600$, bottle $0.1/50 \\times 3600$, plus $2 \\times 0.5$ s.', '$6 + 9 + 7.2 = 22.2$ s of processing. Now add the transfers.'],
        'Flow time $= 6 + 0.5 + 9 + 0.5 + 7.2 = 23.2$ s. Processing alone is $22.2$ s; this is the cycle time $W_s$ of one flow unit.', LINE_CASE),
    },
    {
      kind: 'line',
      title: 'Now a real order: 6 batches',
      brief: 'The mash tun starts the next batch **as soon as** it hands one over. Watch where the batches pile up and check the charts below.',
      config: { order: 6 },
      reveal: 'after-run',
      mustFinish: true,
    },
    {
      kind: 'question',
      q: {
        id: '2.1-b', type: 'mc', concept: 'w2.bottleneck',
        prompt: 'Where did batches pile up, and why?',
        options: [
          'In front of the fermenter: it needs 9 s per batch while mashing delivers one every 6 s',
          'In front of bottling: bottling is the last step',
          'In front of the mash tun: it starts every batch',
          'Nowhere: all machines run at the same pace',
        ],
        answer: 0,
        hints: ['Look at the waiting-batches chart: which line climbs?', 'Work piles up before the slowest resource.', 'Compare 6 s, 9 s and 7.2 s per batch.'],
        explain: 'The fermenter (40 L/h, 9 s per batch) is the **bottleneck**. Mashing sends a batch every 6 s, so every 18 s one more batch is waiting in front of it.',
      },
    },
    {
      kind: 'question',
      q: numeric('2.1-c', 'w2.process-capacity', 'Once the line is running, how often does a finished bottle come out?', 9, 's', 0.05,
        ['The bottleneck sets the pace of the whole line.', 'Steady-state time between outputs = batch ÷ process capacity.', '$0.1 / 40 \\times 3600 = \;?$'],
        'Every **9 s**, the fermenter\'s time per batch. Process capacity $= \\min(60, 40, 50) = 40$ L/h.'),
    },
    {
      kind: 'question',
      q: numeric('2.1-d', 'w2.process-capacity', 'What is the process capacity of this line?', 40, 'L/h', 0.01,
        ['A chain is as strong as its weakest link.', 'Process capacity = min of the resource capacities.', '$\\min(60, 40, 50) = \;?$'],
        'Process capacity $= \\min(60, 40, 50) = 40$ L/h. If guests want 55 L/h, 15 L/h of demand stays unmet.'),
    },
  ],
};

const L2_2: Level = {
  id: '2.2',
  world: 2,
  title: 'One Machine',
  subtitle: 'Capacity, throughput, utilization',
  failKind: 'bottleneck-fail',
  steps: (rng) => {
    const p = pick(rng, [1.5, 2.5, 3, 4, 5, 6]);
    const cap = 60 / p;
    const d = Math.max(1, Math.floor(cap * (0.55 + rng() * 0.35)));
    return [
      {
        kind: 'learn',
        title: 'Three numbers for one machine',
        inLecture: 'Packing machine, 2 min per item, demand 25 per hour',
        body:
          '**Capacity:** the maximum number of units a resource can produce per period.\n\n**Throughput:** what it actually produces per period.\n\n**Utilization:** actual production rate ÷ maximum production rate.\n\nBruno\'s bottling machine needs **2 minutes per crate**. Guests order **25 crates per hour**.',
        formula: '\\text{Utilization} = \\frac{\\text{actual production rate}}{\\text{maximum production rate}}',
      },
      {
        kind: 'question',
        q: numeric('2.2-a', 'w2.capacity', 'What is the capacity of the bottling machine?', 30, 'crates/h', 0.01,
          ['How many 2-minute slots fit in an hour?', 'Capacity = 60 min ÷ process time per unit.', '$60 \\div 2 = \\;?$'],
          'Capacity $= 60 / 2 = 30$ crates per hour.', 'Packing machine: 2 min per item'),
      },
      {
        kind: 'question',
        q: numeric('2.2-b', 'w2.throughput', 'Demand is 25 crates per hour. What is the throughput?', 25, 'crates/h', 0.01,
          ['Can Bruno sell more than guests order?', 'Throughput = min(demand, capacity).', '$\\min(25, 30) = \\;?$'],
          'Throughput $= \\min(25, 30) = 25$ crates per hour. The machine could do more, but demand limits it.'),
      },
      {
        kind: 'question',
        q: numeric('2.2-c', 'w2.utilization', 'What is the utilization of the bottling machine?', 83.33, '%', 0.1,
          ['Compare what it does with what it could do.', 'Utilization = actual rate ÷ maximum rate.', '$25 / 30 = \\;?$'],
          'Utilization $= 25 / 30 = 83.33\\%$.', 'Packing machine: utilization 83.33%'),
      },
      {
        kind: 'question',
        q: numeric('2.2-d', 'w2.utilization',
          `New label printer: ${fmt(p)} min per crate, ${d} crates ordered per hour. What is its utilization?`,
          Number(u(d / cap)), '%', 0.1,
          ['First find its capacity.', 'Capacity = 60 / process time; utilization = throughput / capacity.', `Capacity $= 60 / ${fmt(p)} = ${fmt(cap)}$ per hour.`],
          `Capacity $= 60/${fmt(p)} = ${fmt(cap)}$/h, throughput $= \\min(${d}, ${fmt(cap)}) = ${d}$/h, utilization $= ${d}/${fmt(cap)} = ${u(d / cap)}\\%$.`),
      },
    ];
  },
};

const L2_3: Level = {
  id: '2.3',
  world: 2,
  title: 'The Line',
  subtitle: 'Cycle time and process capacity',
  failKind: 'bottleneck-fail',
  steps: () => [
    {
      kind: 'learn',
      title: 'From one machine to a line',
      inLecture: KNIFE,
      body:
        'A batch of beer passes five stations in a fixed sequence: **mashing 8 min, boiling 10 min, cooling 5 min, bottling 2 min, taste test 1 min**.\n\n**Cycle time** of one batch = the sum of the activity durations.\n\n**Resource capacity** = what each station can do per hour. **Process capacity** = the smallest resource capacity.',
      formula: '\\text{Process capacity} = \\min\\{\\text{capacity}_1, \\dots, \\text{capacity}_n\\}',
    },
    {
      kind: 'question',
      q: numeric('2.3-a', 'w2.cycle-time', 'What is the cycle time of one batch through the whole line?', 26, 'min', 0.01,
        ['One batch visits every station once.', 'Cycle time $W_s$ = sum of activity durations.', '$8 + 10 + 5 + 2 + 1 = \\;?$'],
        '$W_s = 8 + 10 + 5 + 2 + 1 = 26$ minutes.', 'Knife production: cycle time 26 min'),
    },
    {
      kind: 'question',
      q: numeric('2.3-b', 'w2.capacity', 'What is the capacity of the boiling station?', 6, 'batches/h', 0.01,
        ['How many 10-minute boils fit in an hour?', 'Capacity = 60 / process time.', '$60 / 10 = \\;?$'],
        'Boiling: $60 / 10 = 6$ batches per hour.'),
    },
    {
      kind: 'question',
      q: numeric('2.3-c', 'w2.process-capacity', 'What is the process capacity of the whole line?', 6, 'batches/h', 0.01,
        ['A chain is as strong as its weakest link.', 'Capacities: 7.5, 6, 12, 30, 60 per hour. Process capacity = the minimum.', '$\\min\\{7.5, 6, 12, 30, 60\\} = \\;?$'],
        'Capacities are 7.5, 6, 12, 30 and 60 batches/h, so process capacity $= 6$ batches/h.', 'Knife production: process capacity 6/h'),
    },
    {
      kind: 'question',
      q: numeric('2.3-d', 'w2.throughput', 'In the long run, how many batches can the line finish in 4 hours?', 24, 'batches', 0.01,
        ['Use the process capacity, not the cycle time.', 'Output = process capacity × hours.', '$6 \\times 4 = \\;?$'],
        '$6 \\text{ batches/h} \\times 4 \\text{ h} = 24$ batches. (Cycle time tells you how long one batch takes, not how many finish per hour.)',
        'Knife production: orders filled in 4 h'),
    },
  ],
};

const L2_4: Level = {
  id: '2.4',
  world: 2,
  title: 'Bottleneck Hunt',
  subtitle: 'Bottleneck, utilization per station, balanced flow',
  failKind: 'bottleneck-fail',
  steps: (rng) => {
    const line = randomLine(rng);
    const b = bottleneckIndex(line);
    return [
      {
        kind: 'learn',
        title: 'Find the slowest friend',
        body:
          'The **bottleneck** is the resource with the smallest capacity. It sets the pace of the whole process.\n\nWhen the line runs at full speed, each station\'s utilization = process capacity ÷ its own capacity. Only the bottleneck reaches 100%.\n\n**Balanced flow:** all activities are synchronized with the bottleneck, so no one waits much.',
      },
      {
        kind: 'question',
        q: {
          id: '2.4-a', type: 'stage', concept: 'w2.bottleneck', stages: BREW_LINE, answer: 1, showRates: false,
          prompt: 'Tap the bottleneck of Bruno\'s brew line.',
          hints: ['It is not simply the station with the most work… or is it?', 'Bottleneck = smallest capacity = 60 / minutes (× machines).', 'Capacities: 7.5, 6, 12, 30, 60 per hour.'],
          explain: '**Boiling** (10 min → 6 batches/h) has the smallest capacity, so it is the bottleneck.',
          inLecture: 'Knife production: grinding is the bottleneck',
        },
      },
      {
        kind: 'question',
        q: numeric('2.4-b', 'w2.utilization', 'The line runs at full speed (6 batches/h). What is the utilization of mashing?', 80, '%', 0.1,
          ['Mashing could do more than the line needs.', 'Utilization = actual rate / capacity of that station.', 'Mashing capacity $= 60/8 = 7.5$/h.'],
          'Mashing: $6 / 7.5 = 80\\%$.', 'Knife production: forging 80%'),
      },
      {
        kind: 'question',
        q: numeric('2.4-c', 'w2.utilization', 'And the utilization of cooling?', 50, '%', 0.1,
          ['Same idea, different station.', 'Cooling capacity $= 60/5$.', '$6 / 12 = \\;?$'],
          'Cooling: $6 / 12 = 50\\%$. (Bottling 20%, taste test 10%.)'),
      },
      {
        kind: 'question',
        q: {
          id: '2.4-d', type: 'stage', concept: 'w2.bottleneck', stages: line, answer: b, showRates: false,
          prompt: 'New line in the annex. Which station is the bottleneck?',
          hints: ['Work out each capacity first.', 'Capacity = 60 / minutes × machines.', `Capacities: ${line.map((s) => fmt(stageCapacity(s))).join(', ')} per hour.`],
          explain: `Capacities are ${line.map((s) => `${s.name} ${fmt(stageCapacity(s))}/h`).join(', ')}. The smallest is **${line[b].name}**.`,
        },
      },
      {
        kind: 'line',
        title: 'Experiment: shrink the waiting area',
        brief: 'Switch the buffer to **My size**, set it to 1 place and press **Try my production**. Compare the output with the unlimited buffer.',
        config: { order: 8 },
        controls: { buffer: true },
        reveal: 'after-run',
        mustFinish: true,
      },
      {
        kind: 'question',
        q: {
          id: '2.4-f', type: 'tf', concept: 'w2.bottleneck',
          prompt: 'True or false: "Limiting the waiting area in front of the fermenter to 1 batch lowers the output rate of the line."',
          answer: false,
          reasons: [
            'The fermenter still always has a batch ready, so it keeps working at 40 L/h; the mash tun gets blocked instead and less work sits waiting.',
            'Fewer waiting batches always means fewer bottles.',
            'A small buffer makes the fermenter faster.',
          ],
          reasonAnswer: 0,
          hints: ['Did the fermenter ever run out of work?', 'Output is set by the bottleneck as long as it never starves.', 'Look at the Blocked part of the mash bar in the chart.'],
          explain: 'False. With one buffer place the fermenter (the bottleneck) is never starved, so output stays at 40 L/h. The mash tun is **blocked** part of the time and there is less work in process.',
        },
      },
      {
        kind: 'question',
        q: {
          id: '2.4-e', type: 'mc', concept: 'w2.balanced-flow',
          prompt: 'What does "balanced flow" mean?',
          options: [
            'All activities are synchronized with the bottleneck activity',
            'Every station has the same processing time as the fastest station',
            'Demand equals capacity in every period',
            'The cycle time is as short as possible',
          ],
          answer: 0,
          hints: ['Which station sets the pace?', 'Maximum utilization is reached when everyone moves at the bottleneck\'s pace.', 'Look for the answer that mentions the bottleneck.'],
          explain: 'Balanced flow = all activities synchronized with the bottleneck activity, which maximizes utilization.',
        },
      },
    ];
  },
};

const withMachines = (idx: number): Stage[] => BREW_LINE.map((s, i) => (i === idx ? { ...s, machines: 2 } : s));

const L2_5: Level = {
  id: '2.5',
  world: 2,
  title: 'Add a Machine',
  subtitle: 'Parallel machines and capacity expansion',
  failKind: 'bottleneck-fail',
  steps: () => {
    const twoKettles = withMachines(1);
    return [
      {
        kind: 'learn',
        title: 'Spend money where it matters',
        inLecture: 'Knife production: a second forge or a second grinding wheel',
        body:
          'Two identical machines in parallel double a station\'s capacity (e.g. 7.5/h → 15/h).\n\nBut the process capacity only rises if you expand the **bottleneck**. And the cycle time of one batch stays the same: each batch still spends the same minutes at every station.',
      },
      {
        kind: 'question',
        q: {
          id: '2.5-a', type: 'mc', concept: 'w2.parallel',
          prompt: 'Bruno buys a second mash tun (mashing: 15/h). What is the new process capacity?',
          options: ['6 batches/h', '7.5 batches/h', '12 batches/h', '15 batches/h'],
          answer: 0,
          hints: ['Did he expand the bottleneck?', 'Process capacity = min of all capacities.', '$\\min\\{15, 6, 12, 30, 60\\} = \\;?$'],
          explain: 'Still **6/h**: boiling is still the bottleneck. The new mash tun now runs at only 40%.',
          inLecture: 'Knife production: a second forge',
        },
      },
      {
        kind: 'question',
        q: numeric('2.5-b', 'w2.parallel', 'Instead he buys a second kettle (boiling: 12/h). New process capacity?', processCapacity(twoKettles), 'batches/h', 0.01,
          ['Find the new minimum.', 'Capacities: 7.5, 12, 12, 30, 60.', '$\\min\\{7.5, 12, 12, 30, 60\\} = \\;?$'],
          'Capacities 7.5, 12, 12, 30, 60 → process capacity $= 7.5$ batches/h.', 'Knife production: two grinding wheels'),
      },
      {
        kind: 'question',
        q: {
          id: '2.5-c', type: 'stage', concept: 'w2.bottleneck', stages: twoKettles, answer: 0, showRates: true,
          prompt: 'With two kettles, where is the bottleneck now?',
          hints: ['Bottlenecks move.', 'Compare the capacities shown.', 'Which is lowest: 7.5, 12, 12, 30, 60?'],
          explain: 'The bottleneck **moves to mashing** (7.5/h).',
        },
      },
      {
        kind: 'question',
        q: numeric('2.5-d', 'w2.utilization', 'With two kettles and the line at full speed, what is the utilization of boiling?', 62.5, '%', 0.1,
          ['The line now runs at 7.5/h.', 'Utilization = 7.5 / capacity of boiling.', '$7.5 / 12 = \\;?$'],
          'Boiling: $7.5 / 12 = 62.5\\%$ (mashing 100%, cooling 62.5%, bottling 25%, taste test 12.5%).'),
      },
      {
        kind: 'line',
        title: 'Buy a second fermenter',
        brief: 'Tick **Add a 2nd fermenter**, press **Try my production** and watch where the work piles up now.',
        config: { order: 8 },
        controls: { machines: [0, 1, 2] },
        reveal: 'after-run',
        mustFinish: true,
      },
      {
        kind: 'question',
        q: {
          id: '2.5-f', type: 'mc', concept: 'w2.parallel',
          prompt: 'With two fermenters (2 × 40 = 80 L/h), what happens to the brew line?',
          options: [
            'Process capacity rises to 50 L/h and bottling becomes the bottleneck',
            'Process capacity rises to 80 L/h',
            'Nothing changes: the fermenter is still the bottleneck',
            'Process capacity rises to 60 L/h and mashing becomes the bottleneck',
          ],
          answer: 0,
          hints: ['Recompute every stage capacity.', 'Mash 60, ferment 80, bottle 50 L/h.', '$\min(60, 80, 50) = \;?$'],
          explain: 'Stage capacities become 60, 80 and 50 L/h, so process capacity $= 50$ L/h (+25%) and the bottleneck **moves to bottling**.',
          inLecture: 'Knife production: two grinding wheels',
        },
      },
      {
        kind: 'question',
        q: {
          id: '2.5-e', type: 'tf', concept: 'w2.cycle-time',
          prompt: 'True or false: "Adding a second kettle shortens the cycle time of one batch."',
          answer: false,
          reasons: [
            'Each batch still spends 10 minutes boiling, so the cycle time stays 26 minutes; only capacity rises.',
            'Two kettles halve the boiling time of each batch.',
            'Cycle time always equals 60 / process capacity.',
          ],
          reasonAnswer: 0,
          hints: ['Follow one single batch through the line.', 'Cycle time = sum of activity durations.', 'Does one batch boil faster in a second kettle?'],
          explain: 'False. Cycle time $= 8 + 10 + 5 + 2 + 1 = 26$ min is unchanged. Parallel machines raise **capacity** (more batches per hour), not the speed of one batch.',
        },
      },
    ];
  },
};

const planDecision = (id: string, stages: Stage[], demand: number, story: string, inLecture?: string): PlanDecision => ({
  id,
  concept: 'w2.throughput',
  prompt: 'How many batches per hour should Bruno start?',
  story,
  stages,
  demand,
  unit: 'batches/h',
  max: Math.max(12, Math.ceil(Math.max(demand, processCapacity(stages)) * 1.6)),
  step: 0.5,
  inLecture,
});

const L2_6: Level = {
  id: '2.6',
  world: 2,
  title: 'Supply or Demand?',
  subtitle: 'Plan the release rate — Bruno\'s job is on the line',
  failKind: 'too-little',
  steps: () => [
    {
      kind: 'learn',
      title: 'Throughput = min(demand, process capacity)',
      body:
        'If demand is **above** process capacity, the line is **supply-constrained**: the bottleneck limits output.\n\nIf demand is **below** process capacity, the line is **demand-constrained**: guests limit output.\n\nStart too much and work piles up before the bottleneck or rots in the cellar. Start too little and guests go thirsty.',
      formula: '\\text{Throughput} = \\min\\{\\text{Demand}, \\text{Process capacity}\\}',
    },
    {
      kind: 'question',
      q: {
        id: '2.6-a', type: 'mc', concept: 'w2.constraint',
        prompt: 'Process capacity is 6 batches/h and guests order 5 batches/h. What is true?',
        options: [
          'Throughput 5/h, demand-constrained',
          'Throughput 6/h, supply-constrained',
          'Throughput 5/h, supply-constrained',
          'Throughput 6/h, demand-constrained',
        ],
        answer: 0,
        hints: ['Who is the limit here: the line or the guests?', 'Throughput = min(demand, process capacity).', '$\\min(5, 6) = 5$, so who limits?'],
        explain: 'Throughput $= \\min(5, 6) = 5$/h. Demand is the limit, so the process is **demand-constrained**.',
      },
    },
    {
      kind: 'question',
      q: numeric('2.6-z', 'w2.constraint', 'Back to Bruno\'s brew line (60 / 40 / 50 L/h). Guests want 55 L/h. How much demand stays unmet per hour?', 15, 'L/h', 0.01,
        ['Can the line deliver 55 L/h?', 'Throughput = min(demand, process capacity); unmet = demand − throughput.', 'Process capacity $= \min(60, 40, 50) = 40$ L/h.'],
        'Throughput $= \min(55, 40) = 40$ L/h, so $55 - 40 = 15$ L/h stays unmet. The line is **supply-constrained**.', LINE_CASE),
    },
    {
      kind: 'decision',
      d: planDecision('2.6-b', BREW_LINE, 7,
        'Festival day! Guests want **7 batches per hour**. The brew line is the one you know: mashing 8, boiling 10, cooling 5, bottling 2, taste test 1 min.'),
    },
    {
      kind: 'decision',
      d: planDecision('2.6-c', BREW_LINE, 5,
        'A quiet Monday. Guests want only **5 batches per hour**. Same line as before. Nothing is stored for later.'),
    },
  ],
};

const L2_B: Level = {
  id: '2.B',
  world: 2,
  boss: true,
  title: 'Boss: Rush Hour',
  subtitle: 'A brand-new line, full process analysis',
  failKind: 'bottleneck-fail',
  steps: (rng) => {
    const line = randomLine(rng, 5);
    const cap = processCapacity(line);
    const b = bottleneckIndex(line);
    const demand = rng() < 0.5 ? cap + pick(rng, [1, 1.5, 2]) : Math.max(1, cap - pick(rng, [0.5, 1, 1.5]));
    const th = throughput(line, demand);
    const others = line.map((_, i) => i).filter((i) => i !== b);
    const k = pick(rng, others);
    const steps: Step[] = [
      {
        kind: 'learn',
        title: 'The annex opens',
        body: `Bruno's new annex line: **${stageList(line)}**. Guests order **${fmt(demand)} batches per hour**.\n\nDo the full analysis, then plan the release rate.`,
      },
      {
        kind: 'question',
        q: {
          id: '2.B-a', type: 'stage', concept: 'w2.bottleneck', stages: line, answer: b, showRates: false,
          prompt: 'Which station is the bottleneck?',
          hints: ['Compute every capacity.', 'Capacity = 60 / minutes × machines.', `Capacities: ${line.map((s) => fmt(stageCapacity(s))).join(', ')} per hour.`],
          explain: `Capacities: ${line.map((s) => `${s.name} ${fmt(stageCapacity(s))}/h`).join(', ')} → **${line[b].name}** is the bottleneck.`,
        },
      },
      {
        kind: 'question',
        q: numeric('2.B-b', 'w2.cycle-time', 'Cycle time of one batch?', cycleTime(line), 'min', 0.01,
          ['One batch, every station once.', 'Sum of activity durations (parallel machines do not change it).', `$${line.map((s) => s.minutes).join(' + ')} = \\;?$`],
          `$W_s = ${line.map((s) => s.minutes).join(' + ')} = ${cycleTime(line)}$ min.`),
      },
      {
        kind: 'question',
        q: numeric('2.B-c', 'w2.throughput', 'Throughput of the line?', th, 'batches/h', 0.01,
          ['Compare demand with process capacity.', 'Throughput = min(demand, process capacity).', `Process capacity $= ${fmt(cap)}$/h.`],
          `Throughput $= \\min(${fmt(demand)}, ${fmt(cap)}) = ${fmt(th)}$/h → ${constraintKind(line, demand)}.`),
      },
      {
        kind: 'question',
        q: numeric('2.B-d', 'w2.utilization', `Utilization of ${line[k].name}?`, Number(u(utilization(th, stageCapacity(line[k])))), '%', 0.1,
          ['Use the actual throughput.', 'Utilization = throughput / capacity of that station.', `${line[k].name}: capacity $= ${fmt(stageCapacity(line[k]))}$/h.`],
          `${line[k].name}: $${fmt(th)} / ${fmt(stageCapacity(line[k]))} = ${u(utilization(th, stageCapacity(line[k])))}\\%$.`),
      },
      { kind: 'decision', d: planDecision('2.B-e', line, demand, `Rush hour: guests order **${fmt(demand)} batches/h**. Set the release rate for the annex line.`) },
    ];
    return steps;
  },
};

export const world2: World = {
  id: 2,
  room: 'brewhouse',
  name: 'Brewhouse',
  topic: 'Process Analysis',
  color: 'var(--room-2)',
  lecture: 'Lecture I · Process analysis',
  levels: [L2_1, L2_2, L2_3, L2_4, L2_5, L2_6, L2_B],
};
