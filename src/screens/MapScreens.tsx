import { WORLDS } from '../content/worlds';
import { iconSrc, mapSrc } from '../state/assets';
import { useStore } from '../state/store';
import { href } from '../router';
import { Mission, RoomBackdrop } from '../components/Chrome';
import { Stars } from '../components/Rich';

// Building positions in the 1440x900 map art (translate of each room group + door offset).
const NODES: Record<string, [number, number]> = {
  'tasting-lounge': [86, 157], brewhouse: [532, 172], 'recipe-office': [980, 154],
  'bar-counter': [86, 489], 'kettle-room': [527, 508], 'barrel-cellar': [985, 486],
};

export function MapScreen() {
  const { resolvedTheme, progress, isWorldUnlocked } = useStore();
  const cleared = WORLDS.filter((w) => w.levels.length && w.levels.every((l) => progress.levels[l.id]?.passed)).length;
  return (
    <div className="page" style={{ maxWidth: 1400, paddingTop: 0 }}>
      <div className="backdrop" aria-hidden="true" />
      <h1 className="sr-only">Brewery map</h1>
      <div className="map-wrap">
        <img src={mapSrc(resolvedTheme)} alt="" />
        <div className="plank festival">FESTIVAL WEEKEND · {cleared} / 6</div>
        <a className="plank green map-banner factory-banner" href={href('room/7')}>
          <span className="new-tag">NEW</span><b>FACTORY YARD</b><small>Build &amp; plan your production hall →</small>
        </a>
        {WORLDS.filter((w) => NODES[w.room] && w.id <= 6).map((w) => {
          const [tx, ty] = NODES[w.room];
          const unlocked = isWorldUnlocked(w.id) && w.levels.length > 0;
          const stars = w.levels.reduce((s, l) => s + (progress.levels[l.id]?.stars ?? 0), 0);
          const done = w.levels.length > 0 && w.levels.every((l) => progress.levels[l.id]?.passed);
          const started = w.levels.some((l) => progress.levels[l.id]);
          const status = !w.levels.length ? 'COMING SOON' : !unlocked ? `LOCKED · FINISH ROOM ${w.id - 1}` : done ? `${stars}★ COMPLETE` : started ? 'CONTINUE →' : 'PLAY NEXT →';
          const style = { left: `${((tx + 127) / 1440) * 100}%`, top: `${((ty + 262) / 900) * 100}%` };
          const inner = (
            <>
              <span className={`medal ${unlocked ? '' : 'locked'}`}>{unlocked ? w.id : <img src={iconSrc('lock')} alt="" />}</span>
              <span className="plank map-plaque"><b>{w.name}</b><small>{status}</small></span>
            </>
          );
          return unlocked
            ? <a key={w.id} className="map-node" style={style} href={href(`room/${w.id}`)} aria-label={`${w.name}, ${w.topic}. ${status}`}>{inner}</a>
            : <div key={w.id} className="map-node" style={style} aria-label={`${w.name}, ${w.topic}. ${status}`}>{inner}</div>;
        })}
      </div>
    </div>
  );
}

export function RoomScreen({ worldId }: { worldId: number }) {
  const w = WORLDS.find((x) => x.id === worldId);
  const { progress, isLevelUnlocked } = useStore();
  if (!w) return null;
  return (
    <div className="page">
      <RoomBackdrop room={w.room} />
      <Mission kicker={`World ${w.id} / ${w.topic}`} title={w.name} sub={`${w.lecture} · ${w.levels.length} levels`} />
      {w.comingSoon && <div className="parchment"><h2>Coming soon</h2><p>{w.comingSoon}</p></div>}
      {w.id === 7 && (
        <a className="parchment level-row" href={href('factory')} style={{ marginBottom: 12 }}>
          <span className="medal">∞</span>
          <span><h3>Free build</h3><p>No budget, any demand. Try ideas and watch the hall run.</p></span>
          <span className="tb small green">Build</span>
        </a>
      )}
      <div className="levels">
        {w.levels.map((l) => {
          const p = progress.levels[l.id];
          const open = isLevelUnlocked(l.id);
          const body = (
            <>
              <span className={`medal ${open ? '' : 'locked'}`}>{open ? l.id.split('.')[1] : <img src={iconSrc('lock')} alt="" />}</span>
              <span>
                <h3>{l.title}</h3>
                <p>{l.subtitle}{open ? '' : ' · pass the previous level to unlock'}</p>
              </span>
              <span>{p ? <Stars n={p.stars} /> : open ? <span className="tb small green">Play</span> : null}</span>
            </>
          );
          return open
            ? <a key={l.id} className="parchment level-row" href={href(`play/${l.id}`)}>{body}</a>
            : <div key={l.id} className="parchment level-row" data-locked="true">{body}</div>;
        })}
      </div>
    </div>
  );
}
