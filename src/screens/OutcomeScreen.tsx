import { useState } from 'react';
import { useStore } from '../state/store';
import { findLevel, nextLevelId } from '../content/worlds';
import { CUTSCENES, OUTCOME_LABEL } from '../content/cutscenes';
import { brunoSrc, sodaText } from '../state/assets';
import { fmt } from '../engine/opm';
import { Mission, RoomBackdrop } from '../components/Chrome';
import { Cutscene } from '../components/Cutscene';
import { Rich, Stars } from '../components/Rich';
import { go } from '../router';

export function OutcomeScreen() {
  const { lastRun, settings, mastery } = useStore();
  const [replay, setReplay] = useState(false);
  if (!lastRun) {
    return <div className="page"><div className="parchment">No finished shift yet. <a href="#/map">Go to the brewery</a></div></div>;
  }
  const found = findLevel(lastRun.levelId)!;
  const { grade } = lastRun;
  const script = CUTSCENES[grade.outcome];
  const next = nextLevelId(lastRun.levelId);
  const worldPrefix = `w${found.world.id}.`;
  const m = mastery(worldPrefix);

  const rows: [string, string][] = [];
  let headline = '';
  let advice = '';
  const d = grade.failedDecision;
  const f = grade.factory;
  const pl = grade.plan;
  const eurs = (x: number) => `${Math.round(x).toLocaleString('en-US')} EUR`;
  if (pl) {
    rows.push(['Your relevant costs', eurs(pl.cost)]);
    rows.push([`Best simple rule (${pl.baselineName})`, eurs(pl.baseline)]);
    rows.push(['Cheapest possible plan (par)', eurs(pl.best)]);
    if (pl.outcome === 'bottleneck-fail') {
      headline = 'A lot bigger than the kettle can brew.';
      rows.push(['Units above capacity c', `${pl.overCap}`]);
      advice = 'Every X_t must satisfy X_t ≤ c. Split the big lot and add a setup earlier.';
    } else if (pl.outcome === 'too-little') {
      headline = 'Demand was not met in time.';
      rows.push(['Units of demand not met', `${pl.shortage}`]);
      advice = pl.model === 'aggregate'
        ? 'Check the inventory row: L_t must never go negative (and B_T = 0 with backlog). Produce earlier or use overtime.'
        : 'Each period must be covered by stock or a new lot. Look for red inventory cells.';
    } else if (pl.outcome === 'too-much') {
      headline = 'Feasible, but more expensive than a simple rule.';
      rows.push(['Extra cost vs. par', eurs(pl.cost - pl.best)]);
      advice = pl.model === 'aggregate'
        ? 'Compare holding one unit ($k^l$ per period) with one unit of overtime ($k^o$). Pre-produce only when it is cheaper.'
        : 'A setup pays off only if it saves more holding cost than s. Merge small lots, split huge ones.';
    } else if (pl.outcome === 'good-enough') {
      headline = 'You beat the simple rules.';
      rows.push(['Gap to par', eurs(pl.cost - pl.best)]);
      advice = 'Close the gap to par for three stars.';
    } else {
      headline = 'The cheapest possible plan. Textbook.';
      advice = pl.model === 'aggregate' ? 'You traded overtime against inventory perfectly.' : 'Setups and holding perfectly balanced.';
    }
  } else if (f) {
    rows.push(['Demand', `${f.demand} L/h`]);
    rows.push(['Stage capacities (mash, ferment, bottle)', `${f.stageCaps.join(' / ')} L/h`]);
    rows.push(['Process capacity', `min(${f.stageCaps.join(', ')}) = ${f.capacity} L/h`]);
    rows.push(['Your equipment cost', `€${f.cost}`]);
    if (f.outcome === 'too-little') {
      headline = 'The hall could not keep up with demand.';
      rows.push(['Unmet demand', `${f.demand} − ${f.capacity} = ${f.unmet} L/h`]);
      advice = 'Find the stage below the demand line in the capacity chart and add capacity exactly there.';
    } else {
      rows.push(['Cheapest plan that meets demand', `€${f.best}`]);
      rows.push(['Capacity above demand (all stages)', `${f.idleCapacity} L/h idle`]);
      if (f.outcome === 'too-much') {
        headline = 'Overbuilt: Bruno paid for machines that mostly stand idle.';
        advice = `You spent €${f.cost - f.best} more than needed. Compare € per L/h, and use every slot wisely.`;
      } else if (f.outcome === 'good-enough') {
        headline = 'Demand met, with a bit of extra spending.';
        advice = `A plan €${f.cost - f.best} cheaper exists. Try mixing machine sizes.`;
      } else {
        headline = 'Demand met at the lowest possible cost.';
        advice = 'Every stage covers demand, and no cheaper mix exists. That is capacity planning done right.';
      }
    }
  } else if (d) {
    const unit = d.unit;
    rows.push(['Your release rate', `${fmt(d.release)} ${unit}`]);
    rows.push(['Process capacity', `${fmt(d.capacity)} ${unit}`]);
    rows.push(['Demand', `${fmt(d.demand)} ${unit}`]);
    rows.push(['Right plan', `min(${fmt(d.demand)}, ${fmt(d.capacity)}) = ${fmt(d.plan.target)} ${unit}`]);
    if (d.plan.kind === 'bottleneck-fail') {
      headline = 'The bottleneck could not keep up.';
      rows.push(['Work piling up before the bottleneck', `${fmt(d.release)} − ${fmt(d.capacity)} = ${fmt(d.plan.wipGrowth)} ${unit}`]);
      advice = 'Never release more than the process capacity: the extra work only waits in front of the bottleneck.';
    } else if (d.plan.kind === 'too-much') {
      headline = 'More beer than anyone ordered.';
      rows.push(['Surplus going to stock', `${fmt(d.release)} − ${fmt(d.demand)} = ${fmt(d.plan.surplus)} ${unit}`]);
      advice = 'Demand-constrained: brew what guests order, not what the line could do.';
    } else if (d.plan.kind === 'too-little') {
      headline = 'Guests went home thirsty.';
      rows.push(['Shortfall you could have avoided', `${fmt(d.plan.target)} − ${fmt(d.release)} = ${fmt(d.plan.shortfall)} ${unit}`]);
      advice = 'Throughput = min(demand, process capacity). Aim exactly there.';
    }
  } else {
    headline = grade.passed ? (grade.stars === 3 ? 'Every answer right, first time.' : 'Shift done, lessons learned.') : 'Too many answers needed the solution.';
    rows.push(['Questions right first time', `${grade.firstTry} / ${grade.total}`]);
    rows.push(['Solutions revealed', `${grade.revealed}`]);
    rows.push(['Allowed to pass', `≤ ${Math.floor(grade.total / 3)} revealed`]);
    advice = grade.passed
      ? grade.stars < 3 ? 'Replay without hints for three stars.' : 'Perfect. On to the next level.'
      : 'Read the learn card again and retry. New numbers every time.';
  }

  return (
    <div className="page">
      <RoomBackdrop room={found.world.room} />
      <Mission kicker={`Outcome / ${OUTCOME_LABEL[grade.outcome].replace('!', '')}`} title={script.headline} sub={`Level ${found.level.id} · ${found.level.title}`} />
      <div className="outcome-grid">
        <div className="parchment reward">
          <h2>{OUTCOME_LABEL[grade.outcome]}</h2>
          <img src={brunoSrc(script.mood, settings.soda)} alt={`Bruno: ${script.mood}`} />
          <Stars n={grade.stars} />
          <b>+ {lastRun.coins} coins</b>
          <button className="tb wide" onClick={() => setReplay(true)}>Replay cutscene</button>
        </div>
        <div className="stack">
          <div className="parchment happened">
            <div className="card-label">What happened? / Numbers explain the story</div>
            <h2>{sodaText(headline, settings.soda)}</h2>
            <table><tbody>{rows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody></table>
            <p className="muted" style={{ marginTop: 12 }}><Rich text={advice} as="span" /></p>
          </div>
          {m !== undefined && (
            <div className="parchment row">
              <b>{found.world.topic} mastery</b>
              <span className="mastery-bar"><i style={{ width: `${m * 100}%` }} /></span>
              <b>{Math.round(m * 100)}%</b>
            </div>
          )}
          <div className="row">
            {next && <button className={grade.passed ? 'tb green' : 'tb'} onClick={() => go(`play/${next}`)} autoFocus={grade.passed}>Next level</button>}
            <button className="tb" onClick={() => go(`play/${lastRun.levelId}?r=${Date.now()}`)}>Try again</button>
            <button className="tb" onClick={() => go(`room/${found.world.id}`)}>Room</button>
            <button className="tb" onClick={() => go('map')}>Map</button>
          </div>
        </div>
      </div>
      {replay && <Cutscene kind={grade.outcome} onDone={() => setReplay(false)} />}
    </div>
  );
}
