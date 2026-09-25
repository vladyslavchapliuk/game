import { useEffect, useMemo, useState } from 'react';
import type { CubeCorner, Question } from '../content/types';
import type { QuestionResult } from '../engine/outcome';
import { CUBE_AXES, cornerLabel } from '../content/world1';
import { fmt, stageCapacity } from '../engine/opm';
import { Rich } from './Rich';
import { propSrc } from '../state/assets';
import { useStore } from '../state/store';
import { play } from '../state/sound';
import type { Mood } from '../state/assets';

type Answer = number | boolean | string | number[] | CubeCorner | { tf: boolean | null; reason: number | null };

const parseNumber = (s: string) => {
  const cleaned = s.replace(/[%\s]/g, '').replace(',', '.');
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return NaN;
  return Number(cleaned);
};

const isCorrect = (q: Question, a: Answer | undefined): boolean => {
  if (a === undefined) return false;
  switch (q.type) {
    case 'mc': case 'stage': return a === q.answer;
    case 'numeric': { const v = parseNumber(String(a)); return !Number.isNaN(v) && Math.abs(v - q.answer) <= q.tolerance + 1e-9; }
    case 'classify': return Array.isArray(a) && q.items.every((it, i) => (a as number[])[i] === it.answer);
    case 'cube': return Array.isArray(a) && (a as number[]).every((v, i) => v === q.answer[i]);
    case 'tf': { const x = a as { tf: boolean | null; reason: number | null }; return x.tf === q.answer && x.reason === q.reasonAnswer; }
  }
};

const isComplete = (q: Question, a: Answer | undefined): boolean => {
  if (a === undefined) return false;
  if (q.type === 'numeric') return String(a).trim() !== '';
  if (q.type === 'classify') return Array.isArray(a) && (a as number[]).every((v) => v >= 0);
  if (q.type === 'tf') { const x = a as { tf: boolean | null; reason: number | null }; return x.tf !== null && x.reason !== null; }
  return true;
};

interface Props {
  q: Question;
  onDone: (result: QuestionResult) => void;
  onMood: (m: Mood, line: string) => void;
}

export function QuestionView({ q, onDone, onMood }: Props) {
  const [answer, setAnswer] = useState<Answer | undefined>(() =>
    q.type === 'classify' ? q.items.map(() => -1) : q.type === 'tf' ? { tf: null, reason: null } : q.type === 'cube' ? [0, 0, 0] as CubeCorner : undefined);
  const [tries, setTries] = useState(0);
  const [hints, setHints] = useState(0);
  const [status, setStatus] = useState<'open' | 'right' | 'revealed'>('open');
  const [wrongMsg, setWrongMsg] = useState<string>();

  useEffect(() => { onMood('focused', 'Take your time. Hints are there if you need them; they only cost a star.'); }, [q.id, onMood]);

  const check = () => {
    if (!isComplete(q, answer)) {
      setWrongMsg(q.type === 'numeric' ? 'Enter a number first.' : 'Answer every part first.');
      return;
    }
    if (q.type === 'numeric' && Number.isNaN(parseNumber(String(answer)))) {
      setWrongMsg('Enter a plain number, for example 83.33.');
      return;
    }
    if (isCorrect(q, answer)) {
      play('correct');
      setStatus('right');
      setWrongMsg(undefined);
      onMood('proud', tries === 0 && hints === 0 ? 'First try! Bruno is impressed.' : 'Got it. Onwards!');
      return;
    }
    play('wrong');
    const t = tries + 1;
    setTries(t);
    if (t >= 3) {
      setStatus('revealed');
      onMood('sweaty', 'Here is the worked solution. Read it once more.');
    } else {
      setHints((h) => Math.max(h, t));
      setWrongMsg('Not quite. A hint has been added below.');
      onMood('worried', 'Hmm, not quite. Check the hint.');
    }
  };

  const result: QuestionResult = status === 'revealed' ? 'revealed' : tries === 0 && hints === 0 ? 'first' : 'assisted';
  const locked = status !== 'open';

  return (
    <div className="play-grid">
      <div className="parchment stack">
        {q.inLecture && <span className="in-lecture">In the lecture: <Rich text={q.inLecture} as="span" /></span>}
        <div className="prompt"><Rich text={q.prompt} as="span" /></div>
        <Input q={q} answer={answer} setAnswer={setAnswer} locked={locked} />
      </div>
      <div className="parchment stack">
        <div className="card-label">{status === 'open' ? 'Your answer' : 'Result'}</div>
        {status === 'open' && (
          <>
            {wrongMsg && <div className="feedback bad" role="status"><span className="icon">!</span><div>{wrongMsg}</div></div>}
            <button className="tb gold wide" onClick={check}>Check</button>
            <button className="tb wide" disabled={hints >= 3} onClick={() => { setHints((h) => Math.min(3, h + 1)); play('click'); }}>
              {hints >= 3 ? 'All hints shown' : `Hint · step ${hints + 1} of 3`}
            </button>
            <small className="muted">Hints lower your stars but never block you. After 3 wrong tries you get the worked solution.</small>
          </>
        )}
        {status !== 'open' && (
          <>
            <div className={`feedback ${status === 'right' ? 'ok' : 'bad'}`} role="status">
              <span className="icon">{status === 'right' ? '✓' : '!'}</span>
              <div><b>{status === 'right' ? 'Correct.' : 'Solution'}</b> <Rich text={q.explain} as="span" /></div>
            </div>
            <button className="tb green wide" onClick={() => onDone(result)} autoFocus>Continue</button>
          </>
        )}
        {hints > 0 && (
          <ol className="hint-list" aria-label="Hints">
            {q.hints.slice(0, hints).map((h, i) => (
              <li key={i}><b>{['Nudge', 'Formula', 'First step'][i]}</b><Rich text={h} as="span" /></li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function Input({ q, answer, setAnswer, locked }: { q: Question; answer: Answer | undefined; setAnswer: (a: Answer) => void; locked: boolean }) {
  const { settings } = useStore();
  switch (q.type) {
    case 'mc':
      return (
        <div className="stack" role="radiogroup" aria-label="Options">
          {q.options.map((o, i) => (
            <button key={i} role="radio" aria-checked={answer === i} aria-pressed={answer === i} disabled={locked}
              className={`choice ${locked && i === q.answer ? 'correct' : ''} ${locked && answer === i && i !== q.answer ? 'wrong' : ''}`}
              onClick={() => { setAnswer(i); play('click'); }}>
              <span className="key">{String.fromCharCode(65 + i)}</span><span className="choice-text"><Rich text={o} as="span" /></span>
            </button>
          ))}
        </div>
      );
    case 'numeric':
      return (
        <div className="unit-row">
          <input className={`field ${locked ? 'ok' : ''}`} inputMode="decimal" aria-label={`Answer in ${q.unit}`} value={(answer as string) ?? ''} disabled={locked}
            onChange={(e) => setAnswer(e.target.value)} placeholder="0" />
          <span>{q.unit}</span>
        </div>
      );
    case 'tf': {
      const a = (answer ?? { tf: null, reason: null }) as { tf: boolean | null; reason: number | null };
      return (
        <div className="stack">
          <div className="row" role="radiogroup" aria-label="True or false">
            {[true, false].map((v) => (
              <button key={String(v)} role="radio" aria-checked={a.tf === v} aria-pressed={a.tf === v} disabled={locked} className="choice" style={{ width: 'auto', flex: 1 }}
                onClick={() => setAnswer({ ...a, tf: v })}>
                <span className="key">{v ? 'T' : 'F'}</span>{v ? 'True' : 'False'}
              </button>
            ))}
          </div>
          <div className="card-label">Because…</div>
          <div className="stack" role="radiogroup" aria-label="Reason">
            {q.reasons.map((r, i) => (
              <button key={i} role="radio" aria-checked={a.reason === i} aria-pressed={a.reason === i} disabled={locked}
                className={`choice ${locked && i === q.reasonAnswer ? 'correct' : ''}`} onClick={() => setAnswer({ ...a, reason: i })}>
                <span className="key">{i + 1}</span><span className="choice-text"><Rich text={r} as="span" /></span>
              </button>
            ))}
          </div>
        </div>
      );
    }
    case 'classify': {
      const a = (answer as number[]) ?? [];
      return (
        <div className="classify">
          {q.items.map((it, i) => (
            <div key={i} className={`classify-row ${locked ? (a[i] === it.answer ? 'correct' : 'wrong') : ''}`}>
              <label htmlFor={`${q.id}-${i}`}><Rich text={it.label} as="span" /></label>
              <select id={`${q.id}-${i}`} className="field" value={a[i]} disabled={locked}
                onChange={(e) => { const n = [...a]; n[i] = Number(e.target.value); setAnswer(n); }}>
                <option value={-1}>Choose…</option>
                {q.categories.map((c, ci) => <option key={ci} value={ci}>{c}</option>)}
              </select>
            </div>
          ))}
        </div>
      );
    }
    case 'cube':
      return <CubeInput q={q} value={(answer as CubeCorner) ?? [0, 0, 0]} onChange={setAnswer} locked={locked} />;
    case 'stage':
      return (
        <div>
          <div className="line" role="radiogroup" aria-label="Stations">
            {q.stages.map((s, i) => (
              <button key={i} role="radio" aria-checked={answer === i} aria-pressed={answer === i} disabled={locked}
                className="stage" onClick={() => { setAnswer(i); play('click'); }}>
                {(s.machines ?? 1) > 1 && <span className="machines">×{s.machines}</span>}
                {s.prop && <img src={propSrc(s.prop, settings.soda)} alt="" />}
                <b>{s.name}</b>
                <span className="meta">{fmt(s.minutes)} min / unit</span>
                {q.showRates && <span className="rate">{fmt(stageCapacity(s))}/h</span>}
              </button>
            ))}
          </div>
          <p className="muted">{answer !== undefined ? `Selected: ${q.stages[answer as number].name}` : 'Tap a station to select it.'}</p>
        </div>
      );
  }
}

// Cube: x right = uncertainty, y up = dynamics, depth = heterogeneity. Origin front-bottom-left.
function CubeInput({ q, value, onChange, locked }: { q: Question & { type: 'cube' }; value: CubeCorner; onChange: (c: CubeCorner) => void; locked: boolean }) {
  const P = useMemo(() => {
    const ox = 170, oy = 300, sx = 260, sy = 170, dx = 120, dy = -80;
    return (c: number[]) => [ox + c[0] * sx + c[2] * dx, oy - c[1] * sy + c[2] * dy] as const;
  }, []);
  const corners: CubeCorner[] = [[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,1],[1,0,1],[0,1,1],[1,1,1]];
  const edges: [number[], number[]][] = [];
  for (const a of corners) for (const b of corners) {
    const diff = a.filter((v, i) => v !== b[i]).length;
    if (diff === 1 && a.join() < b.join()) edges.push([a, b]);
  }
  // The three edges meeting at the back-bottom-left corner are behind the cube.
  const hiddenEdge = (a: number[], b: number[]) => [a, b].some((c) => c[0] === 0 && c[1] === 0 && c[2] === 1);
  const same = (a: number[], b: number[]) => a.every((v, i) => v === b[i]);
  return (
    <div className="stack">
      <div className="formula-box" style={{ marginTop: 0 }}><Rich text={`**Scenario:** ${q.scenario}`} as="span" /></div>
      <div className="cube">
        <svg viewBox="0 0 660 370" role="img" aria-label={`Variability cube. Selected corner: ${cornerLabel(value)}.`}>
          {edges.map(([a, b], i) => {
            const [x1, y1] = P(a); const [x2, y2] = P(b);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className={`edge ${hiddenEdge(a, b) ? 'hidden' : ''}`} />;
          })}
          <text x={20} y={128} className="axis-label">Dynamics ↑</text>
          <text x={20} y={148} className="tick">Time-dependent</text>
          <text x={20} y={304} className="tick">Stationary</text>
          <text x={170} y={328} className="tick" textAnchor="middle">Deterministic</text>
          <text x={430} y={328} className="tick" textAnchor="middle">Stochastic</text>
          <text x={300} y={356} className="axis-label" textAnchor="middle">Uncertainty →</text>
          <text x={450} y={22} className="axis-label">Heterogeneity ↗</text>
          <text x={450} y={40} className="tick">back = Heterogeneous</text>
          <text x={20} y={322} className="tick">front = Homogeneous</text>
          {corners.map((c) => {
            const [x, y] = P(c);
            const sel = same(c, value);
            const ans = locked && same(c, q.answer);
            return (
              <circle key={c.join()} cx={x} cy={y} r={sel || ans ? 13 : 10} className={`corner ${ans ? 'answer' : sel ? 'sel' : ''}`}
                role="button" tabIndex={locked ? -1 : 0} aria-label={cornerLabel(c)}
                onClick={() => !locked && onChange(c)} onKeyDown={(e) => { if (!locked && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onChange(c); } }} />
            );
          })}
        </svg>
      </div>
      {CUBE_AXES.map((axis, i) => (
        <div key={axis.key} className="axis-select">
          <label htmlFor={`${q.id}-${axis.key}`}>{axis.name}</label>
          <select id={`${q.id}-${axis.key}`} className="field" disabled={locked} value={value[i]}
            onChange={(e) => { const n = [...value] as CubeCorner; n[i] = Number(e.target.value) as 0 | 1; onChange(n); }}>
            {axis.values.map((v, vi) => <option key={v} value={vi}>{v}</option>)}
          </select>
        </div>
      ))}
      <p className="muted"><b>Selected:</b> {cornerLabel(value)}</p>
    </div>
  );
}
