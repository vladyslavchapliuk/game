import { useCallback, useMemo, useState } from 'react';
import { findLevel } from '../content/worlds';
import type { Step } from '../content/types';
import { makeRng, newSeed } from '../engine/rng';
import { gradeLevel, type StepRecord } from '../engine/outcome';
import { DEFAULT_LINE } from '../engine/line';
import { QuestionView } from '../components/QuestionView';
import { DecisionView } from '../components/DecisionView';
import { ProductionLine } from '../components/production/ProductionLine';
import { Cutscene } from '../components/Cutscene';
import { FactoryPlanner } from '../components/factory/FactoryPlanner';
import { missionById } from '../engine/factory';
import { PlanTable } from '../components/planning/PlanTable';
import { ModelCard } from '../components/ModelCard';
import { MODELS } from '../content/models';
import { chasePlan, levelPlan, lotAtCapacity, lotForLot, type AggregateData, type LotData } from '../engine/planning';
import { Rich, Tex } from '../components/Rich';
import { Mission, RoomBackdrop } from '../components/Chrome';
import { brunoSrc, type Mood } from '../state/assets';
import { useStore } from '../state/store';
import { go } from '../router';

export function LevelScreen({ id }: { id: string }) {
  const found = findLevel(id);
  const { finishLevel, settings, isLevelUnlocked } = useStore();
  const [seed] = useState(newSeed);
  // Keyed by id + seed only, so generated data (and plan arrays) stay stable across renders.
  const steps = useMemo<Step[]>(() => findLevel(id)?.level.steps(makeRng(seed)) ?? [], [id, seed]);
  const [index, setIndex] = useState(0);
  const [records, setRecords] = useState<StepRecord[]>([]);
  const [mood, setMood] = useState<{ m: Mood; line: string }>({ m: 'neutral', line: 'Numbers first. I\'ll show you what changes.' });
  const [lineDone, setLineDone] = useState(false);
  const [cutscene, setCutscene] = useState<ReturnType<typeof gradeLevel> | null>(null);
  const onMood = useCallback((m: Mood, line: string) => setMood({ m, line }), []);

  if (!found) return <div className="page"><div className="parchment">Level not found. <a href="#/map">Back to the map</a></div></div>;
  if (!isLevelUnlocked(id)) {
    return (
      <div className="page">
        <RoomBackdrop room={found.world.room} />
        <Mission kicker={`World ${found.world.id} / ${found.world.topic}`} title="This level is still locked" sub="Pass the previous level first, or turn on practice mode in Settings." />
        <button className="tb" onClick={() => go(`room/${found.world.id}`)}>Back to {found.world.name}</button>
      </div>
    );
  }

  const { world, level } = found;
  const step = steps[index];
  const finish = (recs: StepRecord[]) => {
    const grade = gradeLevel(recs, level.failKind);
    finishLevel({ levelId: level.id, grade, records: recs, seed });
    if (settings.skipCutscenes) go('outcome');
    else setCutscene(grade);
  };
  const next = (rec?: StepRecord) => {
    const recs = rec ? [...records, rec] : records;
    setRecords(recs);
    setLineDone(false);
    if (index + 1 >= steps.length) finish(recs);
    else { setIndex(index + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  };

  const wide = step.kind === 'plan' || step.kind === 'model' || step.kind === 'factory';
  return (
    <div className={`page ${wide ? 'wide' : ''}`}>
      <RoomBackdrop room={world.room} />
      <Mission kicker={`World ${world.id} / ${world.topic} · Level ${level.id}`} title={level.title} sub={level.subtitle} />
      <div className="progress-dots" aria-label={`Step ${index + 1} of ${steps.length}`}>
        {steps.map((_, i) => <i key={i} className={i < index ? 'done' : i === index ? 'now' : ''} />)}
      </div>

      {step.kind === 'learn' && (
        <div className="play-grid">
          <div className="parchment">
            <div className="card-label">Learn card</div>
            {step.inLecture && <span className="in-lecture">In the lecture: <Rich text={step.inLecture} as="span" /></span>}
            <h2><Rich text={step.title} as="span" /></h2>
            <div className="learn-body"><Rich text={step.body} /></div>
            {step.formula && <div className="formula-box"><Tex tex={step.formula} display /></div>}
          </div>
          <div className="parchment stack">
            <Coach mood="neutral" line="Read it once, then let's put it to work." soda={settings.soda} />
            <button className="tb gold wide" onClick={() => next()} autoFocus>Got it, let's go</button>
          </div>
        </div>
      )}

      {step.kind === 'question' && (
        <>
          <QuestionView key={step.q.id} q={step.q} onMood={onMood}
            onDone={(result) => next({ kind: 'question', id: step.q.id, concept: step.q.concept, result })} />
          <div className="parchment" style={{ marginTop: 20 }}><Coach mood={mood.m} line={mood.line} soda={settings.soda} /></div>
        </>
      )}

      {step.kind === 'decision' && (
        <DecisionView key={step.d.id} d={step.d} onCommit={(release, plan, capacity) => {
          const rec: StepRecord = { kind: 'decision', id: step.d.id, concept: step.d.concept, plan, release, demand: step.d.demand, capacity, unit: step.d.unit };
          if (plan.kind !== 'perfect') finish([...records, rec]);
          else next(rec);
        }} />
      )}

      {step.kind === 'line' && (
        <div className="stack">
          <div className="parchment row between">
            <div style={{ flex: 1, minWidth: 260 }}>
              <div className="card-label">Brewhouse floor</div>
              <h2><Rich text={step.title} as="span" /></h2>
              <p className="learn-body"><Rich text={step.brief} as="span" /></p>
            </div>
            <button className="tb gold" disabled={step.mustFinish && !lineDone} onClick={() => next()}>
              {step.mustFinish && !lineDone ? 'Finish the order to continue' : 'Continue'}
            </button>
          </div>
          <ProductionLine key={`${level.id}-${index}`} initial={{ ...DEFAULT_LINE, ...step.config }} controls={step.controls}
            reveal={step.reveal} charts={(step.config.order ?? DEFAULT_LINE.order) > 1} onComplete={() => setLineDone(true)} />
        </div>
      )}

      {step.kind === 'factory' && (
        <FactoryPlanner key={step.missionId} mission={missionById(step.missionId)} onSubmit={(v) => {
          const m = missionById(step.missionId);
          finish([...records, {
            kind: 'factory', id: m.id, concept: 'w7.capacity-planning', outcome: v.outcome, cost: v.stats.cost, best: v.best,
            budget: m.budget, capacity: v.stats.processCapacity, demand: m.demand, unmet: v.unmet, stageCaps: v.stats.stageCaps, idleCapacity: v.idleCapacity,
          }]);
        }} />
      )}

      {step.kind === 'model' && (
        <div className="stack">
          <div className="card row between">
            <div style={{ flex: 1, minWidth: 260 }}>
              <div className="card-label">Lecture model</div>
              <h2><Rich text={step.title} as="span" /></h2>
              {step.body && <div className="learn-body"><Rich text={step.body} /></div>}
            </div>
            <button className="tb gold" onClick={() => next()} autoFocus>Got it, let's go</button>
          </div>
          <ModelCard model={MODELS.find((m) => m.id === step.modelId)!} />
        </div>
      )}

      {step.kind === 'plan' && (
        <div className="stack">
          <div className="card row between">
            <div style={{ flex: 1, minWidth: 260 }}>
              <div className="card-label">{step.mission ? 'Mission · one submission' : 'Planning table'}</div>
              {step.inLecture && <span className="in-lecture">In the lecture: <Rich text={step.inLecture} as="span" /></span>}
              <h2><Rich text={step.title} as="span" /></h2>
              <p className="learn-body"><Rich text={step.brief} as="span" /></p>
            </div>
            {!step.mission && <button className="tb gold" onClick={() => next()}>Continue</button>}
          </div>
          <PlanStep key={`${level.id}-${index}`} step={step} onSubmit={(v) => {
            finish([...records, {
              kind: 'plan', id: `${level.id}-${index}`, concept: step.model === 'aggregate' ? 'w4.planning' : 'w5.planning', model: step.model,
              outcome: v.outcome, cost: v.cost, best: v.best, baseline: v.baseline, baselineName: v.baselineName, shortage: v.shortage, overCap: v.overCap,
            }]);
          }} />
        </div>
      )}

      {cutscene && <Cutscene kind={cutscene.outcome} onDone={() => go('outcome')} />}
    </div>
  );
}

export function Coach({ mood, line, soda }: { mood: Mood; line: string; soda: boolean }) {
  return (
    <div className="coach">
      <div>
        <div className="card-label">Bruno's field note</div>
        <p aria-live="polite">{line}</p>
      </div>
      <img className="bob" src={brunoSrc(mood, soda)} alt={`Bruno looks ${mood}`} />
    </div>
  );
}

function PlanStep({ step, onSubmit }: { step: Extract<Step, { kind: 'plan' }>; onSubmit: (v: import('../engine/planning').PlanVerdict) => void }) {
  const initial = useMemo(() => {
    const st = step.start;
    if (Array.isArray(st)) return st;
    if (st === 'empty') return step.data.demand.map(() => 0);
    if (step.model === 'aggregate') return st === 'level' ? levelPlan(step.data as AggregateData) : chasePlan(step.data as AggregateData);
    return st === 'cap' ? lotAtCapacity(step.data as LotData) : lotForLot(step.data as LotData);
  }, [step]);
  const common = {
    editable: step.editable, presets: step.presets, showPar: step.showPar,
    onSubmit: step.mission ? (v: import('../engine/planning').PlanVerdict) => onSubmit(v) : undefined,
  };
  return step.model === 'aggregate'
    ? <PlanTable model="aggregate" data={step.data as AggregateData} initial={initial} {...common} />
    : <PlanTable model="lotsize" data={step.data as LotData} initial={initial} {...common} />;
}
