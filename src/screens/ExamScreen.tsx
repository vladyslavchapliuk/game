// Exam drill: timed, mixed, one try per question, then a topic report.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EXAM_WORLDS, buildPool, drawExam, type ExamItem } from '../content/exam';
import { makeRng, newSeed } from '../engine/rng';
import type { QuestionResult } from '../engine/outcome';
import { QuestionView } from '../components/QuestionView';
import { Mission, RoomBackdrop } from '../components/Chrome';
import { Rich } from '../components/Rich';
import { useStore } from '../state/store';
import { play } from '../state/sound';

type Phase = 'setup' | 'running' | 'done';
interface Answer { item: ExamItem; ok: boolean; skipped?: boolean }

const SIZES = [10, 20, 30];
const SECONDS_PER_Q = 90;

export function ExamScreen() {
  const { progress, recordExam } = useStore();
  const [phase, setPhase] = useState<Phase>('setup');
  const [worlds, setWorlds] = useState<number[]>(EXAM_WORLDS.map((w) => w.id));
  const [size, setSize] = useState(10);
  const [timed, setTimed] = useState(true);
  const [items, setItems] = useState<ExamItem[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [left, setLeft] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [showCase, setShowCase] = useState(true);

  const start = (ws = worlds, n = size) => {
    const rng = makeRng(newSeed());
    const pool = buildPool(ws, rng);
    const drawn = drawExam(pool, n, rng);
    setItems(drawn);
    setAnswers([]);
    setLeft(drawn.length * SECONDS_PER_Q);
    setStartedAt(Date.now());
    setPhase('running');
    window.scrollTo({ top: 0 });
    play('click');
  };

  const finish = useCallback((final: Answer[]) => {
    const all = [...final, ...items.slice(final.length).map((item) => ({ item, ok: false, skipped: true }))];
    setAnswers(all);
    setPhase('done');
    recordExam(
      { date: Date.now(), score: all.filter((a) => a.ok).length, total: all.length, worlds: [...new Set(all.map((a) => a.item.world))], seconds: Math.round((Date.now() - startedAt) / 1000) },
      all.filter((a) => !a.skipped).map((a) => ({ concept: a.item.q.concept, ok: a.ok })),
    );
    window.scrollTo({ top: 0 });
  }, [items, recordExam, startedAt]);

  useEffect(() => {
    if (phase !== 'running' || !timed) return;
    const id = window.setInterval(() => setLeft((s) => s - 1), 1000);
    return () => window.clearInterval(id);
  }, [phase, timed]);
  useEffect(() => {
    if (phase === 'running' && timed && left <= 0) finish(answers);
  }, [left, phase, timed, answers, finish]);

  const onDone = (result: QuestionResult) => {
    const next = [...answers, { item: items[answers.length], ok: result === 'first' }];
    setAnswers(next);
    setShowCase(true);
    if (next.length >= items.length) finish(next);
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const noop = useCallback(() => {}, []);

  if (phase === 'setup') {
    const history = [...(progress.exams ?? [])].reverse().slice(0, 5);
    return (
      <div className="page">
        <RoomBackdrop room="recipe-office" />
        <Mission kicker="Exam drill" title="A mock exam, straight from the brewery." sub="Mixed questions from every room. One try each, no hints, the clock is running." />
        <div className="parchment stack">
          <div className="card-label">Topics</div>
          <div className="topic-grid">
            {EXAM_WORLDS.map((w) => (
              <label key={w.id} className="check topic-check">
                <input type="checkbox" checked={worlds.includes(w.id)}
                  onChange={(e) => setWorlds((ws) => (e.target.checked ? [...ws, w.id] : ws.filter((x) => x !== w.id)))} />
                <span><b>{w.name}</b><small>{w.topic}</small></span>
              </label>
            ))}
          </div>
          <div className="row between">
            <div className="row">
              <span className="card-label" style={{ margin: 0 }}>Questions</span>
              <div className="seg small" role="group" aria-label="Number of questions">
                {SIZES.map((n) => <button key={n} className={size === n ? 'on' : ''} aria-pressed={size === n} onClick={() => setSize(n)}>{n}</button>)}
              </div>
              <label className="check"><input type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} /> Timed ({Math.round((size * SECONDS_PER_Q) / 60)} min)</label>
            </div>
            <button className="tb gold" disabled={!worlds.length} onClick={() => start()}>Start the exam</button>
          </div>
        </div>
        {history.length > 0 && (
          <div className="parchment stack" style={{ marginTop: 20 }}>
            <div className="card-label">Your last drills</div>
            <table className="mini-table">
              <thead><tr><th>Date</th><th>Score</th><th>Time</th></tr></thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.date}><td>{new Date(h.date).toLocaleString()}</td><td>{h.score} / {h.total} ({Math.round((h.score / h.total) * 100)}%)</td><td>{Math.floor(h.seconds / 60)}:{String(h.seconds % 60).padStart(2, '0')} min</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  if (phase === 'running') {
    const i = answers.length;
    const item = items[i];
    return (
      <div className="page">
        <RoomBackdrop room="recipe-office" />
        <div className="exam-bar parchment row between">
          <b>Question {i + 1} of {items.length}</b>
          <span className="muted">{item.topic} · level {item.levelId}</span>
          {timed && <b className={`exam-clock ${left < 60 ? 'low' : ''}`} aria-live="off">{Math.max(0, Math.floor(left / 60))}:{String(Math.max(0, left % 60)).padStart(2, '0')}</b>}
          <button className="tb small" onClick={() => finish(answers)}>Hand in now</button>
        </div>
        <div className="progress-dots" aria-hidden="true">
          {items.map((_, k) => <i key={k} className={k < i ? 'done' : k === i ? 'now' : ''} />)}
        </div>
        {item.context && (
          <details className="parchment exam-case" open={showCase} onToggle={(e) => setShowCase((e.target as HTMLDetailsElement).open)}>
            <summary><b>The case: <Rich text={item.context.title} as="span" /></b></summary>
            <div className="learn-body"><Rich text={item.context.body} /></div>
          </details>
        )}
        <QuestionView key={`${i}-${item.q.id}`} q={item.q} exam onMood={noop} onDone={onDone} />
      </div>
    );
  }

  return <ExamReport answers={answers} onAgain={(ws) => { setWorlds(ws); start(ws); }} onSetup={() => setPhase('setup')} />;
}

function ExamReport({ answers, onAgain, onSetup }: { answers: Answer[]; onAgain: (worlds: number[]) => void; onSetup: () => void }) {
  const score = answers.filter((a) => a.ok).length;
  const pct = answers.length ? score / answers.length : 0;
  const topics = useMemo(() => {
    const m = new Map<number, { name: string; ok: number; n: number }>();
    for (const a of answers) {
      const w = EXAM_WORLDS.find((x) => x.id === a.item.world)!;
      const t = m.get(w.id) ?? { name: `${w.name} · ${w.topic}`, ok: 0, n: 0 };
      t.n++;
      if (a.ok) t.ok++;
      m.set(w.id, t);
    }
    return [...m.entries()].sort((x, y) => x[1].ok / x[1].n - y[1].ok / y[1].n);
  }, [answers]);
  const weak = topics.filter(([, t]) => t.ok / t.n < 0.7).map(([id]) => id);
  const missed = answers.filter((a) => !a.ok);
  return (
    <div className="page">
      <RoomBackdrop room="recipe-office" />
      <Mission kicker="Exam drill · result" title={pct >= 0.9 ? 'Top marks. Bruno is framing this one.' : pct >= 0.6 ? 'Passed, with a few rough spots.' : 'Not yet. The report shows where to practise.'}
        sub={`${score} of ${answers.length} right (${Math.round(pct * 100)}%)`} />
      <div className="play-grid">
        <div className="parchment stack">
          <div className="card-label">By topic (weakest first)</div>
          {topics.map(([id, t]) => (
            <div key={id} className="row">
              <span style={{ flex: 1, fontWeight: 700 }}>{t.name}</span>
              <span className="mastery-bar"><i style={{ width: `${(t.ok / t.n) * 100}%` }} /></span>
              <b style={{ width: 60, textAlign: 'right' }}>{t.ok}/{t.n}</b>
            </div>
          ))}
        </div>
        <div className="parchment stack">
          <div className="card-label">Next</div>
          {weak.length > 0 && <button className="tb gold wide" onClick={() => onAgain(weak)}>Drill my weak topics</button>}
          <button className="tb wide" onClick={() => onAgain(topics.map(([id]) => id))}>Same topics, new questions</button>
          <button className="tb wide" onClick={onSetup}>Change the setup</button>
        </div>
      </div>
      {missed.length > 0 && (
        <div className="stack" style={{ marginTop: 20 }}>
          <h2 className="section-title">Review what you missed</h2>
          {missed.map((a, k) => (
            <div key={k} className="parchment stack">
              <div className="card-label">{a.item.topic} · level {a.item.levelId}{a.skipped ? ' · not answered' : ''}</div>
              <div className="prompt"><Rich text={a.item.q.prompt} as="span" /></div>
              <div className="feedback bad"><span className="icon">!</span><div><b>Solution</b> <Rich text={a.item.q.explain} as="span" /></div></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
