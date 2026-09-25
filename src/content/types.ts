// Content format. A new lecture = a new world file using these types;
// no screen code needs to change.
import type { Rng } from '../engine/rng';
import type { Stage } from '../engine/opm';
import type { LineConfig } from '../engine/line';
import type { LineControls } from '../components/production/ProductionLine';
import type { AggregateData, LotData } from '../engine/planning';
import type { Preset } from '../components/planning/PlanTable';

export type OutcomeKind =
  | 'perfect'
  | 'good-enough'
  | 'too-much'
  | 'too-little'
  | 'bottleneck-fail'
  | 'queue-fail'
  | 'wrong-classification';

export type FailKind = Exclude<OutcomeKind, 'perfect' | 'good-enough'>;

/** Three hints: nudge, formula, first step. May contain $inline TeX$. */
export type Hints = [string, string, string];

interface QuestionBase {
  id: string;
  /** Concept id used for mastery tracking. */
  concept: string;
  prompt: string;
  hints: Hints;
  /** Worked solution shown after answering or after the last try. */
  explain: string;
  /** Name of the original lecture example this re-skins. */
  inLecture?: string;
}

export interface MCQuestion extends QuestionBase {
  type: 'mc';
  options: string[];
  answer: number;
}

export interface TFQuestion extends QuestionBase {
  type: 'tf';
  answer: boolean;
  /** Candidate reasons; exactly one is right. */
  reasons: string[];
  reasonAnswer: number;
}

export interface NumericQuestion extends QuestionBase {
  type: 'numeric';
  answer: number;
  /** Absolute tolerance. */
  tolerance: number;
  unit: string;
}

export interface ClassifyQuestion extends QuestionBase {
  type: 'classify';
  categories: string[];
  items: { label: string; answer: number }[];
}

/** Cube axes: 0/1 for [uncertainty, dynamics, heterogeneity]. */
export type CubeCorner = [0 | 1, 0 | 1, 0 | 1];
export interface CubeQuestion extends QuestionBase {
  type: 'cube';
  scenario: string;
  answer: CubeCorner;
}

/** Pick a stage on a line (e.g. the bottleneck). */
export interface StageQuestion extends QuestionBase {
  type: 'stage';
  stages: Stage[];
  answer: number;
  /** Show capacities on the cards (false = player must work them out). */
  showRates: boolean;
}

export type Question = MCQuestion | TFQuestion | NumericQuestion | ClassifyQuestion | CubeQuestion | StageQuestion;

/** A one-shot plan: the committed number decides Bruno's fate. */
export interface PlanDecision {
  id: string;
  concept: string;
  prompt: string;
  story: string;
  stages: Stage[];
  demand: number;
  unit: string;
  max: number;
  step: number;
  inLecture?: string;
}

export type Step =
  | { kind: 'learn'; title: string; body: string; formula?: string; inLecture?: string }
  | { kind: 'question'; q: Question }
  | { kind: 'decision'; d: PlanDecision }
  | {
      kind: 'line';
      title: string;
      brief: string;
      config: Partial<LineConfig>;
      controls?: LineControls;
      reveal?: 'always' | 'after-run' | 'never';
      /** The player must finish the order before continuing. */
      mustFinish?: boolean;
    }
  | { kind: 'factory'; missionId: string }
  | {
      kind: 'plan';
      title: string;
      brief: string;
      model: 'aggregate' | 'lotsize';
      data: AggregateData | LotData;
      /** Starting plan: a named rule or explicit quantities. */
      start: 'chase' | 'level' | 'lfl' | 'cap' | 'empty' | number[];
      editable: boolean;
      presets?: Preset[];
      showPar?: boolean;
      /** Graded: submitting ends the level with a cutscene. */
      mission?: boolean;
      inLecture?: string;
    }
  | { kind: 'model'; modelId: string; title: string; body?: string };

export interface Level {
  id: string;
  world: number;
  title: string;
  subtitle: string;
  /** Cutscene when the level is failed through questions. */
  failKind: FailKind;
  /** Build steps; generated levels use the rng. */
  steps: (rng: Rng) => Step[];
  boss?: boolean;
}

export interface World {
  id: number;
  room: string; // asset slug, e.g. 'tasting-lounge'
  name: string;
  topic: string;
  color: string; // css var
  lecture: string;
  levels: Level[];
  /** Short note shown while a world is not built yet. */
  comingSoon?: string;
}
