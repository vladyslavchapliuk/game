// World 3 — Recipe Office: Optimal project selection (OPM 301 Lecture II, ch. 3).
// Lecture "Chair vs. Table" (LEGO blocks) re-skinned as Cream Ale (C) vs. Tripel (T)
// with malt sacks (small blocks, c_1 = 12) and hop bales (large blocks, c_2 = 8):
// max Z = 1000 X_C + 2500 X_T; 2X_C + 2X_T ≤ 12; X_C + 2X_T ≤ 8; X_C ≤ 6; X_T ≤ 3.
// Optimum X_C = 2, X_T = 3, Z = 9,500 (21 feasible integer plans).
// 3 projects × 6 resources (slide 13): IP optimum (1, 0, 2) Z = 2,800;
// LP relaxation Z = 3,490.57 at (2.08, 0, 1.83); 432 candidates, 20 feasible.
import type { Level, Question, World } from './types';
import { int, pick, shuffle, type Rng } from '../engine/rng';
import { CHAIR_TABLE, THREE_PROJECTS, type ProjectData, checkSelection, solveIP, solveLP } from '../engine/lp';
import { fmt } from '../engine/opm';

const LECT = 'Project selection "Chair vs. Table": $c_1 = 12$, $c_2 = 8$, $e_C = 1{,}000$, $e_T = 2{,}500$, $d_C = 6$, $d_T = 3$';
const LECT3 = 'Example with 3 projects and 6 resources (slides 11–13)';

const numeric = (
  id: string, concept: string, prompt: string, answer: number, unit: string, tolerance: number,
  hints: [string, string, string], explain: string, inLecture?: string,
): Question => ({ id, type: 'numeric', concept, prompt, answer, unit, tolerance, hints, explain, inLecture });

const STORY =
  'Bruno can brew two festival specials. A batch of **Cream Ale (C)** needs **2 malt sacks and 1 hop bale** and brings **1,000 EUR**. A batch of **Tripel (T)** needs **2 malt sacks and 2 hop bales** and brings **2,500 EUR**.\n\n' +
  'In the storeroom: **12 malt sacks** and **8 hop bales**. They are already paid for (sunk costs) and no more can be bought in time (not flexible). The pubs ordered **6 Cream Ale** and **3 Tripel** batches.';

const L3_1: Level = {
  id: '3.1', world: 3, title: 'Cream Ale or Tripel?', subtitle: 'Input data, decision, objective, constraints', failKind: 'too-little',
  steps: (rng) => [
    { kind: 'learn', title: 'Which recipes should Bruno brew?', inLecture: LECT, body: `${STORY}\n\nEvery optimization problem has the same parts: **input data**, a **decision**, an **objective** and **constraints**.` },
    {
      kind: 'question', q: {
        id: '3.1-a', type: 'classify', concept: 'w3.problem', inLecture: LECT,
        prompt: 'Sort the pieces of Bruno\'s problem.',
        categories: ['Input data', 'Decision', 'Objective', 'Constraint'],
        items: shuffle(rng, [
          { label: 'Malt sacks needed for one Tripel', answer: 0 },
          { label: 'How many Cream Ale batches to brew', answer: 1 },
          { label: 'Maximize the revenue of the accepted batches', answer: 2 },
          { label: 'Use at most the 8 hop bales in stock', answer: 3 },
          { label: 'The pubs ordered 3 Tripel', answer: 0 },
          { label: 'Brew whole batches only', answer: 3 },
        ]),
        hints: ['Input data is given before deciding.', 'The decision is what Bruno chooses; the objective says what "best" means.', 'Constraints limit the decision: resources, demand, integrality.'],
        explain: 'Requirements, capacities, revenues and demands are **input data**; the quantities are the **decision**; maximizing revenue is the **objective**; resource capacity, demand and integer quantities are **constraints**.',
      },
    },
    {
      kind: 'question', q: {
        id: '3.1-b', type: 'mc', concept: 'w3.problem', inLecture: LECT,
        prompt: 'Why does Bruno maximize **revenue** here, not profit after ingredient costs?',
        options: [
          'The malt and hops are already paid for (sunk costs), so they cost nothing extra per batch',
          'Revenue and profit are always the same',
          'Ingredients are free in a brewery',
          'Profit cannot be written as a linear function',
        ],
        answer: 0,
        hints: ['When were the ingredients bought?', 'Does brewing one more batch change what was paid?', 'Sunk costs are irrelevant for the decision.'],
        explain: 'The stock is a **sunk cost**: it was paid before the decision and does not change with it. So only revenue differs between plans.',
      },
    },
    { kind: 'question', q: numeric('3.1-c', 'w3.problem', 'Revenue $Z$ of the plan $X_C = 4$, $X_T = 2$ (EUR)?', 9000, 'EUR', 0.5,
      ['Multiply each quantity by its revenue.', '$Z = e_C \\cdot X_C + e_T \\cdot X_T$.', '$1{,}000 \\cdot 4 + 2{,}500 \\cdot 2$.'],
      '$Z = 1{,}000 \\cdot 4 + 2{,}500 \\cdot 2 = 9{,}000$ EUR.', LECT) },
    { kind: 'question', q: numeric('3.1-d', 'w3.problem', 'How many **malt sacks** does the plan $X_C = 2$, $X_T = 3$ use?', 10, 'sacks', 0.01,
      ['2 sacks per Cream Ale, 2 per Tripel.', '$a_{C1} X_C + a_{T1} X_T$.', '$2 \\cdot 2 + 2 \\cdot 3$.'],
      '$2 \\cdot 2 + 2 \\cdot 3 = 10 \\le 12$ malt sacks. (Hop bales: $1 \\cdot 2 + 2 \\cdot 3 = 8 \\le 8$, fully used.)', LECT) },
  ],
};

const L3_2: Level = {
  id: '3.2', world: 3, title: 'Write the Model', subtitle: 'Indices, parameters, variables, constraints', failKind: 'too-little',
  steps: (rng) => [
    { kind: 'model', modelId: 'project-selection', title: 'The project selection model', body: 'The same structure fits any number of projects $i$ and resources $j$. Bruno\'s case: $i \\in \\{C, T\\}$, $j \\in \\{1, 2\\}$. The slides\' Chair and Table are our Cream Ale and Tripel; small and large blocks are malt sacks and hop bales.' },
    {
      kind: 'question', q: {
        id: '3.2-a', type: 'classify', concept: 'w3.model',
        prompt: 'Classify the symbols of the model.',
        categories: ['Index', 'Parameter', 'Decision variable'],
        items: shuffle(rng, [
          { label: '$i$', answer: 0 }, { label: '$j$', answer: 0 }, { label: '$c_j$', answer: 1 }, { label: '$a_{ij}$', answer: 1 },
          { label: '$e_i$', answer: 1 }, { label: '$d_i$', answer: 1 }, { label: '$X_i$', answer: 2 },
        ]),
        hints: ['Indices count things (projects, resources).', 'Parameters are known numbers.', 'Only one symbol is chosen by the model.'],
        explain: 'Indices: $i$ (projects), $j$ (resources). Parameters: $c_j, a_{ij}, e_i, d_i$. Decision variable: $X_i$.',
      },
    },
    {
      kind: 'question', q: {
        id: '3.2-b', type: 'mc', concept: 'w3.model', inLecture: LECT,
        prompt: 'Which constraint describes the **hop bales** (resource 2)?',
        options: ['$X_C + 2X_T \\le 8$', '$2X_C + 2X_T \\le 12$', '$X_C + X_T \\le 8$', '$2X_C + X_T \\le 8$'],
        answer: 0,
        hints: ['Cream Ale needs 1 hop bale, Tripel 2.', '$\\sum_i a_{i2} X_i \\le c_2$.', '$c_2 = 8$.'],
        explain: '$a_{C2} X_C + a_{T2} X_T \\le c_2$, i.e. $X_C + 2X_T \\le 8$. The malt constraint is $2X_C + 2X_T \\le 12$.',
      },
    },
    {
      kind: 'question', q: {
        id: '3.2-c', type: 'mc', concept: 'w3.notation', inLecture: 'Test yourself questions',
        prompt: 'Rewrite $b_1 Y_1 + b_2 Y_2 + b_3 Y_3 \\le \\delta$ with a sum over the index $i$.',
        options: ['$\\sum_{i=1}^{3} b_i \\cdot Y_i \\le \\delta$', '$\\sum_{i=1}^{3} b \\cdot Y_i \\le \\delta$', '$\\sum_{i=1}^{3} b_i \\cdot Y_i \\le \\delta_i$', '$\\sum_{i=1}^{3} b_i \\le \\delta \\cdot Y_i$'],
        answer: 0,
        hints: ['Both $b$ and $Y$ change with the term.', 'The right-hand side is one number.', 'Term $i$ is $b_i \\cdot Y_i$.'],
        explain: 'Each term is $b_i \\cdot Y_i$ for $i = 1, 2, 3$, and $\\delta$ has no index: $\\sum_{i=1}^{3} b_i Y_i \\le \\delta$.',
      },
    },
    {
      kind: 'question', q: {
        id: '3.2-d', type: 'mc', concept: 'w3.notation', inLecture: 'Test yourself questions',
        prompt: 'For $I = 2$ and $J = 4$, how many explicit constraints does $\\sum_{i=1}^{I} a_{ij} X_i \\le c_j \\;\\; \\forall j \\in \\{1, \\dots, J\\}$ stand for?',
        options: ['4, each with 2 terms', '2, each with 4 terms', '8, each with 1 term', '1 with 8 terms'],
        answer: 0,
        hints: ['"For all j" creates one constraint per resource.', 'The sum runs over the projects.', '$J = 4$ resources, $I = 2$ projects.'],
        explain: 'One constraint per resource $j = 1, \\dots, 4$, e.g. $a_{11} X_1 + a_{21} X_2 \\le c_1$: **4 constraints with 2 terms each**.',
      },
    },
    {
      kind: 'question', q: {
        id: '3.2-e', type: 'tf', concept: 'w3.model', inLecture: 'Test yourself questions',
        prompt: 'True or false: "Parameters are given input data, while decision variables are the values the model chooses."',
        answer: true,
        reasons: [
          'Parameters ($c_j$, $a_{ij}$, $e_i$, $d_i$) are known before solving; $X_i$ is determined by the optimization.',
          'Parameters change during the optimization.',
          'Decision variables are fixed by the manager beforehand.',
        ],
        reasonAnswer: 0,
        hints: ['Which symbols can Bruno look up in the storeroom?', 'Which symbol is the answer of the model?', '$X_i$ is the answer.'],
        explain: 'True. Parameters are data; decision variables are what the solver sets to find the best feasible plan.',
      },
    },
  ],
};

const L3_3: Level = {
  id: '3.3', world: 3, title: 'Feasible or Not?', subtitle: 'The graphical view of the constraints', failKind: 'too-much',
  steps: () => [
    {
      kind: 'learn', title: 'Draw the constraints', inLecture: LECT,
      body:
        'With two projects each constraint is a line in the $(X_C, X_T)$ plane. The **feasible region** is where all constraints hold at once. Because Bruno brews whole batches, only the **integer points** inside it are feasible plans.\n\n' +
        'A solution is **feasible** (all constraints hold), **infeasible** (at least one is violated) or **optimal** (feasible and no feasible plan is better).',
    },
    { kind: 'select', title: 'Explore the storeroom', brief: 'Click points on the graph or use the steppers. Watch which resource runs out first.', data: CHAIR_TABLE, start: [0, 0], inLecture: LECT },
    {
      kind: 'question', q: {
        id: '3.3-a', type: 'mc', concept: 'w3.graphical', inLecture: LECT,
        prompt: 'Is the plan $X_C = 3$, $X_T = 3$ feasible?',
        options: ['No: it needs 9 hop bales, only 8 are in stock', 'No: it needs 14 malt sacks', 'Yes: all constraints hold', 'No: more Tripel than ordered'],
        answer: 0,
        hints: ['Check each resource.', 'Malt: $2 \\cdot 3 + 2 \\cdot 3$; hops: $3 + 2 \\cdot 3$.', 'Hops: $9 > 8$.'],
        explain: 'Malt: $2 \\cdot 3 + 2 \\cdot 3 = 12 \\le 12$ ✓. Hops: $3 + 2 \\cdot 3 = 9 > 8$ ✗. One violated constraint makes the plan **infeasible**.',
      },
    },
    {
      kind: 'question', q: {
        id: '3.3-b', type: 'mc', concept: 'w3.graphical', inLecture: LECT,
        prompt: 'At $X_C = 4$, $X_T = 2$, which constraints are **binding** (used exactly to capacity)?',
        options: ['Malt and hops', 'Only malt', 'Only hops', 'None'],
        answer: 0,
        hints: ['Compute the use of both resources.', 'Malt: $2 \\cdot 4 + 2 \\cdot 2$.', 'Hops: $4 + 2 \\cdot 2$.'],
        explain: 'Malt: $8 + 4 = 12 = c_1$ and hops: $4 + 4 = 8 = c_2$. Both lines pass through this corner point.',
      },
    },
    { kind: 'question', q: numeric('3.3-c', 'w3.graphical', 'How many feasible integer plans are there (count $X_C = X_T = 0$ too)?', 21, 'plans', 0.01,
      ['Go column by column: for each $X_C$ from 0 to 6, what is the largest feasible $X_T$?', '$X_T \\le 3$, $X_T \\le (12 - 2X_C)/2$, $X_T \\le (8 - X_C)/2$.', 'Column sizes: $X_C = 0$: 4 points (0–3), $X_C = 1$: 4, …'],
      'Largest $X_T$ for $X_C = 0, \\dots, 6$: 3, 3, 3, 2, 2, 1, 0. Points: $4 + 4 + 4 + 3 + 3 + 2 + 1 = 21$ feasible plans.', LECT) },
  ],
};

const L3_4: Level = {
  id: '3.4', world: 3, title: 'Slide the Profit Line', subtitle: 'Find the optimal selection', failKind: 'too-little',
  steps: () => [
    {
      kind: 'learn', title: 'The graphical solution', inLecture: LECT,
      body:
        'All plans with the same revenue lie on a line $1{,}000\\,X_C + 2{,}500\\,X_T = Z$. Moving it outwards raises $Z$; all these lines are parallel.\n\n' +
        'Push the profit line as far as it goes while it still touches the feasible region. For a linear program the optimum is at a **corner point**; with integer quantities, pick the best **integer point**.',
      formula: '\\max Z = 1{,}000 \\cdot X_C + 2{,}500 \\cdot X_T',
    },
    { kind: 'select', title: 'Choose the festival menu', brief: 'Pick the selection with the highest revenue. One submission: Bruno brews exactly this.', data: CHAIR_TABLE, start: [0, 0], mission: true, inLecture: LECT },
  ],
};

const L3_5: Level = {
  id: '3.5', world: 3, title: 'LP or IP?', subtitle: 'Relaxation, rounding and enumeration', failKind: 'too-much',
  steps: (rng) => [
    {
      kind: 'learn', title: 'Linear vs. integer programs', inLecture: LECT3,
      body:
        '**Linear programs (LP):** linear objective and constraints, variables are real numbers. Solution approaches: graphical solution, simplex algorithm (e.g. Excel Solver, GAMS).\n\n' +
        '**Integer programs (IP):** the same, but variables must be integers. Solution approaches: complete enumeration, heuristics, branch and bound.\n\n' +
        'The lecture\'s bigger example has 3 projects and 6 resources: $\\max Z = 800X_1 + 400X_2 + 1000X_3$ with demands $d = (5, 8, 7)$. Try the helpers below: solve the LP, round it, and enumerate.',
    },
    { kind: 'select', title: 'Three projects, six resources', brief: 'No graph in 3D, so use the resource table. Can you beat the rounded LP solution?', data: THREE_PROJECTS, start: [0, 0, 0], helpers: true, inLecture: LECT3 },
    {
      kind: 'question', q: {
        id: '3.5-a', type: 'classify', concept: 'w3.lp-ip',
        prompt: 'Which solution approach belongs to which program type (lecture slide)?',
        categories: ['LP', 'IP'],
        items: shuffle(rng, [
          { label: 'Graphical solution', answer: 0 }, { label: 'Simplex algorithm', answer: 0 },
          { label: 'Complete enumeration', answer: 1 }, { label: 'Branch and bound', answer: 1 }, { label: 'Heuristic approaches', answer: 1 },
        ]),
        hints: ['Which methods need continuous variables?', 'Which methods search over discrete candidates?', 'Enumeration lists integer plans.'],
        explain: 'LP: graphical solution and the simplex algorithm. IP: complete enumeration, heuristics, branch and bound.',
      },
    },
    { kind: 'question', q: numeric('3.5-b', 'w3.lp-ip', 'Revenue of the **LP relaxation** optimum (EUR, 2 decimals)?', solveLP(THREE_PROJECTS).z, 'EUR', 0.5,
      ['Use the "Solve the LP relaxation" helper.', 'Fractional quantities are allowed in an LP.', 'It is above the best integer plan.'],
      `LP optimum: $X_1 = 2.08$, $X_2 = 0$, $X_3 = 1.83$ with $Z = ${fmt(solveLP(THREE_PROJECTS).z, 2)}$ EUR, an upper bound for the integer program.`, LECT3) },
    {
      kind: 'question', q: {
        id: '3.5-c', type: 'tf', concept: 'w3.lp-ip', inLecture: LECT3,
        prompt: 'True or false: "Rounding the LP optimum to $X = (2, 0, 2)$ gives the best integer plan."',
        answer: false,
        reasons: [
          'It is not even feasible: resource 2 needs $5 \\cdot 2 + 14 \\cdot 2 = 38 > 36$.',
          'Rounding always gives the integer optimum.',
          'It is feasible but earns less than $(2, 0, 1)$.',
        ],
        reasonAnswer: 0,
        hints: ['Check every resource for (2, 0, 2).', 'Resource 2: $5X_1 + 8X_2 + 14X_3 \\le 36$.', '$10 + 28 = 38$.'],
        explain: 'False. $(2, 0, 2)$ violates resource 2 ($38 > 36$). Rounding an LP solution can be infeasible or suboptimal; the integer optimum is $(1, 0, 2)$ with $Z = 2{,}800$.',
      },
    },
    { kind: 'question', q: numeric('3.5-d', 'w3.lp-ip', 'Complete enumeration: how many integer candidates $0 \\le X_i \\le d_i$ must be checked?', 432, 'plans', 0.01,
      ['Each $X_i$ can take $d_i + 1$ values.', '$d = (5, 8, 7)$.', '$6 \\cdot 9 \\cdot 8$.'],
      '$(5+1)(8+1)(7+1) = 432$ candidates, of which only 20 are feasible. Enumeration grows fast with more projects, which is why branch and bound and heuristics exist.', LECT3) },
    { kind: 'question', q: numeric('3.5-e', 'w3.lp-ip', 'Revenue of the best **integer** plan (EUR)?', 2800, 'EUR', 0.5,
      ['Use "Enumerate every integer plan" or search near the LP solution.', 'Try $X_3 = 2$ with small $X_1$.', '$(1, 0, 2)$.'],
      'Best integer plan $X = (1, 0, 2)$: $Z = 800 + 2{,}000 = 2{,}800$ EUR, well below the LP bound of 3,490.57 EUR.', LECT3) },
  ],
};

// ---------------------------------------------------------------------------
// Boss: a random two-project menu.

const MENUS: [string, string, string, string][] = [
  ['Pale Ale', 'Stout', 'P', 'S'], ['Weizen', 'Bock', 'W', 'B'], ['Pilsner', 'Porter', 'P', 'R'], ['Kölsch', 'Dubbel', 'K', 'D'],
];

export const bossProjects = (rng: Rng): ProjectData => {
  for (let tries = 0; tries < 500; tries++) {
    const [n1, n2, k1, k2] = pick(rng, MENUS);
    const e = [int(rng, 6, 15) * 100, int(rng, 15, 30) * 100];
    const a = [[int(rng, 1, 3), int(rng, 1, 3)], [int(rng, 1, 4), int(rng, 1, 4)]];
    const c = [int(rng, 10, 18), int(rng, 6, 14)];
    const d = [int(rng, 4, 8), int(rng, 2, 5)];
    const p: ProjectData = { projects: [n1, n2], keys: [k1, k2], resources: ['malt sacks', 'hop bales'], e, a, c, d };
    const ip = solveIP(p);
    if (ip.x[0] === 0 || ip.x[1] === 0) continue;
    if (ip.feasibleCount < 8) continue;
    // Unique optimum, and both resources must matter somewhere in the box.
    const plans: number[][] = [];
    for (let x = 0; x <= d[0]; x++) for (let y = 0; y <= d[1]; y++) plans.push([x, y]);
    const top = plans.filter((x) => checkSelection(p, x).feasible && e[0] * x[0] + e[1] * x[1] === ip.z);
    if (top.length !== 1) continue;
    const cuts = [0, 1].map((j) => plans.some((x) => checkSelection(p, x).overCapacity.includes(j)));
    if (!cuts[0] || !cuts[1]) continue;
    // Greedy "most revenue first" must not already be optimal.
    const greedy = [0, 0];
    greedy[1] = Math.max(...plans.filter((x) => x[0] === 0 && checkSelection(p, x).feasible).map((x) => x[1]));
    greedy[0] = Math.max(...plans.filter((x) => x[1] === greedy[1] && checkSelection(p, x).feasible).map((x) => x[0]));
    if (greedy[0] === ip.x[0] && greedy[1] === ip.x[1]) continue;
    return p;
  }
  return CHAIR_TABLE;
};

const L3_B: Level = {
  id: '3.B', world: 3, title: 'Boss: Festival Menu', subtitle: 'New recipes, new storeroom', failKind: 'too-little', boss: true,
  steps: (rng) => {
    const p = bossProjects(rng);
    const probe = [Math.min(p.d[0], int(rng, 1, 3)), Math.min(p.d[1], int(rng, 1, 2))];
    const malt = p.a[0][0] * probe[0] + p.a[1][0] * probe[1];
    return [
      {
        kind: 'learn', title: 'A new festival order',
        body:
          `**${p.projects[0]} (${p.keys[0]})** needs ${p.a[0][0]} malt sacks and ${p.a[0][1]} hop bales and brings **${fmt(p.e[0])} EUR**. ` +
          `**${p.projects[1]} (${p.keys[1]})** needs ${p.a[1][0]} malt sacks and ${p.a[1][1]} hop bales and brings **${fmt(p.e[1])} EUR**.\n\n` +
          `Storeroom: **${p.c[0]} malt sacks**, **${p.c[1]} hop bales**. Orders: **${p.d[0]} ${p.projects[0]}**, **${p.d[1]} ${p.projects[1]}**.`,
      },
      { kind: 'question', q: numeric('3.B-a', 'w3.model', `How many malt sacks does the plan $X_${p.keys[0]} = ${probe[0]}$, $X_${p.keys[1]} = ${probe[1]}$ need?`, malt, 'sacks', 0.01,
        ['Requirement per batch times quantity, summed.', '$\\sum_i a_{i1} X_i$.', `$${p.a[0][0]} \\cdot ${probe[0]} + ${p.a[1][0]} \\cdot ${probe[1]}$.`],
        `$${p.a[0][0]} \\cdot ${probe[0]} + ${p.a[1][0]} \\cdot ${probe[1]} = ${malt}$ malt sacks (capacity ${p.c[0]}).`) },
      { kind: 'select', title: 'Choose the menu', brief: 'Find the integer selection with the highest revenue. One submission.', data: p, start: [0, 0], mission: true },
    ];
  },
};

export const world3: World = {
  id: 3, room: 'recipe-office', name: 'Recipe Office', topic: 'Optimization Modeling', color: 'var(--room-3)',
  lecture: 'Lecture II · ch. 3',
  levels: [L3_1, L3_2, L3_3, L3_4, L3_5, L3_B],
};
