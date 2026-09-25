// World 4 — Barrel Cellar: Aggregate planning (OPM 301 Lecture II, ch. 4).
// All lecture numbers: d = 590, 260, 1000, 1090, 750, 810, 570, 930; c = 750;
// k^l = 22 EUR, k^o = 72 EUR. Chase 59,760 · Level 33,220 · Optimal 30,940 ·
// k^o = 32 → 22,260 · k^o = 112 → level · backlog k^b = 18 → 30,700.
import type { Level, Question, World } from './types';
import { LECTURE_AGGREGATE as A, type AggregateData } from '../engine/planning';
import { int } from '../engine/rng';

const LECT = 'Aggregate planning example: 8 periods, c = 750, $k^l = 22$, $k^o = 72$';

const numeric = (
  id: string, concept: string, prompt: string, answer: number, unit: string, tolerance: number,
  hints: [string, string, string], explain: string, inLecture?: string,
): Question => ({ id, type: 'numeric', concept, prompt, answer, unit, tolerance, hints, explain, inLecture });

const L4_1: Level = {
  id: '4.1', world: 4, title: 'Bumpy Demand', subtitle: 'Time-dependent demand and inventory costs', failKind: 'too-much',
  steps: () => [
    {
      kind: 'learn', title: 'How much to brew, and when?', inLecture: LECT,
      body:
        'Demand in the cellar is **time-dependent**: 590, 260, 1000, 1090, 750, 810, 570 and 930 barrels over 8 periods, while the brewhouse can make **c = 750** per period.\n\n' +
        'Aggregate planning looks at **aggregated product types**, **global (factory) capacities** and a horizon of **several months to two years**. Bruno can react with **overtime or reduced hours**, **outsourcing**, or by **building up and drawing down inventory** (pre-production).\n\n' +
        'Inventory is a mismatch between supply and demand: supply waits for demand. It costs **capital, depreciation, storage space and handling**.',
    },
    {
      kind: 'question', q: {
        id: '4.1-a', type: 'mc', concept: 'w4.inventory-costs',
        prompt: 'Which of these is **not** one of the main inventory holding cost components from the lecture?',
        options: ['Cost of capital', 'Depreciation', 'Setup cost', 'Storage space', 'Handling cost'],
        answer: 2,
        hints: ['Think of what a barrel costs while it waits in the cellar.', 'Holding costs grow with the time and number of units stored.', 'Which cost occurs when a machine is prepared, not while stock waits?'],
        explain: 'Holding costs are **capital, depreciation, storage space and handling**. A setup cost belongs to lot sizing: it is paid per production run, not per unit stored.',
      },
    },
    {
      kind: 'question', q: {
        id: '4.1-b', type: 'mc', concept: 'w4.variability',
        prompt: 'Where does the lecture\'s aggregate planning problem sit in the variability cube (demand side)?',
        options: ['Time-dependent, deterministic', 'Stationary, stochastic', 'Stationary, deterministic', 'Time-dependent, stochastic'],
        answer: 0,
        hints: ['Does demand change between periods?', 'Is demand known in advance in the model?', 'The model uses given numbers $d_t$ that differ per period.'],
        explain: 'Demand **changes over time** (time-dependent) but is **known** in the model (deterministic): the $d_t$ are fixed input data.',
      },
    },
    { kind: 'question', q: numeric('4.1-c', 'w4.data', 'Total demand is 6,000 barrels over 8 periods. What is the **average demand per period**?', 750, 'units', 0.01,
      ['Divide the total by the number of periods.', 'Average $= \\sum_t d_t / T$.', '$6000 / 8 = \\;?$'],
      'Average demand $= 6000 / 8 = 750$, exactly the capacity c. Yet periods 3, 4, 6 and 8 need more than 750: timing is the problem, not total volume.', LECT) },
  ],
};

const L4_2: Level = {
  id: '4.2', world: 4, title: 'Chase', subtitle: 'Production equals demand, every period', failKind: 'too-much',
  steps: () => [
    {
      kind: 'learn', title: 'The chase strategy', inLecture: LECT,
      body: 'A **reactive** approach: produce exactly the demand in each period, $X_t = d_t$. Capacity is adapted with **overtime** whenever $d_t > c$. There is **no inventory**.',
      formula: 'O_t = \\max(0,\\; X_t - c), \\qquad \\text{costs} = \\sum_t k^o \\cdot O_t',
    },
    {
      kind: 'plan', title: 'Bruno\'s chase plan', brief: 'Read the table like the lecture slide. Hover a period to highlight it.',
      model: 'aggregate', data: A, start: 'chase', editable: false, inLecture: LECT,
    },
    { kind: 'question', q: numeric('4.2-a', 'w4.chase', 'How much **overtime** does the chase plan need in period 4?', 340, 'units', 0.01,
      ['Compare demand in period 4 with the capacity.', '$O_t = \\max(0, X_t - c)$ with $X_t = d_t$.', '$1090 - 750 = \\;?$'],
      '$O_4 = 1090 - 750 = 340$ units. Overtime is also needed in periods 3 (250), 6 (60) and 8 (180).', LECT) },
    { kind: 'question', q: numeric('4.2-b', 'w4.chase', 'What are the total **relevant costs** of the chase strategy?', 59760, 'EUR', 0.5,
      ['Only overtime costs occur, no inventory.', 'Total overtime = 250 + 340 + 60 + 180 units, each at $k^o = 72$ EUR.', '$830 \\times 72 = \\;?$'],
      '$830 \\times 72 = 59{,}760$ EUR, all overtime; inventory costs are 0.', LECT) },
  ],
};

const L4_3: Level = {
  id: '4.3', world: 4, title: 'Level', subtitle: 'Constant production, rising and falling stock', failKind: 'too-much',
  steps: () => [
    {
      kind: 'learn', title: 'The level strategy', inLecture: LECT,
      body: 'Produce a **constant volume** every period, here the average demand of **750**. Inventory rises in quiet periods and falls in busy ones. No overtime, but **inventory costs**.',
      formula: 'L_t = L_{t-1} + X_t - d_t, \\qquad \\text{costs} = \\sum_t k^l \\cdot L_t',
    },
    { kind: 'plan', title: 'Bruno\'s level plan', brief: 'Follow the inventory row: it is built with the balance equation, period by period.',
      model: 'aggregate', data: A, start: 'level', editable: false, inLecture: LECT },
    { kind: 'question', q: numeric('4.3-a', 'w4.balance', 'Inventory at the end of period 2, $L_2$?', 650, 'units', 0.01,
      ['Start with $L_1$.', '$L_1 = X_1 - d_1$, then $L_2 = L_1 + X_2 - d_2$.', '$L_1 = 750 - 590 = 160$.'],
      '$L_1 = 750 - 590 = 160$, $L_2 = 160 + 750 - 260 = 650$.', LECT) },
    { kind: 'question', q: numeric('4.3-b', 'w4.level', 'Total relevant costs of the level strategy?', 33220, 'EUR', 0.5,
      ['Only inventory costs occur.', 'Sum of $L_t$ = 160 + 650 + 400 + 60 + 60 + 0 + 180 + 0, times $k^l = 22$.', '$1510 \\times 22 = \\;?$'],
      '$\\sum L_t = 1510$, so $1510 \\times 22 = 33{,}220$ EUR. Cheaper than chase (59,760 EUR) because holding (22) is much cheaper than overtime (72).', LECT) },
    { kind: 'question', q: {
      id: '4.3-c', type: 'tf', concept: 'w4.level',
      prompt: 'True or false: "Level is always cheaper than chase."',
      answer: false,
      reasons: [
        'It depends on the costs: if holding one unit for a period costs more than overtime ($k^l \\ge k^o$), chasing is cheaper.',
        'Level never uses overtime, so it is always cheaper.',
        'Chase never holds stock, so it is always cheaper.',
      ],
      reasonAnswer: 0,
      hints: ['Which cost does each strategy pay?', 'Chase pays $k^o$ per unit of overtime; level pays $k^l$ per unit and period stored.', 'What if storage were very expensive?'],
      explain: 'False. Level trades overtime for inventory. Here $k^l = 22 < k^o = 72$, so level wins; with expensive storage the ranking flips.',
    } },
  ],
};

const L4_4: Level = {
  id: '4.4', world: 4, title: 'The Model', subtitle: 'Indices, parameters, variables, constraints', failKind: 'too-much',
  steps: () => [
    { kind: 'model', modelId: 'aggregate', title: 'The aggregate planning model', body: 'This is the linear program from the lecture. The optimum trades overtime against inventory.' },
    { kind: 'question', q: {
      id: '4.4-a', type: 'mc', concept: 'w4.model',
      prompt: 'How does the model make sure demand is met in **every** period?',
      options: [
        'The inventory balance $L_{t-1} + X_t - d_t = L_t$ together with $L_t \\ge 0$',
        'The capacity constraint $X_t \\le c + O_t$',
        'The objective function minimizes costs',
        'Overtime $O_t \\ge 0$',
      ],
      answer: 0,
      hints: ['What would a shortage look like in the balance equation?', 'If $L_{t-1} + X_t < d_t$, then $L_t$ would be negative.', 'Which constraint forbids that?'],
      explain: 'The balance equation defines $L_t$; because $L_t \\ge 0$, stock plus production must cover $d_t$ in every period.',
    } },
    { kind: 'question', q: numeric('4.4-b', 'w4.balance', 'Use the balance equation: $L_{t-1} = 100$, $X_t = 750$, $d_t = 260$. What is $L_t$?', 590, 'units', 0.01,
      ['Start stock plus production minus demand.', '$L_t = L_{t-1} + X_t - d_t$.', '$100 + 750 - 260 = \\;?$'],
      '$L_t = 100 + 750 - 260 = 590$. (Period 2 of the lecture\'s optimal plan.)', LECT) },
    { kind: 'question', q: {
      id: '4.4-c', type: 'classify', concept: 'w4.model',
      prompt: 'Sort the symbols of the aggregate planning model.',
      categories: ['Index', 'Parameter (given)', 'Decision variable'],
      items: [
        { label: '$t$', answer: 0 }, { label: '$d_t$', answer: 1 }, { label: '$c$', answer: 1 }, { label: '$k^l$', answer: 1 },
        { label: '$X_t$', answer: 2 }, { label: '$L_t$', answer: 2 }, { label: '$O_t$', answer: 2 }, { label: '$k^o$', answer: 1 },
      ],
      hints: ['Parameters are known before planning.', 'Decision variables are what the optimization chooses.', 'Demand and cost rates are data; production, inventory and overtime are chosen.'],
      explain: 'Index: $t$. Parameters: $d_t, c, k^l, k^o$. Decision variables: $X_t, L_t, O_t$.',
    } },
    { kind: 'question', q: {
      id: '4.4-d', type: 'tf', concept: 'w4.model',
      prompt: 'True or false: "If $k^o \\le k^l$, the chase strategy is an optimal plan."',
      answer: true,
      reasons: [
        'Pre-producing a unit costs at least $k^l$, while making it in overtime when needed costs $k^o \\le k^l$; so never hold stock.',
        'Chase is always optimal.',
        'Overtime is free when $k^o \\le k^l$.',
      ],
      reasonAnswer: 0,
      hints: ['Compare the two ways to cover a peak.', 'Storing one unit for one period costs $k^l$; one unit of overtime costs $k^o$.', 'If overtime is not more expensive than one period of storage, why store?'],
      explain: 'True (lecture "test yourself"). With $k^o \\le k^l$ inventory never pays off, so producing exactly $d_t$ (with overtime) is optimal.',
    } },
  ],
};

const L4_5: Level = {
  id: '4.5', world: 4, title: 'Beat the Planner', subtitle: 'Find the cheapest production plan', failKind: 'too-little', boss: false,
  steps: () => [
    {
      kind: 'learn', title: 'Your turn: plan the season', inLecture: LECT,
      body: 'Type a production quantity $X_t$ for each period. The table recomputes inventory, overtime and costs instantly.\n\nNo backlog: every period\'s demand must be met from stock or production. Target: the cheapest possible plan (**par**). Beating the level strategy (33,220 EUR) is good enough.',
    },
    { kind: 'plan', title: 'Plan the cellar', brief: 'Start from level or chase, then shift production between periods.', mission: true,
      model: 'aggregate', data: A, start: 'level', editable: true, presets: ['chase', 'level', 'clear'], showPar: true, inLecture: LECT },
  ],
};

const L4_6: Level = {
  id: '4.6', world: 4, title: 'Price Shock', subtitle: 'Sensitivity to the overtime cost', failKind: 'too-much',
  steps: () => [
    {
      kind: 'learn', title: 'What if overtime gets cheaper?', inLecture: 'Impact of overtime cost: $k^o = 32$, 72, 112',
      body: 'The optimal plan depends on the ratio of overtime to holding costs. The lecture solves the model for **$k^o = 32$, 72 and 112 EUR**.\n\nBelow is the optimal plan for **$k^o = 32$**: more overtime, less stock.',
    },
    { kind: 'plan', title: 'Optimal plan with $k^o = 32$', brief: 'Compare with the $k^o = 72$ optimum (30,940 EUR): overtime moves into the peak periods.',
      model: 'aggregate', data: { ...A, ko: 32 }, start: [590, 510, 750, 1090, 750, 810, 750, 750], editable: false },
    { kind: 'question', q: numeric('4.6-a', 'w4.sensitivity', 'Relevant costs of this plan ($k^o = 32$)?', 22260, 'EUR', 0.5,
      ['Read the Sum column, or add inventory and overtime costs.', 'Inventory costs 9,460 EUR; overtime 400 units × 32 EUR.', '$9460 + 12800 = \\;?$'],
      '$9{,}460 + 12{,}800 = 22{,}260$ EUR, 28% below the $k^o = 72$ optimum.', '$k^o = 32$ → 22,260 EUR') },
    { kind: 'question', q: {
      id: '4.6-b', type: 'mc', concept: 'w4.sensitivity',
      prompt: 'Overtime now costs **$k^o = 112$ EUR**. What does the optimal plan look like?',
      options: ['The level strategy: 750 every period, 33,220 EUR', 'The chase strategy', 'The same plan as for $k^o = 72$', 'No feasible plan exists'],
      answer: 0,
      hints: ['Is overtime ever worth it when it is this expensive?', 'Compare 112 with the cost of storing a unit for up to 5 periods (5 × 22 = 110).', 'Total demand equals 8 × 750.'],
      explain: 'With $k^o = 112$ even storing for 5 periods (110 EUR) beats overtime, so the optimum is the **level strategy**, 33,220 EUR (+7%).',
    } },
    { kind: 'question', q: {
      id: '4.6-c', type: 'tf', concept: 'w4.sensitivity',
      prompt: 'True or false: "The higher the overtime cost, the more overtime the optimal plan uses."',
      answer: false,
      reasons: ['Expensive overtime is replaced by pre-production (inventory).', 'Overtime is always fixed by demand.', 'Costs do not change the plan.'],
      reasonAnswer: 0,
      hints: ['What happens between $k^o = 32$ and $k^o = 112$?', 'Overtime units: 400 ($k^o = 32$), 60 ($k^o = 72$), 0 ($k^o = 112$).', 'Which alternative covers peaks?'],
      explain: 'False. Overtime used falls from 400 to 60 to 0 as $k^o$ rises; the plan pre-produces instead.',
    } },
  ],
};

const L4_7: Level = {
  id: '4.7', world: 4, title: 'Late Is OK?', subtitle: 'Backlog: meet demand later, at a price', failKind: 'too-little',
  steps: () => [
    { kind: 'model', modelId: 'aggregate-backlog', title: 'Extension: backlog',
      body: 'Customers now accept **late delivery** at $k^b = 18$ EUR per unit and period. Demand still has to be met by the end of the horizon: $B_T = 0$.' },
    { kind: 'question', q: numeric('4.7-a', 'w4.backlog', 'By the end of period 6, cumulative demand is 4,500 and cumulative production 4,440. What is the backlog $B_6$?', 60, 'units', 0.01,
      ['Backlog = unmet demand so far.', '$B_t = (\\text{cumulative demand} - \\text{cumulative production})^+$.', '$4500 - 4440 = \\;?$'],
      '$B_6 = (4500 - 4440)^+ = 60$ units, costing $60 \\times 18 = 1{,}080$ EUR.', 'Backlog example, period 6') },
    { kind: 'plan', title: 'Plan with backlog allowed', brief: 'Negative net stock is now allowed as backlog (costs $k^b$ per unit and period), but $B_T$ must be 0. Par is 30,700 EUR.', mission: true,
      model: 'aggregate', data: { ...A, kb: 18 }, start: 'level', editable: true, presets: ['chase', 'level', 'clear'], showPar: true, inLecture: 'Backlog $k^b = 18$ → 30,700 EUR' },
  ],
};

const L4_B: Level = {
  id: '4.B', world: 4, title: 'Boss: New Season', subtitle: 'Fresh numbers, find the cheapest plan', failKind: 'too-little', boss: true,
  steps: (rng) => {
    const T = 6;
    const c = int(rng, 10, 16) * 50;
    const demand = Array.from({ length: T }, () => int(rng, Math.round(c / 100) * 1, Math.round((c * 1.6) / 50)) * 50);
    const data: AggregateData = { demand, c, kl: int(rng, 2, 6) * 5, ko: int(rng, 8, 16) * 5 };
    return [
      { kind: 'learn', title: 'A new season', body: `Six periods, capacity **c = ${c}**, holding **$k^l = ${data.kl}$ EUR**, overtime **$k^o = ${data.ko}$ EUR**, no backlog.\n\nUse everything from this cellar: chase, level, the balance equation. Hit par for three stars.` },
      { kind: 'plan', title: 'Plan the new season', brief: 'Beat both simple strategies; hit par for the beach.', mission: true,
        model: 'aggregate', data, start: 'chase', editable: true, presets: ['chase', 'level', 'clear'], showPar: true },
    ];
  },
};

export const world4: World = {
  id: 4, room: 'barrel-cellar', name: 'Barrel Cellar', topic: 'Aggregate Planning', color: 'var(--room-4)',
  lecture: 'Lecture II · ch. 4', levels: [L4_1, L4_2, L4_3, L4_4, L4_5, L4_6, L4_7, L4_B],
};
