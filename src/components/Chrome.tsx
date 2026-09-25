import { useEffect, useState } from 'react';
import { brunoSrc, iconSrc, roomSrc, sodaText } from '../state/assets';
import { useStore } from '../state/store';
import { href } from '../router';
import { setSoundEnabled } from '../state/sound';
import { WORLDS } from '../content/worlds';

// Main navigation lives in the top bar, so nothing floats over the game.
const NAV = [
  { path: 'map', label: 'Brewery', icon: 'map', match: ['map', 'room', 'play', 'outcome'] },
  { path: 'room/7', label: 'Factory Yard', icon: 'gear', match: ['room/7', 'factory'] },
  { path: 'study', label: 'Study desk', icon: 'book', match: ['study'] },
  { path: 'sandbox', label: 'Sandbox', icon: 'flask', match: ['sandbox'] },
];
const MORE = [
  { path: 'mastery', label: 'My mastery' },
  { path: 'exam', label: 'Exam drill' },
  { path: 'soon/duel', label: 'Duel' },
  { path: 'soon/room', label: 'Study room' },
  { path: 'soon/leaderboard', label: 'Leaderboard' },
  { path: 'settings', label: 'Settings' },
];

const isActive = (route: string, match: string[]) => {
  const inFactory = route.startsWith('room/7') || route.startsWith('factory') || route.startsWith('play/7.');
  if (match.includes('room/7')) return inFactory;
  return !inFactory && match.some((m) => route === m || route.startsWith(`${m}/`) || route.split('/')[0] === m);
};

export function Hud({ route }: { route: string }) {
  const { progress, totalStars, settings, setSetting } = useStore();
  const [menu, setMenu] = useState(false);
  useEffect(() => setSoundEnabled(settings.sound), [settings.sound]);
  useEffect(() => setMenu(false), [route]);
  const levelsPassed = Object.values(progress.levels).filter((l) => l.passed).length;
  const totalLevels = WORLDS.reduce((s, w) => s + w.levels.length, 0);
  const lv = 1 + Math.floor(levelsPassed / 2);
  const xp = ((levelsPassed % 2) / 2) * 100 + 8;

  return (
    <>
      <header className="topbar">
        <a className="brand" href={href('map')} aria-label="Monkey Brewery, back to the map">
          <span className="avatar"><img src={brunoSrc('neutral', settings.soda)} alt="" /></span>
          <span className="brand-text">
            <b>{sodaText('Monkey Brewery', settings.soda)}</b>
            <small>OPM 301 · Advisor Lv. {lv} · {levelsPassed}/{totalLevels}</small>
            <span className="xp" aria-hidden="true"><i style={{ width: `${xp}%` }} /></span>
          </span>
        </a>
        <nav className="nav" aria-label="Main">
          {NAV.map((n) => (
            <a key={n.path} href={href(n.path)} className="nav-tab" aria-current={isActive(route, n.match) ? 'page' : undefined}>
              <img src={iconSrc(n.icon)} alt="" />{n.label}
            </a>
          ))}
          <button className="nav-tab" onClick={() => setMenu(true)} aria-expanded={menu}>More ▾</button>
        </nav>
        <div className="hud-right">
          <span className="chip" aria-label={`${progress.coins} coins`}><img src={iconSrc('coin')} alt="" />{progress.coins}</span>
          <span className="chip" aria-label={`${totalStars} stars`}><img src={iconSrc('star')} alt="" />{totalStars}</span>
          <button className="icon-btn" onClick={() => setSetting('sound', !settings.sound)} aria-pressed={!settings.sound} aria-label={settings.sound ? 'Mute sound' : 'Unmute sound'} title={settings.sound ? 'Mute' : 'Unmute'}>
            <img src={iconSrc('mute')} alt="" style={{ opacity: settings.sound ? 1 : 0.45 }} />
          </button>
          <button className="icon-btn menu-only" onClick={() => setMenu(true)} aria-label="Open menu" aria-expanded={menu}>
            <img src={iconSrc('pause')} alt="" />
          </button>
        </div>
      </header>
      {menu && (
        <>
          <div className="drawer-scrim" onClick={() => setMenu(false)} />
          <nav className="drawer" aria-label="Menu" onKeyDown={(e) => e.key === 'Escape' && setMenu(false)}>
            <h2>Menu</h2>
            {[...NAV, ...MORE].map((d) => (
              <a key={d.path} className="drawer-link" href={href(d.path)} aria-current={route === d.path ? 'page' : undefined}>{d.label}</a>
            ))}
            <button className="tb gold wide" onClick={() => setMenu(false)} autoFocus>Close</button>
          </nav>
        </>
      )}
    </>
  );
}

export function Mission({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  const { settings } = useStore();
  return (
    <section className="mission">
      <div className="kicker">{kicker}</div>
      <h1>{sodaText(title, settings.soda)}</h1>
      {sub && <p>{sodaText(sub, settings.soda)}</p>}
    </section>
  );
}

export function RoomBackdrop({ room }: { room: string }) {
  const { resolvedTheme, settings } = useStore();
  return <div className="backdrop" aria-hidden="true"><img src={roomSrc(room, resolvedTheme, settings.soda)} alt="" /></div>;
}
