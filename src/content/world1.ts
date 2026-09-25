// World 1 — Tasting Lounge: Introduction to OPM and the Variability Cube.
// Source: OPM 301 Lecture I (Stolletz, Fall 2026) and Stolletz & Tan (2024).
import type { CubeCorner, CubeQuestion, Level, World } from './types';
import { pick, shuffle } from '../engine/rng';

export const CUBE_AXES = [
  { key: 'uncertainty', name: 'Uncertainty', values: ['Deterministic', 'Stochastic'] },
  { key: 'dynamics', name: 'Dynamics', values: ['Stationary', 'Time-dependent'] },
  { key: 'heterogeneity', name: 'Heterogeneity', values: ['Homogeneous', 'Heterogeneous'] },
] as const;

export const cornerLabel = (c: CubeCorner) => CUBE_AXES.map((a, i) => a.values[c[i]]).join(' · ');

// Three independent sentence parts, one per axis, so all 8 corners can be generated.
const U = [
  'Every order is booked in advance for a fixed delivery slot',
  'Guests walk in whenever they like, nobody knows when the next one comes',
];
const D = [
  'the average number of orders is the same all year',
  'orders jump during Oktoberfest and drop in January',
];
const H = [
  'and Bruno only brews one lager for one type of guest.',
  'and Bruno brews 12 styles for regulars, tourists and VIP tables with different prices.',
];

export const cubeScenario = (c: CubeCorner) => `${U[c[0]]}; ${D[c[1]]}, ${H[c[2]]}`;

const cubeHints = (): [string, string, string] => [
  'Read the scenario three times, once per axis.',
  'Uncertainty: known in advance (deterministic) or random (stochastic)? Dynamics: does the pattern change over time? Heterogeneity: one kind or many kinds?',
  'Start with uncertainty: are the arrivals booked (deterministic) or random (stochastic)?',
];

const cubeQ = (id: string, c: CubeCorner, scenario = cubeScenario(c)): CubeQuestion => ({
  id,
  type: 'cube',
  concept: 'w1.cube',
  prompt: 'Place this scenario in the variability cube.',
  scenario,
  answer: c,
  hints: cubeHints(),
  explain: `This is **${cornerLabel(c)}**. Uncertainty asks whether the data are known in advance, dynamics whether they change over time, heterogeneity whether there are different kinds (products, customers, resources).`,
});

const allCorners: CubeCorner[] = [
  [0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 1, 1], [1, 0, 0], [1, 0, 1], [1, 1, 0], [1, 1, 1],
];

const SOURCE_CATS = [
  'Demand · Dynamics',
  'Demand · Uncertainty',
  'Demand · Heterogeneity',
  'Supply · Dynamics',
  'Supply · Uncertainty',
  'Supply · Heterogeneity',
];

const L1_1: Level = {
  id: '1.1',
  world: 1,
  title: 'Welcome to Ops',
  subtitle: 'What operations management is about',
  failKind: 'wrong-classification',
  steps: () => [
    {
      kind: 'learn',
      title: 'Operations management in one breath',
      body:
        'Operations management develops management and engineering approaches for an **effective planning of resources and activities** in production and service systems and networks, from the **strategic** down to the **control** level.\n\nIt has three building blocks: **production management** (manufacturing goods), **service operations management** (providing services) and **procurement & supply chain management** (storing, transporting and delivering goods along the supply chain). Its core job: **coordinate demand and supply**.',
    },
    {
      kind: 'question',
      q: {
        id: '1.1-a',
        type: 'mc',
        concept: 'w1.building-blocks',
        prompt: 'Bruno pours beer for guests at the bar counter. Which building block of operations is that mostly?',
        options: ['Production management', 'Service operations management', 'Procurement & supply chain management'],
        answer: 1,
        hints: [
          'Is Bruno making a physical good here, or providing something to a guest?',
          'Service operations = business operations related to the provision of services.',
          'Serving and waiting at a counter is a service process.',
        ],
        explain: 'Serving guests is the **provision of a service**, so it belongs to service operations management. Brewing the beer itself would be production management.',
      },
    },
    {
      kind: 'question',
      q: {
        id: '1.1-b',
        type: 'mc',
        concept: 'w1.building-blocks',
        prompt: 'The delivery truck brings kegs from the brewery to three festivals. Which building block plans this?',
        options: ['Production management', 'Service operations management', 'Procurement & supply chain management'],
        answer: 2,
        hints: [
          'Is anything being manufactured on the truck?',
          'Supply chain management covers storage, transportation and delivery of goods.',
          'Transporting kegs to customers is delivery along the supply chain.',
        ],
        explain: 'Storing, transporting and delivering goods along the chain is **procurement & supply chain management**.',
      },
    },
    {
      kind: 'question',
      q: {
        id: '1.1-c',
        type: 'mc',
        concept: 'w1.definition',
        prompt: 'Complete the definition: OM plans resources and activities in production and service systems "from the ___ down to the ___ level".',
        options: ['operational … strategic', 'strategic … control', 'tactical … financial', 'global … local'],
        answer: 1,
        hints: [
          'It starts at the long-term, big-picture level.',
          'Planning levels run from long-term to real-time.',
          'Long-term decisions are strategic; real-time steering is control.',
        ],
        explain: 'OM covers everything **from the strategic down to the control level**: from building a brewery to steering today\'s batches.',
      },
    },
  ],
};

const L1_2: Level = {
  id: '1.2',
  world: 1,
  title: 'Plan or Build?',
  subtitle: 'Operations planning vs. capacity planning',
  failKind: 'wrong-classification',
  steps: (rng) => [
    {
      kind: 'learn',
      title: 'Use capacity or set capacity?',
      body:
        '**Operations planning** asks *how to use* the capacity you already have (what to brew, when, how much).\n\n**Capacity planning** asks *how to set* capacity (buy a kettle, build a cellar, hire staff).\n\nBoth exist to coordinate demand and supply.',
    },
    {
      kind: 'question',
      q: {
        id: '1.2-a',
        type: 'classify',
        concept: 'w1.planning-types',
        prompt: 'Sort Bruno\'s to-do list.',
        categories: ['Operations planning (use capacity)', 'Capacity planning (set capacity)'],
        items: shuffle(rng, [
          { label: 'Buy a second brew kettle', answer: 1 },
          { label: 'Decide how many barrels to brew each month next year', answer: 0 },
          { label: 'Build a bigger cellar', answer: 1 },
          { label: 'Schedule which beer to brew on Tuesday', answer: 0 },
          { label: 'Hire a second permanent brewer', answer: 1 },
          { label: 'Choose the lot size of the next lager batch', answer: 0 },
        ]),
        hints: [
          'Ask: does this change how much the brewery *can* produce?',
          'Set capacity = change machines, buildings, staff. Use capacity = decide what to do with them.',
          'The kettle, the cellar and the new brewer all change capacity.',
        ],
        explain: 'Kettle, cellar and new brewer **set capacity**. Monthly volumes, the Tuesday schedule and the lot size **use** the existing capacity.',
      },
    },
    {
      kind: 'question',
      q: {
        id: '1.2-b',
        type: 'tf',
        concept: 'w1.planning-types',
        prompt: 'True or false: "Aggregate planning with a fixed production capacity c per period is a capacity planning problem."',
        answer: false,
        reasons: [
          'It decides how to use a given capacity over time, so it is operations planning.',
          'It decides how large the capacity c should be.',
          'Every planning problem with a capacity is capacity planning.',
        ],
        reasonAnswer: 0,
        hints: [
          'In the model, is c a parameter or a decision?',
          'Capacity planning = c is decided. Operations planning = c is given.',
          'In aggregate planning c is given; production, inventory and overtime are decided.',
        ],
        explain: 'False. In aggregate planning c is a **given parameter**; the model decides production, inventory and overtime, i.e. how to **use** capacity.',
      },
    },
  ],
};

const L1_3: Level = {
  id: '1.3',
  world: 1,
  title: 'The Cube',
  subtitle: 'Three dimensions of variability',
  failKind: 'wrong-classification',
  steps: (rng) => {
    const corners = shuffle(rng, allCorners).slice(0, 4);
    return [
      {
        kind: 'learn',
        title: 'The variability cube',
        body:
          'Variability in demand and supply has three dimensions (Stolletz & Tan, 2024):\n\n**Uncertainty:** deterministic (known in advance) → stochastic (random).\n\n**Dynamics:** stationary (the pattern stays the same) → time-dependent (it changes over time, e.g. seasons).\n\n**Heterogeneity:** homogeneous (one kind) → heterogeneous (many products, customer classes or resource types).\n\nEvery situation sits in one of the 8 corners.',
      },
      ...corners.map((c, i) => ({ kind: 'question' as const, q: cubeQ(`1.3-${i}`, c) })),
    ];
  },
};

const L1_4: Level = {
  id: '1.4',
  world: 1,
  title: 'Demand vs. Supply',
  subtitle: 'Sources of variability (Table 1)',
  failKind: 'wrong-classification',
  steps: (rng) => [
    {
      kind: 'learn',
      title: 'Where does variability come from?',
      body:
        'Both **demand** and **supply/capacity** vary in all three dimensions.\n\n**Demand:** seasonality, product life cycle, marketing (dynamics); non-contracted demand, customer behavior (uncertainty); product variety, customer classes, willingness to pay (heterogeneity).\n\n**Supply:** shift work, ramp-up and learning, scheduled maintenance (dynamics); manual work, resource availability, yield or quality (uncertainty); resource types, skills, multi-stage processes (heterogeneity).',
    },
    {
      kind: 'question',
      q: {
        id: '1.4-a',
        type: 'classify',
        concept: 'w1.sources',
        prompt: 'Demand side: where does each source belong?',
        categories: SOURCE_CATS.slice(0, 3),
        items: shuffle(rng, [
          { label: 'Oktoberfest makes every October busy', answer: 0 },
          { label: 'A new IPA sells slowly at first, then booms, then fades', answer: 0 },
          { label: 'Walk-in guests who never ordered in advance', answer: 1 },
          { label: 'Nobody knows which beer the next guest will choose', answer: 1 },
          { label: 'Bruno sells 12 beer styles', answer: 2 },
          { label: 'VIP tables pay more than regulars', answer: 2 },
        ]),
        hints: [
          'Is it a known change over time, randomness, or a difference between kinds?',
          'Dynamics = seasonality, life cycle, marketing. Uncertainty = non-contracted demand, behavior. Heterogeneity = variety, customer classes.',
          'Oktoberfest and the IPA life cycle are known patterns over time: dynamics.',
        ],
        explain: 'Seasonality and the product life cycle are **dynamics**; walk-ins (non-contracted demand) and unpredictable choices are **uncertainty**; many styles and customer classes are **heterogeneity**.',
      },
    },
    {
      kind: 'question',
      q: {
        id: '1.4-b',
        type: 'classify',
        concept: 'w1.sources',
        prompt: 'Supply side: where does each source belong?',
        categories: SOURCE_CATS.slice(3),
        items: shuffle(rng, [
          { label: 'Night shift has fewer brewers than day shift', answer: 0 },
          { label: 'A new brewer is slow in week 1 and faster by week 6', answer: 0 },
          { label: 'Hand-bottling times vary from crate to crate', answer: 1 },
          { label: 'The kettle breaks down at random', answer: 1 },
          { label: 'Some brewers can run the kettle, others only bottle', answer: 2 },
          { label: 'Beer passes mashing, boiling, cooling and bottling', answer: 2 },
        ]),
        hints: [
          'Planned changes over time vs. random events vs. different kinds of resources.',
          'Dynamics = shift work, ramp-up/learning. Uncertainty = manual work, availability. Heterogeneity = skills, multi-stage processes.',
          'Shift patterns and learning are planned or predictable over time: dynamics.',
        ],
        explain: 'Shifts and ramp-up/learning are **dynamics**; manual work and breakdowns are **uncertainty**; skills and multi-stage processes are **heterogeneity**.',
      },
    },
  ],
};

const L1_B: Level = {
  id: '1.B',
  world: 1,
  boss: true,
  title: 'Boss: Cube Master',
  subtitle: 'Mixed review of world 1',
  failKind: 'wrong-classification',
  steps: (rng) => [
    { kind: 'question', q: cubeQ('1.B-a', pick(rng, allCorners)) },
    {
      kind: 'question',
      q: {
        id: '1.B-b',
        type: 'tf',
        concept: 'w1.cube',
        prompt: 'True or false: "Time-dependent demand and stochastic demand mean the same thing."',
        answer: false,
        reasons: [
          'Time-dependent = the pattern changes over time (dynamics), which can be fully known; stochastic = random, not known in advance (uncertainty).',
          'Both describe demand that is higher in summer.',
          'Stochastic demand is always time-dependent.',
        ],
        reasonAnswer: 0,
        hints: [
          'They sit on two different axes of the cube.',
          'Dynamics axis: stationary → time-dependent. Uncertainty axis: deterministic → stochastic.',
          'A contracted Oktoberfest order is time-dependent but deterministic.',
        ],
        explain: 'False. **Time-dependent** is about dynamics (e.g. a known seasonal peak); **stochastic** is about uncertainty (random, not known in advance). Demand can be time-dependent and deterministic at the same time.',
      },
    },
    {
      kind: 'question',
      q: {
        id: '1.B-c',
        type: 'mc',
        concept: 'w1.cube',
        prompt: 'Which situation is deterministic, stationary and homogeneous?',
        options: [
          'A contract for exactly 40 kegs of one lager every week, all year',
          'Random walk-in guests on festival weekends',
          '12 beer styles with a summer peak',
          'Kettle breakdowns at random times',
        ],
        answer: 0,
        hints: [
          'You need the "boring" corner: known, constant, one kind.',
          'Deterministic = contracted/known. Stationary = same every period. Homogeneous = one product.',
          'Look for a fixed contract of a single product.',
        ],
        explain: 'Fixed weekly contract (deterministic), same all year (stationary), one lager (homogeneous): the **origin corner** of the cube.',
      },
    },
  ],
};

export const world1: World = {
  id: 1,
  room: 'tasting-lounge',
  name: 'Tasting Lounge',
  topic: 'Variability Cube',
  color: 'var(--room-1)',
  lecture: 'Lecture I · Introduction',
  levels: [L1_1, L1_2, L1_3, L1_4, L1_B],
};
