// World 6 — Bar Counter: stochastic variability and single-server queues.
// Sources: OPM 301 Tutorial/Exercise 6 (Dice Bar; two machines) and
// Tutorial/Exercise 7 (library queue; clock-controlled machine), plus the
// variability buffers of Stolletz & Tan (2024).
// Dice Bar: E = 10.50 EUR, V = 26.25 EUR², σ = 5.12 EUR, cv = 0.49.
// Machines: E = 35.60 s; V = 37.14 / 13.14 s²; cv = 0.17 / 0.10.
// Library: ρ = 5/6, E[Wq] = 25 min, E[Ws] = 30 min, E[Ls] = 5.
// Clocked: ρ = 8/9, E[Wq] = 384 min, E[Ws] = 464 min, E[Ls] = 5.16; cv_s² ≤ 0.69.
import type { CubeCorner, Level, Question, World } from './types';
import { int, pick, shuffle, type Rng } from '../engine/rng';
import {
  DICE, MACHINE_1, MACHINE_2, type StaffMission, type StaffOption, judgeStaffing, queueMetrics, staffMetric,
} from '../engine/stochastic';
import { fmt } from '../engine/opm';

const T6 = 'Tutorial 6: "Dice Bar", 3 EUR per beer';
const E6 = 'Exercise 6: processing times of two machines';
const T7 = 'Tutorial 7: one librarian, $\\lambda = 10$/h, $\\sigma_a = 6$ min, $1/\\mu = 5$ min, $cv_s^2 = 1$';
const E7 = 'Exercise 7: release every 90 min, $1/\\mu = 80$ min, $cv_s^2 = 1.2$';

const numeric = (
  id: string, concept: string, prompt: string, answer: number, unit: string, tolerance: number,
  hints: [string, string, string], explain: string, inLecture?: string,
): Question => ({ id, type: 'numeric', concept, prompt, answer, unit, tolerance, hints, explain, inLecture });

const QUEUE_FORMULA = 'E[W_q] = \\frac{cv_a^2 + cv_s^2}{2} \\cdot \\frac{\\rho}{1-\\rho} \\cdot \\frac{1}{\\mu}';

// ---------------------------------------------------------------------------

const L6_1: Level = {
  id: '6.1', world: 6, title: 'Dice Bar', subtitle: 'Expected value, variance and cv', failKind: 'too-little',
  steps: () => [
    {
      kind: 'learn', title: 'A random order system', inLecture: T6,
      body:
        'The Dice Bar sells a new deal: pay a fixed fee, roll a fair die, and get as many beers as the die shows. Each beer costs the bar **3 EUR**. The cost per guest is a **random variable**: it is uncertain before the roll (the *uncertainty* axis of the variability cube).\n\n' +
        'To price the deal, Bruno needs its **expected value**, how much it spreads (**variance** and **standard deviation**), and the **coefficient of variation** $cv = \\sigma / E[X]$, which compares spread with the average.',
      formula: '\\begin{gathered} E[X] = \\sum_i x_i \\cdot p(x_i) \\qquad V[X] = \\sum_i (x_i - E[X])^2 \\cdot p(x_i) \\\\ \\sigma = \\sqrt{V[X]} \\qquad cv = \\frac{\\sigma}{E[X]} \\end{gathered}',
    },
    {
      kind: 'sample', title: 'Roll the dice', brief: 'Roll a few times, then 1,000 times. Watch the sample average settle. Cost per guest = 3 EUR × beers.',
      dists: [{ label: 'Cost per guest', dist: DICE }], unit: 'EUR', scale: 3, face: 'die', xLabel: 'Beers on the die (each costs 3 EUR)', inLecture: T6,
    },
    { kind: 'question', q: numeric('6.1-a', 'w6.expected', 'Expected **cost per guest** $E[C]$ for the bar?', 10.5, 'EUR', 0.01,
      ['Each face 1–6 has probability 1/6.', '$E[X] = \\sum_i x_i \\cdot p(x_i)$, and the cost is $3X$.', '$E[X] = (1+2+3+4+5+6)/6 = 3.5$ beers.'],
      '$E[X] = 3.5$ beers, so $E[C] = 3 \\cdot 3.5 = 10.50$ EUR. The fee must be above this to make money on average.', T6) },
    { kind: 'question', q: numeric('6.1-b', 'w6.variance', 'Variance of the cost $V[C]$ (in EUR²)?', 26.25, 'EUR²', 0.01,
      ['Costs are 3, 6, 9, 12, 15, 18 EUR, each with probability 1/6.', '$V[C] = \\sum_i (c_i - E[C])^2 \\cdot p(c_i)$ with $E[C] = 10.5$.', '$(3-10.5)^2 = 56.25$, $(6-10.5)^2 = 20.25$, $(9-10.5)^2 = 2.25$, … then average.'],
      '$V[C] = \\frac{1}{6}(56.25 + 20.25 + 2.25 + 2.25 + 20.25 + 56.25) = 26.25$ EUR². Equivalently $V[3X] = 9 \\cdot V[X] = 9 \\cdot 2.917$.', T6) },
    { kind: 'question', q: numeric('6.1-c', 'w6.cv', 'Coefficient of variation of the cost (2 decimals)?', 0.49, '', 0.006,
      ['First the standard deviation.', '$\\sigma = \\sqrt{V[C]}$, $cv = \\sigma / E[C]$.', '$\\sigma = \\sqrt{26.25} = 5.12$ EUR.'],
      '$\\sigma = \\sqrt{26.25} = 5.12$ EUR and $cv = 5.12 / 10.50 = 0.49$.', T6) },
    {
      kind: 'question', q: {
        id: '6.1-d', type: 'tf', concept: 'w6.cv', inLecture: T6,
        prompt: 'True or false: "If each beer cost the bar 2 EUR instead of 3 EUR, the coefficient of variation of the cost would change."',
        answer: false,
        reasons: [
          'Scaling by a constant scales $\\sigma$ and $E[X]$ by the same factor, so $cv$ stays the same.',
          'Cheaper beer always means less variability.',
          'The variance does not depend on the price.',
        ],
        reasonAnswer: 0,
        hints: ['Write the cost as $k \\cdot X$.', '$E[kX] = k E[X]$ and $\\sigma(kX) = k\\,\\sigma(X)$.', 'What happens to the ratio?'],
        explain: 'False. $cv = \\frac{k\\,\\sigma}{k\\,E[X]} = \\frac{\\sigma}{E[X]} = 0.49$ for any price per beer. The cv measures *relative* spread.',
      },
    },
  ],
};

const L6_2: Level = {
  id: '6.2', world: 6, title: 'Two Bottlers', subtitle: 'Which machine is more variable?', failKind: 'too-little',
  steps: () => [
    {
      kind: 'learn', title: 'Same average, different spread', inLecture: E6,
      body:
        'Two bottling machines work at the same station. Their processing times (in seconds) follow different distributions:\n\n' +
        'Times $x_i$ = **25, 30, 35, 40, 45 s**. Machine 1: $p(x_i)$ = **0.13, 0.13, 0.40, 0.17, 0.17**. Machine 2: $p(x_i)$ = **0.03, 0.07, 0.70, 0.15, 0.05**.\n\n' +
        'Both average 35.6 s. The **coefficient of variation** tells you which one is more affected by stochastic variability.',
    },
    {
      kind: 'sample', title: 'Time both machines', brief: 'Draw processing times from both machines and compare their spread.',
      dists: [{ label: 'Machine 1', dist: MACHINE_1 }, { label: 'Machine 2', dist: MACHINE_2 }], unit: 's', xLabel: 'Processing time (s)', inLecture: E6,
    },
    { kind: 'question', q: numeric('6.2-a', 'w6.expected', 'Expected processing time $E[X]$ of machine 1?', 35.6, 's', 0.01,
      ['Weight each time by its probability.', '$E[X] = \\sum_i x_i \\cdot p(x_i)$.', '$25 \\cdot 0.13 + 30 \\cdot 0.13 + 35 \\cdot 0.40 + \\dots$'],
      '$E[X] = 25 \\cdot 0.13 + 30 \\cdot 0.13 + 35 \\cdot 0.40 + 40 \\cdot 0.17 + 45 \\cdot 0.17 = 35.60$ s (machine 2 also: 35.60 s).', E6) },
    { kind: 'question', q: numeric('6.2-b', 'w6.variance', 'Variance $V[X]$ of machine 1 (s², 2 decimals)?', 37.14, 's²', 0.01,
      ['Squared distance from 35.6, weighted by probability.', '$V[X] = \\sum_i (x_i - E[X])^2 \\cdot p(x_i)$.', '$0.13 \\cdot (25-35.6)^2 = 14.61$, …'],
      '$V[X] = 0.13 \\cdot 10.6^2 + 0.13 \\cdot 5.6^2 + 0.40 \\cdot 0.6^2 + 0.17 \\cdot 4.4^2 + 0.17 \\cdot 9.4^2 = 37.14$ s², so $\\sigma = 6.09$ s.', E6) },
    { kind: 'question', q: numeric('6.2-c', 'w6.cv', 'Coefficient of variation of machine 2 (2 decimals)? Its variance is $13.14$ s².', 0.1, '', 0.006,
      ['$\\sigma = \\sqrt{V[X]}$.', '$cv = \\sigma / E[X]$.', '$\\sigma = \\sqrt{13.14} = 3.62$ s.'],
      '$\\sigma = 3.62$ s and $cv = 3.62 / 35.60 = 0.10$ (machine 1: $6.09 / 35.60 = 0.17$).', E6) },
    {
      kind: 'question', q: {
        id: '6.2-d', type: 'tf', concept: 'w6.cv', inLecture: E6,
        prompt: 'True or false: "Machine 1 is more affected by stochastic variability than machine 2."',
        answer: true,
        reasons: [
          'Its coefficient of variation is higher (0.17 vs. 0.10).',
          'Its expected processing time is higher.',
          'It has more possible processing times.',
        ],
        reasonAnswer: 0,
        hints: ['Compare the averages first: are they different?', 'Which measure compares spread relative to the mean?', 'cv 0.17 vs. 0.10.'],
        explain: 'True. Both have $E[X] = 35.60$ s, but machine 1 has $cv = 0.17 > 0.10$: its times spread more around the same average.',
      },
    },
  ],
};

const bufferItems = [
  { label: 'Brew extra kegs before the festival weekend', answer: 0 },
  { label: 'Guests wait 20 minutes at the bar on Friday', answer: 1 },
  { label: 'Hire a second bartender for peak nights', answer: 2 },
  { label: 'Guests see the long line and walk away', answer: 3 },
  { label: 'Fill the cellar with bottles in slow weeks', answer: 0 },
  { label: 'Deliver the order to the pub two days late', answer: 1 },
];

const L6_3: Level = {
  id: '6.3', world: 6, title: 'Match or Mismatch', subtitle: 'Variability buffers', failKind: 'wrong-classification',
  steps: (rng) => [
    {
      kind: 'learn', title: 'When supply and demand do not match', inLecture: 'Stolletz & Tan (2024): variability buffers',
      body:
        'Variability (uncertainty, dynamics, heterogeneity) makes it hard to match supply and demand in **volume, time and quality**. A mismatch is absorbed by a **variability buffer**:\n\n' +
        '**Early match** → inventory / work in process (inventory cost). **Late match** → service level: longer lead or waiting time (backlog cost). **Lost customer** → lost revenue. **Changed capacity** → capacity cost.\n\n' +
        'Matching exactly is not always best: a mismatch strategy pays off when the extra revenue outweighs the cost of its buffer.',
    },
    {
      kind: 'question', q: {
        id: '6.3-a', type: 'classify', concept: 'w6.buffers',
        prompt: 'Which variability buffer does each situation use?',
        categories: ['Inventory (early match)', 'Waiting / lead time (late match)', 'Capacity', 'Lost customers'],
        items: shuffle(rng, bufferItems),
        hints: ['Early match = produce before demand arrives.', 'Late match = the customer waits.', 'Capacity = change how much you can serve; lost = demand never served.'],
        explain: 'Pre-producing builds **inventory**; waiting and late delivery use **time**; an extra bartender is **capacity**; guests who leave are **lost customers** (lost revenue).',
      },
    },
    {
      kind: 'question', q: {
        id: '6.3-b', type: 'cube', concept: 'w6.variability',
        prompt: 'Place the Bar Counter queue in the variability cube.',
        scenario: 'One bartender serves one kind of beer. Guests arrive at random moments and each order takes a random time, but the average arrival and service rates stay the same all evening.',
        answer: [1, 0, 0] as CubeCorner,
        hints: ['Are arrival and service times known in advance?', 'Do the averages change over the evening?', 'How many kinds of guests or products?'],
        explain: 'Random times = **stochastic**; constant averages = **stationary**; one product and one server = **homogeneous**. This is the setting of single-server queueing formulas.',
      },
    },
    {
      kind: 'question', q: {
        id: '6.3-c', type: 'mc', concept: 'w6.buffers',
        prompt: 'Which statement fits the (mis-)matching framework?',
        options: [
          'A mismatch can be the better strategy if the extra revenue outweighs the cost of its variability buffer.',
          'Supply must always match demand exactly in volume, time and quality.',
          'Variability buffers are only needed for deterministic demand.',
          'Inventory is the only possible variability buffer.',
        ],
        answer: 0,
        hints: ['Is exact matching always possible, or always cheapest?', 'Think of the buffer costs vs. revenue.', 'Stolletz & Tan argue that mismatching can be optimal.'],
        explain: 'Exact matching is not always optimal. An effective mismatch strategy increases revenue by more than the cost of the buffers it needs (inventory, time, capacity or lost demand).',
      },
    },
  ],
};

const L6_4: Level = {
  id: '6.4', world: 6, title: 'One Bartender', subtitle: 'Utilization, waiting time, Little\'s law', failKind: 'queue-fail',
  steps: () => [
    {
      kind: 'learn', title: 'A single-server queue', inLecture: T7,
      body:
        'Guests arrive at rate $\\lambda$ = **10 per hour** (mean gap 6 min, $\\sigma_a$ = 6 min). Bruno serves one at a time, first come first served: on average $1/\\mu$ = **5 min** per guest with $cv_s^2 = 1$.\n\n' +
        '**Utilization** $\\rho = \\lambda / \\mu$ is the share of time Bruno is busy. The expected wait in line grows with variability ($cv_a^2$, $cv_s^2$) and explodes as $\\rho \\to 1$. Add the service time for the **cycle time** $E[W_s] = E[W_q] + 1/\\mu$, and use **Little\'s law** $E[L_s] = \\lambda \\cdot E[W_s]$ for the number of guests in the bar.',
      formula: QUEUE_FORMULA,
    },
    {
      kind: 'queue', title: 'Open the bar', brief: 'Run one 8-hour shift (use 16× or skip to closing). Then compare the shift with the formula.',
      setup: { lambdaPerHour: 10, serviceMin: 5, cva2: 1, cvs2: 1 }, theory: 'after-run', mustRun: true, inLecture: T7,
    },
    { kind: 'question', q: numeric('6.4-a', 'w6.utilization', 'What is $cv_a^2$, the squared cv of the time between arrivals?', 1, '', 0.001,
      ['Mean time between arrivals = 60 / 10 min.', '$cv_a = \\sigma_a / E[\\text{inter-arrival time}]$.', '$\\sigma_a = 6$ min and the mean is 6 min.'],
      'The mean gap is $60/10 = 6$ min and $\\sigma_a = 6$ min, so $cv_a = 1$ and $cv_a^2 = 1$ (as with random, "Poisson" arrivals).', T7) },
    { kind: 'question', q: numeric('6.4-b', 'w6.utilization', 'Utilization $\\rho$ of Bruno (as a decimal)?', 5 / 6, '', 0.005,
      ['Both rates per hour.', '$\\rho = \\lambda / \\mu$ with $\\mu = 60/5$ per hour.', '$\\mu = 12$ guests per hour.'],
      '$\\rho = \\lambda / \\mu = 10 / 12 = 0.833$: Bruno is busy 83.3% of the time.', T7) },
    { kind: 'question', q: numeric('6.4-c', 'w6.waiting', 'Expected waiting time in line $E[W_q]$ (min)?', 25, 'min', 0.05,
      ['Use the single-server formula.', `$${QUEUE_FORMULA}$`, '$\\frac{1+1}{2} = 1$ and $\\frac{\\rho}{1-\\rho} = \\frac{5/6}{1/6} = 5$.'],
      '$E[W_q] = 1 \\cdot 5 \\cdot 5 = 25$ min.', T7) },
    { kind: 'question', q: numeric('6.4-d', 'w6.waiting', 'Expected time a guest spends in the bar $E[W_s]$ (min)?', 30, 'min', 0.05,
      ['Waiting plus being served.', '$E[W_s] = E[W_q] + 1/\\mu$.', '$25 + 5$.'],
      '$E[W_s] = 25 + 5 = 30$ min.', T7) },
    { kind: 'question', q: numeric('6.4-e', 'w6.little', 'Expected number of guests in the bar $E[L_s]$?', 5, 'guests', 0.02,
      ['Little\'s law.', '$E[L_s] = \\lambda \\cdot E[W_s]$, same time unit!', '$\\lambda = 10/60$ per minute.'],
      '$E[L_s] = \\frac{10}{60} \\cdot 30 = 5$ guests (one being served, about 4.2 in line on average).', T7) },
  ],
};

const L6_5: Level = {
  id: '6.5', world: 6, title: 'Rush Hour', subtitle: 'Why waiting explodes near ρ = 1', failKind: 'queue-fail',
  steps: () => [
    {
      kind: 'learn', title: 'The hockey stick',
      body:
        'The factor $\\frac{\\rho}{1-\\rho}$ is 1 at $\\rho = 50\\%$, 4 at 80%, 9 at 90% and 99 at 99%. A few more guests per hour can double the wait.\n\n' +
        'With $\\rho \\ge 1$ Bruno cannot keep up at all: the line grows without limit and there is no steady state. Variability multiplies everything by $\\frac{cv_a^2 + cv_s^2}{2}$: without any variability (0 and 0) nobody waits, however busy Bruno is.',
      formula: QUEUE_FORMULA,
    },
    {
      kind: 'queue', title: 'Push the bar to its limit', brief: 'Raise the arrival rate step by step, then try calmer service (lower $cv_s^2$). Watch where your shift lands on the curve.',
      setup: { lambdaPerHour: 10, serviceMin: 5, cva2: 1, cvs2: 1 }, controls: { lambda: true, service: true, cva: true, cvs: true }, theory: 'always',
    },
    {
      kind: 'question', q: {
        id: '6.5-a', type: 'tf', concept: 'w6.utilization', inLecture: 'Exercise 7, problem 1(a)',
        prompt: 'True or false: "More variable service times lead to a higher utilization (all else equal)."',
        answer: false,
        reasons: [
          'Utilization $\\rho = \\lambda/\\mu$ depends only on the means, not on the distributions.',
          'Variability always lowers utilization.',
          'Utilization rises because guests wait longer.',
        ],
        reasonAnswer: 0,
        hints: ['Look at the utilization formula.', 'Which parameters appear in $\\rho$?', 'Does $cv_s^2$ appear?'],
        explain: 'False. $\\rho = \\lambda / \\mu$ uses only the arrival and service **rates**. Variability changes the waiting time, not the utilization.',
      },
    },
    { kind: 'question', q: numeric('6.5-b', 'w6.waiting', 'Back to 5 min service with $cv_a^2 = cv_s^2 = 1$. The rush brings **11 guests per hour**. New $E[W_q]$ (min)?', 55, 'min', 0.1,
      ['Only $\\rho$ changes.', '$\\rho = 11/12$, so $\\frac{\\rho}{1-\\rho} = 11$.', '$E[W_q] = 1 \\cdot 11 \\cdot 5$.'],
      '$\\rho = 11/12 = 0.917$, $\\frac{\\rho}{1-\\rho} = 11$, $E[W_q] = 1 \\cdot 11 \\cdot 5 = 55$ min: one more guest per hour more than doubles the wait (from 25 min).') },
    { kind: 'question', q: numeric('6.5-c', 'w6.waiting', 'Still 10 guests per hour, but a pouring routine cuts service variability to $cv_s^2 = 0.5$ ($cv_a^2 = 1$). New $E[W_q]$ (min)?', 18.75, 'min', 0.02,
      ['$\\rho$ stays 5/6.', 'Only the variability factor changes.', '$\\frac{1 + 0.5}{2} = 0.75$.'],
      '$E[W_q] = 0.75 \\cdot 5 \\cdot 5 = 18.75$ min, 25% less waiting with the same staff and speed.') },
    {
      kind: 'question', q: {
        id: '6.5-d', type: 'mc', concept: 'w6.utilization',
        prompt: 'What happens if guests arrive faster than Bruno can serve them ($\\lambda \\ge \\mu$)?',
        options: ['The line grows without limit: no steady state', 'The wait settles at a high but stable level', 'Utilization rises above 100%', 'Guests are served faster'],
        answer: 0,
        hints: ['Can utilization exceed 100%?', 'What does $1 - \\rho$ become?', 'Try it in the bar above.'],
        explain: 'With $\\rho \\ge 1$ the formula breaks ($1 - \\rho \\le 0$) because the queue is **unstable**: every hour more guests arrive than can be served, so the line keeps growing.',
      },
    },
  ],
};

const L6_6: Level = {
  id: '6.6', world: 6, title: 'Clockwork Tours', subtitle: 'Scheduled arrivals and Little\'s law', failKind: 'queue-fail',
  steps: () => [
    {
      kind: 'learn', title: 'Arrivals like clockwork', inLecture: E7,
      body:
        'Bruno\'s tasting booth runs 24 hours a day. A tour group arrives **exactly every 90 minutes** (clock-controlled, no variation). A tasting takes **80 minutes** on average, with $cv_s^2 = 1.2$ (some groups have questions…).\n\n' +
        'Even with perfectly regular arrivals, random service times create waiting.',
      formula: QUEUE_FORMULA,
    },
    {
      kind: 'queue', title: 'Watch two days of tours', brief: 'Each guest is one tour group. Use 16× speed: the booth is busy most of the time.',
      setup: { lambdaPerHour: 60 / 90, serviceMin: 80, cva2: 0, cvs2: 1.2 }, hours: 48, theory: 'after-run', mustRun: true, inLecture: E7,
    },
    {
      kind: 'question', q: {
        id: '6.6-a', type: 'mc', concept: 'w6.utilization', inLecture: E7,
        prompt: 'What is $cv_a^2$ for arrivals released exactly every 90 minutes?',
        options: ['0', '1', '1.2', '90'], answer: 0,
        hints: ['How much do the gaps between arrivals vary?', '$cv_a = \\sigma_a / E[\\text{gap}]$.', 'Every gap is exactly 90 min: $\\sigma_a = 0$.'],
        explain: 'Clock-controlled releases have no variation: $\\sigma_a = 0$, so $cv_a^2 = 0$.',
      },
    },
    { kind: 'question', q: numeric('6.6-b', 'w6.utilization', 'Utilization $\\rho$ of the booth (decimal)?', 8 / 9, '', 0.005,
      ['$\\lambda = 1/90$ per min, $\\mu = 1/80$ per min.', '$\\rho = \\lambda/\\mu$.', '$\\frac{60/90}{60/80}$.'],
      '$\\rho = \\frac{60/90}{60/80} = \\frac{80}{90} = \\frac{8}{9} = 0.889$.', E7) },
    { kind: 'question', q: numeric('6.6-c', 'w6.waiting', 'Expected waiting time $E[W_q]$ (min)?', 384, 'min', 0.5,
      [`$${QUEUE_FORMULA}$`, '$\\frac{0 + 1.2}{2} = 0.6$ and $\\frac{8/9}{1/9} = 8$.', '$0.6 \\cdot 8 \\cdot 80$.'],
      '$E[W_q] = 0.6 \\cdot 8 \\cdot 80 = 384$ min: more than 6 hours of waiting.', E7) },
    { kind: 'question', q: numeric('6.6-d', 'w6.waiting', 'Expected cycle time $E[W_s]$ (min)?', 464, 'min', 0.5,
      ['Waiting plus processing.', '$E[W_s] = E[W_q] + 1/\\mu$.', '$384 + 80$.'],
      '$E[W_s] = 384 + 80 = 464$ min.', E7) },
    { kind: 'question', q: numeric('6.6-e', 'w6.little', 'Expected work in process $E[L_s]$ (tour groups, 2 decimals)?', 464 / 90, 'groups', 0.01,
      ['Little\'s law.', '$E[L_s] = \\lambda \\cdot E[W_s]$.', '$\\frac{1}{90} \\cdot 464$ (both in minutes).'],
      '$E[L_s] = \\frac{60}{90} \\cdot \\frac{464}{60} = 5.16$ tour groups.', E7) },
    {
      kind: 'question', q: {
        id: '6.6-f', type: 'tf', concept: 'w6.little', inLecture: 'Exercise 7, problem 1(b)',
        prompt: 'True or false: "In steady state, the expected throughput equals the expected work in process divided by the expected cycle time."',
        answer: true,
        reasons: [
          'Little\'s law: $E[L_s] = th \\cdot E[W_s]$, so $th = E[L_s] / E[W_s]$.',
          'Throughput always equals utilization.',
          'It only holds for deterministic systems.',
        ],
        reasonAnswer: 0,
        hints: ['Which law links WIP, throughput and cycle time?', 'In steady state, throughput = arrival rate.', '$E[L_s] = \\lambda \\cdot E[W_s]$.'],
        explain: 'True. Little\'s law $E[L_s] = th \\cdot E[W_s]$ holds for any stable system, so $th = E[L_s]/E[W_s]$.',
      },
    },
  ],
};

export const NIGHT_SHIFT: StaffMission = {
  lambdaPerHour: 10, cva2: 1, target: 10, metric: 'wq',
  options: [
    { name: 'Rookie Rudi', note: 'Friendly, not fast', serviceMin: 5, cvs2: 1, cost: 90 },
    { name: 'Rudi + pouring routine', note: 'Same speed, far more consistent', serviceMin: 5, cvs2: 0.2, cost: 110 },
    { name: 'Tap robot', note: 'Slightly quicker, perfectly regular', serviceMin: 4.5, cvs2: 0, cost: 130 },
    { name: 'Pro Petra', note: 'Fast, but orders vary', serviceMin: 4, cvs2: 1, cost: 150 },
    { name: 'Speedy Sam', note: 'Very fast, very chaotic', serviceMin: 3, cvs2: 2, cost: 200 },
  ],
};

const L6_7: Level = {
  id: '6.7', world: 6, title: 'Calmer Hands', subtitle: 'Reduce variability or add speed?', failKind: 'queue-fail',
  steps: () => [
    {
      kind: 'learn', title: 'Variability costs time', inLecture: 'Exercise 7, problem 2(b)',
      body:
        'Back at the tasting booth ($\\rho = 8/9$, $1/\\mu$ = 80 min, $cv_a^2 = 0$). The manager wants the expected cycle time to be **at most 5 hours**. A new, calmer machine would lower $cv_s^2$. How low must it go?\n\n' +
        'Set $E[W_s] = \\frac{0 + cv_s^2}{2} \\cdot 8 \\cdot 80 + 80 \\le 300$ min and solve for $cv_s^2$.',
    },
    { kind: 'question', q: numeric('6.7-a', 'w6.waiting', 'Largest $cv_s^2$ that keeps $E[W_s] \\le 5$ h (2 decimals)?', 0.6875, '', 0.006,
      ['Write the waiting time as a function of $cv_s^2$.', '$320 \\cdot cv_s^2 + 80 \\le 300$.', '$cv_s^2 \\le 220 / 320$.'],
      '$\\frac{cv_s^2}{2} \\cdot 8 \\cdot 80 = 320\\,cv_s^2$, so $320\\,cv_s^2 + 80 \\le 300 \\Rightarrow cv_s^2 \\le 0.69$.', E7) },
    { kind: 'question', q: numeric('6.7-b', 'w6.waiting', 'By how much must $cv_s^2$ drop from today\'s 1.2 (2 decimals)?', 0.5125, '', 0.006,
      ['Today: 1.2.', 'Needed: at most 0.69.', '$1.2 - 0.6875$.'],
      'From 1.2 to 0.69: a reduction of **0.51**.', E7) },
    {
      kind: 'queue', title: 'Hire for festival night',
      brief: `10 guests per hour arrive at random ($cv_a^2 = 1$). Keep the expected wait in line at **10 minutes or less** for the lowest nightly cost. Test options in the bar, but decide with $${QUEUE_FORMULA}$.`,
      setup: { lambdaPerHour: 10, serviceMin: 5, cva2: 1, cvs2: 1 }, theory: 'never', mission: NIGHT_SHIFT,
    },
  ],
};

// ---------------------------------------------------------------------------
// Boss: random festival night.

const NAMES = ['Rookie Rudi', 'Pro Petra', 'Tap robot', 'Speedy Sam', 'Calm Carla', 'Bruno\'s cousin'];
const NOTES: Record<string, string> = {
  'Rookie Rudi': 'Friendly, not fast', 'Pro Petra': 'Fast and experienced', 'Tap robot': 'Perfectly regular',
  'Speedy Sam': 'Very fast, very chaotic', 'Calm Carla': 'Unhurried but steady', 'Bruno\'s cousin': 'Cheap and unpredictable',
};

export const bossMission = (rng: Rng): StaffMission => {
  for (let tries = 0; tries < 400; tries++) {
    const lambdaPerHour = int(rng, 8, 15);
    const cva2 = pick(rng, [0.5, 1, 1.5]);
    const target = pick(rng, [5, 6, 8, 10, 12]);
    const gap = 60 / lambdaPerHour;
    const names = shuffle(rng, NAMES).slice(0, 5);
    const options: StaffOption[] = names.map((name) => {
      const rho = pick(rng, [0.55, 0.62, 0.7, 0.76, 0.82, 0.88, 0.94]);
      const cvs2 = name === 'Tap robot' ? 0 : pick(rng, [0.25, 0.5, 1, 1.5, 2]);
      const serviceMin = Math.round(rho * gap * 10) / 10;
      const cost = Math.round((60 + 240 * (1 - rho) + 30 * (2 - cvs2)) / 5) * 5;
      return { name, note: NOTES[name], serviceMin, cvs2, cost };
    });
    const m: StaffMission = { lambdaPerHour, cva2, target, metric: 'wq', options };
    const ok = options.map((o) => staffMetric(m, o) <= target);
    const feasible = options.filter((_, i) => ok[i]);
    if (feasible.length < 2 || feasible.length > 3) continue;
    const costs = options.map((o) => o.cost);
    if (new Set(costs).size < costs.length) continue;
    const cheapest = costs.indexOf(Math.min(...costs));
    if (ok[cheapest]) continue;
    const best = judgeStaffing(m, 0).best;
    if (best < 0) continue;
    // The fastest option should not be the answer: variability has to matter.
    const fastest = Math.min(...options.map((o) => o.serviceMin));
    if (options[best].serviceMin <= fastest) continue;
    return m;
  }
  return NIGHT_SHIFT;
};

const L6_B: Level = {
  id: '6.B', world: 6, title: 'Boss: Festival Night', subtitle: 'Fresh numbers, one hiring decision', failKind: 'queue-fail', boss: true,
  steps: (rng) => {
    const m = bossMission(rng);
    const o = m.options[int(rng, 0, m.options.length - 1)];
    const q = { lambda: m.lambdaPerHour / 60, mu: 1 / o.serviceMin, cva2: m.cva2, cvs2: o.cvs2 };
    const met = queueMetrics(q);
    return [
      { kind: 'question', q: numeric('6.B-a', 'w6.utilization', `${m.lambdaPerHour} guests per hour. **${o.name}** needs $1/\\mu$ = ${fmt(o.serviceMin, 1)} min per guest. Utilization $\\rho$ (decimal)?`, met.rho, '', 0.005,
        ['Same time unit for both rates.', '$\\rho = \\lambda / \\mu = \\lambda \\cdot (1/\\mu)$.', `$\\frac{${m.lambdaPerHour}}{60} \\cdot ${fmt(o.serviceMin, 1)}$.`],
        `$\\rho = \\frac{${m.lambdaPerHour}}{60} \\cdot ${fmt(o.serviceMin, 1)} = ${fmt(met.rho, 3)}$.`) },
      { kind: 'question', q: numeric('6.B-b', 'w6.waiting', `With $cv_a^2 = ${fmt(m.cva2, 2)}$ and $cv_s^2 = ${fmt(o.cvs2, 2)}$: expected wait in line $E[W_q]$ (min, 1 decimal)?`, met.wq, 'min', 0.06,
        [`$${QUEUE_FORMULA}$`, `Variability factor $\\frac{${fmt(m.cva2, 2)} + ${fmt(o.cvs2, 2)}}{2} = ${fmt((m.cva2 + o.cvs2) / 2, 3)}$.`, `$\\frac{\\rho}{1-\\rho} = ${fmt(met.rho / (1 - met.rho), 3)}$.`],
        `$E[W_q] = ${fmt((m.cva2 + o.cvs2) / 2, 3)} \\cdot ${fmt(met.rho / (1 - met.rho), 3)} \\cdot ${fmt(o.serviceMin, 1)} = ${fmt(met.wq, 1)}$ min.`) },
      {
        kind: 'queue', title: 'Hire for the festival',
        brief: `Keep $E[W_q] \\le ${m.target}$ min at the lowest cost. Compute each option with the formula; the bar only shows one random night.`,
        setup: { lambdaPerHour: m.lambdaPerHour, serviceMin: m.options[0].serviceMin, cva2: m.cva2, cvs2: m.options[0].cvs2 }, theory: 'never', mission: m,
      },
    ];
  },
};

export const world6: World = {
  id: 6, room: 'bar-counter', name: 'Bar Counter', topic: 'Queues & Variability', color: 'var(--room-6)',
  lecture: 'Tutorials & exercises 6–7',
  levels: [L6_1, L6_2, L6_3, L6_4, L6_5, L6_6, L6_7, L6_B],
};
