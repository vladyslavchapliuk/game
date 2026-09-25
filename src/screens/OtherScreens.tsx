import { useMemo, useState } from 'react';
import { FLASHCARDS, FORMULAS, GLOSSARY } from '../content/reference';
import { WORLDS } from '../content/worlds';
import { Mission, RoomBackdrop } from '../components/Chrome';
import { Rich, Tex } from '../components/Rich';
import { ProductionLine } from '../components/production/ProductionLine';
import { DEFAULT_LINE } from '../engine/line';
import { PlanTable } from '../components/planning/PlanTable';
import { LECTURE_AGGREGATE, LECTURE_LOTS, levelPlan, lotForLot, type AggregateData } from '../engine/planning';
import { FactoryPlanner } from '../components/factory/FactoryPlanner';
import { ModelCard } from '../components/ModelCard';
import { MODELS, SYMBOLS } from '../content/models';
import { useStore, type ThemeSetting } from '../state/store';
import { brunoSrc } from '../state/assets';
import { go } from '../router';

type StudyTab = 'cards' | 'formulas' | 'models' | 'symbols' | 'glossary';
const STUDY_TABS: [StudyTab, string][] = [
  ['formulas', 'Formula sheet'], ['models', 'Models & notation'], ['symbols', 'Symbols'], ['cards', 'Flashcards'], ['glossary', 'Glossary'],
];

export function StudyScreen({ tab: initial }: { tab?: string }) {
  const [tab, setTab] = useState<StudyTab>(STUDY_TABS.some(([k]) => k === initial) ? (initial as StudyTab) : 'formulas');
  const topics = [...new Set(FORMULAS.map((f) => f.topic))];
  return (
    <div className={`page ${tab === 'models' ? 'wide' : ''}`}>
      <RoomBackdrop room="recipe-office" />
      <Mission kicker="Study desk" title="Revise between shifts." sub="Every formula, model and symbol from the OPM 301 slides, in the lecture's notation." />
      <div className="tabs" role="tablist">
        {STUDY_TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className="tb" onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      {tab === 'cards' && <Flashcards />}
      {tab === 'formulas' && (
        <div className="stack">
          {topics.map((topic) => (
            <section key={topic} className="stack">
              <h2 className="section-title">{topic}</h2>
              <div className="formula-list">
                {FORMULAS.filter((f) => f.topic === topic).map((f) => (
                  <div key={f.name} className="card formula-card">
                    <h3>{f.name}</h3>
                    <div className="formula-box"><Tex tex={f.tex} display /></div>
                    <p className="muted"><Rich text={f.note} as="span" /></p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {tab === 'models' && <div className="stack">{MODELS.map((m) => <ModelCard key={m.id} model={m} />)}</div>}
      {tab === 'symbols' && (
        <div className="card">
          <table className="symbol-table">
            <thead><tr><th>Symbol</th><th>Meaning</th><th>Used in</th></tr></thead>
            <tbody>{SYMBOLS.map((r) => <tr key={r.tex}><td><Tex tex={r.tex} /></td><td><Rich text={r.meaning} as="span" /></td><td>{r.where}</td></tr>)}</tbody>
          </table>
        </div>
      )}
      {tab === 'glossary' && <Glossary />}
    </div>
  );
}

function Flashcards() {
  const { progress, reviewCard } = useStore();
  const due = useMemo(() => {
    const now = Date.now();
    return [...FLASHCARDS].sort((a, b) => (progress.cards[a.id]?.due ?? 0) - (progress.cards[b.id]?.due ?? 0)).filter((c) => (progress.cards[c.id]?.due ?? 0) <= now);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  if (i >= due.length) {
    return <div className="parchment"><h2>All caught up.</h2><p>Cards come back after 1, 2, 4, 8 and 16 days, depending on how well you knew them.</p></div>;
  }
  const card = due[i];
  const answer = (r: 'again' | 'hard' | 'good') => { reviewCard(card.id, r); setFlipped(false); setI(i + 1); };
  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <div className="card-label" style={{ color: '#FFF1CD' }}>Card {i + 1} of {due.length} due today</div>
      <button className="parchment flashcard" onClick={() => setFlipped(true)} onKeyDown={(e) => { if (e.key === ' ') { e.preventDefault(); setFlipped(true); } }} aria-live="polite">
        {flipped ? <span className="back"><b><Rich text={card.front} as="span" /></b><br /><br /><Rich text={card.back} as="span" /></span> : <span><Rich text={card.front} as="span" /><br /><small className="muted">Tap or press Space to reveal</small></span>}
      </button>
      {flipped && (
        <div className="row">
          <button className="tb" onClick={() => answer('again')}>Again</button>
          <button className="tb" onClick={() => answer('hard')}>Hard</button>
          <button className="tb green" onClick={() => answer('good')}>Got it</button>
        </div>
      )}
    </div>
  );
}

function Glossary() {
  const [q, setQ] = useState('');
  const list = GLOSSARY.filter((t) => (t.term + t.def).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="parchment glossary stack">
      <label htmlFor="gsearch" className="card-label">Search the glossary</label>
      <div className="row">
        <input id="gsearch" className="field" style={{ fontSize: 18, flex: 1 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. bottleneck" />
        {q && <button className="tb small" onClick={() => setQ('')}>Clear</button>}
      </div>
      {list.length ? (
        <dl>{list.map((t) => <div key={t.term}><dt>{t.term}</dt><dd><Rich text={t.def} as="span" /></dd></div>)}</dl>
      ) : <p>No terms match. <button className="tb small" onClick={() => setQ('')}>Reset</button></p>}
    </div>
  );
}

const SANDBOX_TABS = [
  { id: 'line', label: 'Production line' },
  { id: 'season', label: 'Season planner' },
  { id: 'lots', label: 'Lot sizing' },
] as const;

const hashQuery = () => new URLSearchParams(window.location.hash.split('?')[1] ?? '');

export function SandboxScreen({ tab = 'line' }: { tab?: string }) {
  const current = SANDBOX_TABS.some((t) => t.id === tab) ? tab : 'line';
  const q = hashQuery();
  const hallCap = Number(q.get('c')) || 0;
  const seasonData = useMemo<AggregateData>(() => {
    if (!hallCap) return { ...LECTURE_AGGREGATE };
    // A hall from the Factory Yard: c = daily output, demand follows the lecture's pattern.
    const scale = hallCap / LECTURE_AGGREGATE.c;
    return { ...LECTURE_AGGREGATE, c: hallCap, demand: LECTURE_AGGREGATE.demand.map((d) => Math.round((d * scale) / 10) * 10) };
  }, [hallCap]);
  const seasonStart = useMemo(() => levelPlan(seasonData), [seasonData]);
  const lotStart = useMemo(() => lotForLot(LECTURE_LOTS), []);
  const titles: Record<string, [string, string]> = {
    line: ['What if… we gave Bruno a second fermenter?', 'Change capacities, machines, buffer and order size. Press Try my production.'],
    season: [hallCap ? `Plan a season for your ${hallCap / 8} L/h hall` : 'Plan a season: overtime or inventory?', hallCap ? `Capacity c = ${hallCap} L per period (8 hours × process capacity). Demand follows the lecture's pattern, scaled to your hall.` : 'Edit demand, capacity and costs, then build a plan or reveal the optimal one.'],
    lots: ['Lot sizing lab: setups vs. storage', 'Edit demand, capacity, setup and holding costs. Click Γ_t cells to set brew days.'],
  };
  return (
    <div className="page wide">
      <RoomBackdrop room={current === 'season' ? 'barrel-cellar' : current === 'lots' ? 'kettle-room' : 'brewhouse'} />
      <Mission kicker={`Sandbox / ${SANDBOX_TABS.find((t) => t.id === current)!.label}`} title={titles[current][0]} sub={`${titles[current][1]} Nothing here affects your stars.`} />
      <div className="tabs" role="tablist">
        {SANDBOX_TABS.map((t) => (
          <a key={t.id} role="tab" aria-selected={current === t.id} className="tb" href={`#/sandbox/${t.id}`}>{t.label}</a>
        ))}
      </div>
      {current === 'line' && <ProductionLine initial={{ ...DEFAULT_LINE, order: 8 }} controls={{ caps: true, machines: [0, 1, 2], buffer: true, order: true }} reveal="after-run" />}
      {current === 'season' && <PlanTable key={hallCap} model="aggregate" data={seasonData} initial={seasonStart} editable paramsEditable presets={['chase', 'level', 'optimal', 'clear']} />}
      {current === 'lots' && <PlanTable model="lotsize" data={LECTURE_LOTS} initial={lotStart} editable paramsEditable presets={['lfl', 'cap', 'optimal', 'clear']} />}
    </div>
  );
}

export function MasteryScreen() {
  const { mastery, progress } = useStore();
  return (
    <div className="page">
      <RoomBackdrop room="tasting-lounge" />
      <Mission kicker="My mastery" title="What Bruno's advisor knows." sub="Mastery = share of your last 5 answers per concept that were right first time." />
      <div className="stack">
        {WORLDS.filter((w) => w.levels.length).map((w) => {
          const m = mastery(`w${w.id}.`);
          const concepts = Object.keys(progress.concepts).filter((c) => c.startsWith(`w${w.id}.`));
          return (
            <div key={w.id} className="parchment stack">
              <div className="row between"><h2>{w.name} · {w.topic}</h2><b>{m === undefined ? 'not started' : `${Math.round(m * 100)}%`}</b></div>
              {concepts.map((c) => {
                const v = mastery(c)!;
                return (
                  <div key={c} className="row">
                    <span style={{ width: 200, fontWeight: 700 }}>{c.split('.')[1].replace(/-/g, ' ')}</span>
                    <span className="mastery-bar"><i style={{ width: `${v * 100}%` }} /></span>
                    <b style={{ width: 50, textAlign: 'right' }}>{Math.round(v * 100)}%</b>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Toggle({ label, help, checked, onChange }: { label: string; help: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = label.replace(/\W/g, '');
  return (
    <div className="setting">
      <label htmlFor={id}><b>{label}</b><small>{help}</small></label>
      <span className="switch"><input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span /></span>
    </div>
  );
}

export function SettingsScreen() {
  const { settings, setSetting, resetProgress } = useStore();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="page">
      <RoomBackdrop room="bar-counter" />
      <Mission kicker="Settings" title="Make the brewery yours." />
      <div className="parchment">
        <div className="setting">
          <span><b>Theme</b><small>Sunny brewery, evening pub, or follow your computer.</small></span>
          <div className="seg small" role="group" aria-label="Theme">
            {([['auto', 'Auto'], ['sunny', 'Sunny'], ['evening', 'Evening']] as [ThemeSetting, string][]).map(([v, l]) => (
              <button key={v} className={settings.theme === v ? 'on' : ''} aria-pressed={settings.theme === v} onClick={() => setSetting('theme', v)}>{l}</button>
            ))}
          </div>
        </div>
        <Toggle label="Soda mode" help="Beer becomes lemonade. Numbers, scoring and progress stay identical." checked={settings.soda} onChange={(v) => setSetting('soda', v)} />
        <Toggle label="Sound effects" help="Clinks, cheers and bubbles." checked={settings.sound} onChange={(v) => setSetting('sound', v)} />
        <Toggle label="Reduced motion" help="No paddle, bubble or transfer motion; cutscenes show the final still." checked={settings.reducedMotion} onChange={(v) => setSetting('reducedMotion', v)} />
        <Toggle label="Skip all cutscenes" help="Go straight to the numbers after each level." checked={settings.skipCutscenes} onChange={(v) => setSetting('skipCutscenes', v)} />
        <Toggle label="Practice mode: unlock everything" help="Jump to any level. Stars still count." checked={settings.unlockAll} onChange={(v) => setSetting('unlockAll', v)} />
        <div className="setting">
          <span><b>Reset progress</b><small>Stars, coins, mastery and flashcards on this computer.</small></span>
          {confirm
            ? <span className="row"><button className="tb" onClick={() => setConfirm(false)}>Cancel</button><button className="tb" onClick={() => { resetProgress(); setConfirm(false); }}>Yes, reset</button></span>
            : <button className="tb" onClick={() => setConfirm(true)}>Reset…</button>}
        </div>
      </div>
      <p className="muted" style={{ marginTop: 16, color: '#FFF1CD' }}>Progress is saved in this browser only.</p>
    </div>
  );
}

const SOON: Record<string, { title: string; text: string }> = {
  exam: { title: 'Exam drill', text: 'Timed 90-point mock exams (12 questions, 90 minutes) mixing theory, modeling and calculations. Arrives once worlds 3–6 are in.' },
  duel: { title: 'Duel', text: 'Two players, the same randomized problem, fastest correct answer wins. Arrives with the online features.' },
  room: { title: 'Study room', text: 'Share a six-character room code and solve a case together. Arrives with the online features.' },
  leaderboard: { title: 'Leaderboard', text: 'Opt-in weekly class leaderboard with nicknames. Arrives with the online features.' },
};

export function SoonScreen({ which }: { which: string }) {
  const s = SOON[which] ?? { title: 'Coming soon', text: '' };
  const { settings } = useStore();
  return (
    <div className="page">
      <RoomBackdrop room="barrel-cellar" />
      <Mission kicker="Coming soon" title={s.title} />
      <div className="parchment coach"><div><h2>Bruno is still building this.</h2><p><Rich text={s.text} as="span" /></p></div><img src={brunoSrc('sweaty', settings.soda)} alt="" /></div>
    </div>
  );
}

export function WelcomeScreen() {
  const { setOnboarded, settings } = useStore();
  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <RoomBackdrop room="tasting-lounge" />
      <Mission kicker="Welcome, advisor" title="Bruno needs an operations advisor." sub="Monkey Brewery: OPM 301" />
      <div className="parchment coach">
        <div className="stack">
          <h2>Run the brewery. Learn OPM on the way.</h2>
          <p>Every room of Bruno's brewery is one topic of OPM 301. Play short levels: a learn card, a hands-on brewery task, then exam-style questions.</p>
          <p>Get the numbers right and Bruno ends up on the beach. Brew too much and he "tests" the surplus. Brew too little and the goose hands him a pink slip.</p>
          <div className="row">
            <button className="tb gold" autoFocus onClick={() => { setOnboarded(); go('play/2.1'); }}>Brew your first batch</button>
            <button className="tb" onClick={() => { setOnboarded(); go('map'); }}>Show me the map</button>
          </div>
        </div>
        <img src={`assets/characters/bruno_wave_animated.svg`} alt="Bruno waves hello" onError={(e) => { (e.target as HTMLImageElement).src = brunoSrc('neutral', settings.soda); }} style={{ width: 200 }} />
      </div>
    </div>
  );
}

export function FactoryFreeScreen() {
  return (
    <div className="page wide">
      <RoomBackdrop room="brewhouse" />
      <Mission kicker="Factory Yard / free build" title="Build the brewery of your dreams." sub="No budget. Change the demand, place machines, run the shift, compare." />
      <FactoryPlanner />
    </div>
  );
}
