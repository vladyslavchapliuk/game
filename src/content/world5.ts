// World 5 — Kettle Room: Capacitated lot sizing (OPM 301 Lecture II, ch. 5).
// Lecture numbers: d = 20, 50, 10, 50, 50, 10, 20, 40, 20, 30; c = 150; s = 100 EUR;
// k^l = 1 EUR. Lot-for-lot 1,000 · lot size = capacity 900 · optimal 580 (80/130/90
// in periods 1, 4, 8). Two products: 995 EUR.
import type { Level, Question, World } from './types';
import { LECTURE_LOTS as LS, type LotData, solveLots } from '../engine/planning';
import { int, pick } from '../engine/rng';

const LECT = 'Lot sizing example: 10 periods, c = 150, s = 100 EUR, $k^l = 1$ EUR';

const numeric = (
  id: string, concept: string, prompt: string, answer: number, unit: string, tolerance: number,
  hints: [string, string, string], explain: string, inLecture?: string,
): Question => ({ id, type: 'numeric', concept, prompt, answer, unit, tolerance, hints, explain, inLecture });

const setupsIf = (patch: Partial<LotData>) => solveLots({ ...LS, ...patch }).X.filter((x) => x > 0).length;

const L5_1: Level = {
  id: '5.1', world: 5, title: 'Setups Cost', subtitle: 'Setup time, setup cost, effective capacity', failKind: 'too-much',
  steps: () => [
    {
      kind: 'learn', title: 'Cleaning the kettle is not free',
      body:
        'Before brewing a new batch Bruno must **set up** the kettle: rinse it, change materials. That is the **setup process**.\n\n' +
        '**Setup time** reduces productive time. **Setup costs** are personnel, material and ramp-up costs (and waste).\n\n' +
        'The decision: **combine the demand of several periods into one lot** to save setups, at the price of holding stock. Goal: cost-minimal lot sizes under limited capacity.',
      formula: '\\text{share of effective production time} = \\frac{\\text{production time}}{\\text{setup time} + \\text{production time}}',
    },
    { kind: 'question', q: numeric('5.1-a', 'w5.setup', 'A kettle clean-out takes **2 h**, brewing takes **1 h per keg**. With a lot size of **10 kegs**, what share of the time is effective production?', 83.33, '%', 0.1,
      ['Production time for the lot first.', 'Share = production ÷ (setup + production).', '$10 \\div (2 + 10) = \\;?$'],
      'Production 10 h, setup 2 h: $10 / 12 = 83.33\\%$. With 40 kegs: $40/42 = 95.2\\%$. Larger lots raise the effective capacity.', 'Effective capacity vs. lot size (setup 2 h / 5 h)') },
    { kind: 'question', q: {
      id: '5.1-b', type: 'mc', concept: 'w5.setup',
      prompt: 'What happens to the share of effective production time when the lot size grows?',
      options: ['It rises towards 100%', 'It falls', 'It stays the same', 'It depends only on demand'],
      answer: 0,
      hints: ['The setup happens once per lot.', 'Setup time is fixed, production time grows with the lot.', 'Fixed part ÷ bigger total = ?'],
      explain: 'The fixed setup time is spread over more units, so the share of effective production time rises towards 100%.',
    } },
    { kind: 'question', q: {
      id: '5.1-c', type: 'classify', concept: 'w5.setup',
      prompt: 'Setup cost or holding cost?',
      categories: ['Setup cost (per lot)', 'Holding cost (per unit and period)'],
      items: [
        { label: 'Wages for rinsing the kettle', answer: 0 },
        { label: 'Beer lost when flushing the line', answer: 0 },
        { label: 'Capital tied up in stored kegs', answer: 1 },
        { label: 'Cellar space for waiting kegs', answer: 1 },
      ],
      hints: ['Does the cost happen once per production run?', 'Or does it grow with how long stock waits?', 'Rinsing and flushing happen per run.'],
      explain: 'Rinsing labour and flushing waste occur **per setup**. Capital and space grow with **units × periods stored**.',
    } },
  ],
};

const L5_2: Level = {
  id: '5.2', world: 5, title: 'Two Simple Rules', subtitle: 'Lot-for-lot vs. lot size = capacity', failKind: 'too-much',
  steps: () => [
    { kind: 'plan', title: 'Rule 1: lot-for-lot', brief: 'Brew exactly each period\'s demand. Switch to the other rule with the button above the table.',
      model: 'lotsize', data: LS, start: 'lfl', editable: false, presets: ['lfl', 'cap'], inLecture: LECT },
    { kind: 'question', q: numeric('5.2-a', 'w5.rules', 'Relevant costs of **lot-for-lot**?', 1000, 'EUR', 0.5,
      ['How many setups, and is there any stock?', '10 periods with demand > 0, each needs a setup; no inventory.', '$10 \\times 100 = \\;?$'],
      '10 setups × 100 EUR = 1,000 EUR, no holding costs.', LECT) },
    { kind: 'question', q: numeric('5.2-b', 'w5.rules', 'Rule 2 brews 150 (the capacity) whenever stock runs out. Its relevant costs?', 900, 'EUR', 0.5,
      ['Switch the table to "Lot size = capacity".', 'Setups in periods 1 and 5; add all end-of-period inventories.', 'Setups 200 EUR + holding 700 EUR.'],
      '2 setups (200 EUR) + holding $\\sum L_t = 700$ units × 1 EUR = **900 EUR**.', LECT) },
    { kind: 'question', q: numeric('5.2-c', 'w5.rules', 'With lot size = capacity, what is the inventory at the end of period 1, $L_1$?', 130, 'units', 0.01,
      ['Production minus demand in period 1.', '$L_1 = X_1 - d_1$.', '$150 - 20 = \\;?$'],
      '$L_1 = 150 - 20 = 130$ units, costing 130 EUR in holding.', LECT) },
  ],
};

const L5_3: Level = {
  id: '5.3', world: 5, title: 'The Model', subtitle: 'Binary setups and the big M', failKind: 'too-much',
  steps: () => [
    { kind: 'model', modelId: 'lot-sizing', title: 'The capacitated lot sizing model', body: 'A mixed-integer program: $\\Gamma_t$ is binary, and the big number $M$ links production to setups.' },
    { kind: 'question', q: {
      id: '5.3-a', type: 'tf', concept: 'w5.model',
      prompt: 'True or false: "Because of $X_t \\le M \\cdot \\Gamma_t$, any production in period t forces $\\Gamma_t = 1$."',
      answer: true,
      reasons: ['If $\\Gamma_t = 0$ the constraint reads $X_t \\le 0$, so producing requires $\\Gamma_t = 1$.', '$M$ is always zero.', '$\\Gamma_t$ is a parameter.'],
      reasonAnswer: 0,
      hints: ['Plug in $\\Gamma_t = 0$.', '$M \\cdot 0 = 0$.', 'What does $X_t \\le 0$ with $X_t \\ge 0$ mean?'],
      explain: 'True. With $\\Gamma_t = 0$ the constraint becomes $X_t \\le 0$. With $\\Gamma_t = 1$ it becomes $X_t \\le M$, which never binds if $M \\ge c$.',
    } },
    { kind: 'question', q: {
      id: '5.3-b', type: 'mc', concept: 'w5.model',
      prompt: 'Nothing in the constraints stops $\\Gamma_t = 1$ when $X_t = 0$. Why does the optimum still set $\\Gamma_t = 0$ then?',
      options: ['Every setup adds $s$ to the objective, and minimizing removes useless setups', 'Because $M$ is large', 'Because demand is zero', 'It does not; $\\Gamma_t$ is always 1'],
      answer: 0,
      hints: ['Look at the objective function.', 'Which term contains $\\Gamma_t$?', '$s \\cdot \\Gamma_t$ costs money.'],
      explain: 'The objective contains $s \\cdot \\Gamma_t$. A setup without production only adds cost, so a minimizing solver never chooses it.',
    } },
    { kind: 'question', q: {
      id: '5.3-c', type: 'mc', concept: 'w5.model',
      prompt: 'What is the smallest sensible value for $M$ in this example?',
      options: ['c = 150', 'Total demand 300', '1', 's = 100'],
      answer: 0,
      hints: ['M must never cut off a feasible production quantity.', 'Production is limited by $X_t \\le c$ anyway.', 'The lecture: $M \\ge c$.'],
      explain: '$M \\ge c = 150$ is enough, since $X_t \\le c$ already caps production.',
    } },
  ],
};

const L5_4: Level = {
  id: '5.4', world: 5, title: 'Optimal Lots', subtitle: 'Find the minimum-cost production plan', failKind: 'too-much',
  steps: () => [
    { kind: 'learn', title: 'Beat both rules', inLecture: LECT,
      body: 'Click a $\\Gamma_t$ cell to brew in that period: $X_t$ then covers demand up to the next brew. You can also type $X_t$ directly.\n\nA lot may not exceed **c = 150** (red = over capacity). Beat both rules (900 EUR); hit par for three stars.' },
    { kind: 'plan', title: 'Plan the kettle room', brief: 'Trade setups (100 EUR each) against holding (1 EUR per keg and period).', mission: true,
      model: 'lotsize', data: LS, start: 'lfl', editable: true, presets: ['lfl', 'cap', 'clear'], showPar: true, inLecture: LECT },
  ],
};

const L5_5: Level = {
  id: '5.5', world: 5, title: 'Sensitivity', subtitle: 'How setup and holding costs change the plan', failKind: 'too-much',
  steps: () => {
    const s500 = setupsIf({ s: 500 });
    const kl3 = setupsIf({ kl: 3 });
    return [
      { kind: 'learn', title: 'Two costs, one trade-off', inLecture: 'Sensitivity: number of setups vs. $k^l$ and s',
        body: 'Lot sizing **trades off setup costs against holding costs**. The lecture solves the example for many values of $s$ and $k^l$ and counts the setups in the optimal plan (3 at the base case).' },
      { kind: 'question', q: numeric('5.5-a', 'w5.sensitivity', 'The setup cost rises to **s = 500 EUR**. How many setups does the optimal plan use?', s500, 'setups', 0.01,
        ['Setups got 5× more expensive.', 'Bigger lots, fewer setups, but each lot $\\le c = 150$ and total demand is 300.', 'What is the minimum number of lots of at most 150 that cover 300?'],
        `Only **${s500}** setups: two full lots of 150 (periods 1 and 5). The capacity c = 150 stops it going lower.`, 'Setups fall as s rises') },
      { kind: 'question', q: numeric('5.5-b', 'w5.sensitivity', 'Back to s = 100, but holding now costs **$k^l = 3$ EUR** per unit and period. How many setups in the optimal plan?', kl3, 'setups', 0.01,
        ['Storing is 3× more expensive.', 'A setup (100) now pays off if it avoids ~34 unit-periods of stock.', 'Expect more, smaller lots.'],
        `**${kl3}** setups: expensive storage pushes towards lot-for-lot.`, 'Setups rise as $k^l$ rises') },
      { kind: 'question', q: {
        id: '5.5-c', type: 'tf', concept: 'w5.sensitivity',
        prompt: 'True or false: "Setup times reduce the effective production capacity, so a line with long setups prefers larger lots."',
        answer: true,
        reasons: ['Each setup eats capacity; fewer setups leave more time to produce.', 'Setup time never matters.', 'Larger lots increase setup time.'],
        reasonAnswer: 0,
        hints: ['Remember the effective-capacity chart.', 'More setups = more non-productive time.', 'Which lot size wastes less capacity?'],
        explain: 'True. With long setups, frequent small lots can even make the plan infeasible because setups consume capacity.',
      } },
    ];
  },
};

const L5_6: Level = {
  id: '5.6', world: 5, title: 'Two Products', subtitle: 'Sharing one kettle', failKind: 'too-much',
  steps: () => [
    { kind: 'model', modelId: 'lot-sizing-multi', title: 'Lot sizing with multiple products',
      body: 'Two beers share 150 kettle hours per period (1 hour per unit each). Each has its own setups (100 EUR) and holding cost (1 EUR).' },
    { kind: 'question', q: numeric('5.6-a', 'w5.multi', 'The lecture\'s minimum-cost plan for both products costs setups 700 EUR plus holding 295 EUR. Total?', 995, 'EUR', 0.5,
      ['Add the two cost types.', 'Relevant costs = setup + holding.', '$700 + 295 = \\;?$'],
      '$700 + 295 = 995$ EUR (7 setups).', 'Two products: 995 EUR') },
    { kind: 'question', q: {
      id: '5.6-b', type: 'mc', concept: 'w5.multi',
      prompt: 'Which constraint couples the two products?',
      options: ['$\\sum_i a_i X_{it} \\le c$ (shared capacity)', '$X_{it} \\le M \\cdot \\Gamma_{it}$', 'The inventory balance of each product', 'The objective function'],
      answer: 0,
      hints: ['Which constraint contains both products at once?', 'Setups and balances are per product.', 'They compete for kettle hours.'],
      explain: 'Only the capacity constraint sums over products: $\\sum_i a_i X_{it} \\le c$. Everything else is per product.',
    } },
  ],
};

const L5_B: Level = {
  id: '5.B', world: 5, title: 'Boss: Festival Brews', subtitle: 'Fresh numbers, find the cheapest lots', failKind: 'too-much', boss: true,
  steps: (rng) => {
    const T = 8;
    const demand: number[] = Array.from({ length: T }, () => pick(rng, [0, 10, 20, 20, 30, 40, 50, 60] as number[]));
    if (demand.reduce((a, b) => a + b, 0) === 0) demand[0] = 30;
    const data: LotData = { demand, c: pick(rng, [100, 120, 150]), s: pick(rng, [60, 80, 100, 150]), kl: int(rng, 1, 3) };
    return [
      { kind: 'learn', title: 'Festival brews', body: `Eight periods, kettle capacity **c = ${data.c}**, setup **s = ${data.s} EUR**, holding **$k^l = ${data.kl}$ EUR** per keg and period.\n\nCombine periods into lots wisely. Hit par for the beach.` },
      { kind: 'plan', title: 'Plan the festival brews', brief: 'Beat both rules; hit par for three stars.', mission: true,
        model: 'lotsize', data, start: 'lfl', editable: true, presets: ['lfl', 'cap', 'clear'], showPar: true },
    ];
  },
};

export const world5: World = {
  id: 5, room: 'kettle-room', name: 'Kettle Room', topic: 'Lot Sizing', color: 'var(--room-5)',
  lecture: 'Lecture II · ch. 5', levels: [L5_1, L5_2, L5_3, L5_4, L5_5, L5_6, L5_B],
};
