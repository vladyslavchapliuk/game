// The optimization models from OPM 301 Lecture II, in the lecture's notation.
// Used by the Study desk (Models & notation) and inside levels.

export interface Sym { tex: string; text: string; example?: string }
export interface ModelLine { tex: string; why?: string }
export interface Model {
  id: string;
  title: string;
  lecture: string;
  sense: 'max' | 'min';
  indices: Sym[];
  params: Sym[];
  vars: Sym[];
  objective: ModelLine;
  constraints: ModelLine[];
  note?: string;
}

export const MODELS: Model[] = [
  {
    id: 'project-selection',
    title: 'Optimal project selection',
    lecture: 'Lecture II, ch. 3 (Chair vs. Table)',
    sense: 'max',
    indices: [
      { tex: 'i \\in \\{1,\\dots,I\\}', text: 'projects', example: 'Chair (C), Table (T)' },
      { tex: 'j \\in \\{1,\\dots,J\\}', text: 'resources (personnel, capital, …)', example: 'small blocks (1), large blocks (2)' },
    ],
    params: [
      { tex: 'c_j', text: 'capacity of resource j', example: '$c_1 = 12,\\ c_2 = 8$' },
      { tex: 'a_{ij}', text: 'required capacity of resource j for one project i', example: '$a_{C1} = 2,\\ a_{C2} = 1,\\ a_{T1} = 2,\\ a_{T2} = 2$' },
      { tex: 'e_i', text: 'revenue from conducting one project i', example: '$e_C = 1{,}000,\\ e_T = 2{,}500$' },
      { tex: 'd_i', text: 'demand for project i', example: '$d_C = 6,\\ d_T = 3$' },
    ],
    vars: [{ tex: 'X_i', text: 'production quantity of project i' }],
    objective: { tex: '\\max\\; Z = \\sum_{i=1}^{I} e_i \\cdot X_i', why: 'maximize revenue of accepted projects' },
    constraints: [
      { tex: '\\sum_{i=1}^{I} a_{ij} \\cdot X_i \\le c_j \\quad \\forall j \\in \\{1,\\dots,J\\}', why: 'resource capacity' },
      { tex: 'X_i \\le d_i \\quad \\forall i \\in \\{1,\\dots,I\\}', why: 'no more than demand' },
      { tex: 'X_i \\ge 0,\\; X_i \\text{ integer} \\quad \\forall i', why: 'integer quantities (IP)' },
    ],
    note: 'Specific example: $\\max\\ 1000 X_C + 2500 X_T$ s.t. $2X_C + 2X_T \\le 12$, $X_C + 2X_T \\le 8$, $X_C \\le 6$, $X_T \\le 3$, integer.',
  },
  {
    id: 'aggregate',
    title: 'Aggregate planning',
    lecture: 'Lecture II, ch. 4',
    sense: 'min',
    indices: [{ tex: 't \\in \\{1,\\dots,T\\}', text: 'periods', example: 'T = 8' }],
    params: [
      { tex: 'd_t', text: 'aggregated demand in period t', example: '590, 260, 1000, 1090, 750, 810, 570, 930' },
      { tex: 'c', text: 'production capacity per period', example: '750 units' },
      { tex: 'k^l', text: 'inventory holding costs per unit and period', example: '22 EUR' },
      { tex: 'k^o', text: 'costs per unit of overtime', example: '72 EUR' },
    ],
    vars: [
      { tex: 'X_t', text: 'production quantity in period t' },
      { tex: 'O_t', text: 'used overtime in period t' },
      { tex: 'L_t', text: 'inventory level at the end of period t' },
    ],
    objective: { tex: '\\min\\; Z = \\sum_{t=1}^{T} k^l \\cdot L_t + \\sum_{t=1}^{T} k^o \\cdot O_t', why: 'holding + overtime costs' },
    constraints: [
      { tex: 'X_1 - d_1 = L_1', why: 'inventory balance, first period ($L_0 = 0$)' },
      { tex: 'L_{t-1} + X_t - d_t = L_t \\quad \\forall t \\in \\{2,\\dots,T\\}', why: 'inventory balance; $L_t \\ge 0$ forces demand to be met' },
      { tex: 'X_t \\le c + O_t \\quad \\forall t \\in \\{1,\\dots,T\\}', why: 'capacity, extended by overtime' },
      { tex: 'X_t,\\, L_t,\\, O_t \\ge 0 \\quad \\forall t', why: 'non-negativity' },
    ],
  },
  {
    id: 'aggregate-backlog',
    title: 'Aggregate planning with backlog',
    lecture: 'Lecture II, ch. 4.4',
    sense: 'min',
    indices: [{ tex: 't \\in \\{1,\\dots,T\\}', text: 'periods' }],
    params: [
      { tex: 'd_t,\\; c,\\; k^l,\\; k^o', text: 'as in aggregate planning' },
      { tex: 'k^b', text: 'backlog cost per unit and period', example: '18 EUR' },
    ],
    vars: [
      { tex: 'X_t,\\; O_t,\\; L_t', text: 'as before' },
      { tex: 'B_t', text: 'backlog at the end of period t = (cumulative demand − cumulative production)⁺' },
    ],
    objective: { tex: '\\min\\; Z = \\sum_{t=1}^{T} k^l L_t + \\sum_{t=1}^{T} k^o O_t + \\sum_{t=1}^{T} k^b B_t', why: 'holding + overtime + backlog' },
    constraints: [
      { tex: 'X_1 - d_1 = L_1 - B_1', why: 'balance with backlog, period 1' },
      { tex: 'L_{t-1} - B_{t-1} + X_t - d_t = L_t - B_t \\quad \\forall t \\in \\{2,\\dots,T\\}', why: 'net inventory balance' },
      { tex: 'X_t \\le c + O_t \\quad \\forall t', why: 'capacity + overtime' },
      { tex: 'B_T = 0', why: 'all demand met by the end of the horizon' },
      { tex: 'X_t,\\, L_t,\\, O_t,\\, B_t \\ge 0 \\quad \\forall t', why: 'non-negativity' },
    ],
  },
  {
    id: 'lot-sizing',
    title: 'Capacitated lot sizing',
    lecture: 'Lecture II, ch. 5',
    sense: 'min',
    indices: [{ tex: 't \\in \\{1,\\dots,T\\}', text: 'planning periods', example: 'T = 10' }],
    params: [
      { tex: 'd_t', text: 'demand in period t', example: '20, 50, 10, 50, 50, 10, 20, 40, 20, 30' },
      { tex: 'c', text: 'production capacity per period', example: '150 units' },
      { tex: 'k^l', text: 'inventory holding cost per unit and period', example: '1 EUR' },
      { tex: 's', text: 'setup cost per setup process', example: '100 EUR' },
      { tex: 'M', text: 'sufficiently large number ($M \\ge c$)' },
    ],
    vars: [
      { tex: 'X_t', text: 'production quantity in period t' },
      { tex: 'L_t', text: 'inventory level at the end of period t' },
      { tex: '\\Gamma_t', text: '1 if a setup process occurs in period t, 0 otherwise' },
    ],
    objective: { tex: '\\min\\; \\sum_{t=1}^{T} \\left(k^l \\cdot L_t + s \\cdot \\Gamma_t\\right)', why: 'holding + setup costs' },
    constraints: [
      { tex: 'X_1 - d_1 = L_1', why: 'inventory balance, period 1' },
      { tex: 'L_{t-1} + X_t - d_t = L_t \\quad \\forall t \\in \\{2,\\dots,T\\}', why: 'inventory balance' },
      { tex: 'X_t \\le M \\cdot \\Gamma_t \\quad \\forall t', why: 'production only after a setup ($\\Gamma_t = 0 \\Rightarrow X_t = 0$)' },
      { tex: 'X_t \\le c \\quad \\forall t', why: 'capacity' },
      { tex: 'X_t,\\, L_t \\ge 0,\\quad \\Gamma_t \\in \\{0;1\\} \\quad \\forall t', why: 'binary setup variable' },
    ],
    note: 'Minimizing costs makes $\\Gamma_t = 0$ whenever $X_t = 0$, because every setup costs $s$.',
  },
  {
    id: 'lot-sizing-multi',
    title: 'Capacitated lot sizing with multiple products',
    lecture: 'Lecture II, ch. 5.4',
    sense: 'min',
    indices: [
      { tex: 'i \\in \\{1,\\dots,I\\}', text: 'products', example: '2 products' },
      { tex: 't \\in \\{1,\\dots,T\\}', text: 'planning periods' },
    ],
    params: [
      { tex: 'd_{it}', text: 'demand of product i in period t' },
      { tex: 'c', text: 'production capacity per period', example: '150 hours' },
      { tex: 'a_i', text: 'capacity consumption (production coefficient) of product i', example: '$a_1 = a_2 = 1$ hour/unit' },
      { tex: 's_i,\\; k^l_i', text: 'setup cost and holding cost of product i', example: '$s_i = 100,\\ k^l_i = 1$' },
      { tex: 'M', text: 'sufficiently large number' },
    ],
    vars: [
      { tex: 'X_{it},\\; L_{it}', text: 'production quantity and inventory of product i in period t' },
      { tex: '\\Gamma_{it}', text: '1 if product i is set up in period t' },
    ],
    objective: { tex: '\\min\\; \\sum_{i=1}^{I}\\sum_{t=1}^{T} \\left(k^l_i L_{it} + s_i \\Gamma_{it}\\right)' },
    constraints: [
      { tex: 'L_{i,t-1} + X_{it} - d_{it} = L_{it} \\quad \\forall i, t \\;\\; (L_{i0} = 0)', why: 'balance per product' },
      { tex: 'X_{it} \\le M \\cdot \\Gamma_{it} \\quad \\forall i, t', why: 'setup per product' },
      { tex: '\\sum_{i=1}^{I} a_i \\cdot X_{it} \\le c \\quad \\forall t', why: 'products share the capacity' },
      { tex: 'X_{it},\\, L_{it} \\ge 0,\\; \\Gamma_{it} \\in \\{0;1\\}', why: '' },
    ],
    note: 'Lecture example: minimum-cost plan 995 EUR (setups 700 + holding 295).',
  },
];

export interface SymbolRow { tex: string; meaning: string; where: string }
export const SYMBOLS: SymbolRow[] = [
  { tex: 'W_s', meaning: 'cycle (flow) time of one unit: sum of activity durations', where: 'Process analysis' },
  { tex: '\\text{th}', meaning: 'throughput = min(demand, process capacity)', where: 'Process analysis' },
  { tex: 'u', meaning: 'utilization = actual rate / maximum rate', where: 'Process analysis' },
  { tex: 'c_j,\\; a_{ij},\\; e_i,\\; d_i', meaning: 'resource capacity, requirement, revenue, demand', where: 'Project selection' },
  { tex: 'X_i', meaning: 'quantity of project i (decision)', where: 'Project selection' },
  { tex: 'd_t', meaning: 'demand in period t', where: 'Aggregate planning, lot sizing' },
  { tex: 'c', meaning: 'production capacity per period', where: 'Aggregate planning, lot sizing' },
  { tex: 'k^l', meaning: 'holding cost per unit and period', where: 'Aggregate planning, lot sizing' },
  { tex: 'k^o', meaning: 'overtime cost per unit', where: 'Aggregate planning' },
  { tex: 'k^b', meaning: 'backlog cost per unit and period', where: 'Aggregate planning (backlog)' },
  { tex: 's', meaning: 'setup cost per setup process', where: 'Lot sizing' },
  { tex: 'M', meaning: 'sufficiently large number ($M \\ge c$)', where: 'Lot sizing' },
  { tex: 'X_t', meaning: 'production quantity in period t (decision)', where: 'Aggregate planning, lot sizing' },
  { tex: 'L_t', meaning: 'inventory at the end of period t (decision)', where: 'Aggregate planning, lot sizing' },
  { tex: 'O_t', meaning: 'overtime used in period t (decision)', where: 'Aggregate planning' },
  { tex: 'B_t', meaning: 'backlog at the end of period t (decision)', where: 'Aggregate planning (backlog)' },
  { tex: '\\Gamma_t', meaning: 'setup indicator, 1 if a setup occurs in t (binary decision)', where: 'Lot sizing' },
  { tex: 'E[X],\\; V[X],\\; \\sigma', meaning: 'expected value, variance, standard deviation', where: 'Stochastic variability' },
  { tex: 'cv', meaning: 'coefficient of variation $\\sigma / E[X]$', where: 'Stochastic variability' },
  { tex: '\\lambda,\\; \\mu', meaning: 'arrival rate, service rate', where: 'Queues' },
  { tex: '\\rho', meaning: 'utilization $\\lambda / \\mu$', where: 'Queues' },
  { tex: 'cv_a^2,\\; cv_s^2', meaning: 'squared cv of inter-arrival and service times', where: 'Queues' },
  { tex: 'E[W_q],\\; E[W_s]', meaning: 'expected waiting time in queue, expected cycle time', where: 'Queues' },
  { tex: 'E[L_s]', meaning: 'expected number in system (work in process)', where: 'Queues' },
];
