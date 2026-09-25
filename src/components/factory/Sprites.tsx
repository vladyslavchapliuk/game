// Top-down factory sprites in the Astra v2 style: near-black ink outlines,
// flat fills, one cel-shade tone, one highlight. Each machine is drawn in a
// local box of 80×80 px centred on (0,0). Decorative motion uses `clock`
// (real seconds) so it looks the same at any playback speed.

export const C = {
  ink: '#211B16',
  copper: '#CD803D', copperDark: '#8F4C29', copperLight: '#F0B369',
  wood: '#A0673A', woodDark: '#6B4428', woodLight: '#C99058',
  steel: '#9AA596', steelDark: '#5E6B5E', steelLight: '#D3DBCB',
  mash: '#7A4A22', mashLight: '#A5703A',
  beer: '#E6AC3E', beerLight: '#FFE08A',
  glass: '#B9D3A2', glassDark: '#6E8F5C',
  gold: '#F6C34D', green: '#3F5B32', greenLight: '#6E8F4E', red: '#B23A3F',
  grain: '#E3C06B', grainDark: '#B8913F',
};

const S = { stroke: C.ink, strokeWidth: 3, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

export function Shadow({ rx = 36, ry = 34, dx = 5, dy = 7 }: { rx?: number; ry?: number; dx?: number; dy?: number }) {
  return <ellipse cx={dx} cy={dy} rx={rx} ry={ry} fill="rgba(33,27,22,.22)" />;
}

export function ProgressRing({ r, progress, blocked }: { r: number; progress: number; blocked?: boolean }) {
  const len = 2 * Math.PI * r;
  return (
    <g transform="rotate(-90)">
      <circle r={r} fill="none" stroke="rgba(33,27,22,.25)" strokeWidth={6} />
      <circle r={r} fill="none" stroke={blocked ? C.red : C.gold} strokeWidth={6} strokeLinecap="round"
        strokeDasharray={`${len * Math.max(0.001, Math.min(1, progress))} ${len}`} />
    </g>
  );
}

/** Mash: wooden tub (tier 1) or copper tun (tier 2), paddles turn while mashing. */
export function MashTun({ tier, active, clock }: { tier: 1 | 2; active: boolean; clock: number }) {
  const a = active ? (clock * 140) % 360 : 20;
  if (tier === 1) {
    return (
      <g>
        <Shadow rx={31} ry={31} />
        <circle r={30} fill={C.wood} {...S} />
        {Array.from({ length: 12 }, (_, i) => {
          const ang = (i * 30 * Math.PI) / 180;
          return <line key={i} x1={Math.cos(ang) * 23} y1={Math.sin(ang) * 23} x2={Math.cos(ang) * 29} y2={Math.sin(ang) * 29} stroke={C.woodDark} strokeWidth={2} />;
        })}
        <circle r={27} fill="none" stroke="#6E6A60" strokeWidth={3} />
        <circle r={22} fill={C.mash} {...S} strokeWidth={2.5} />
        <path d="M-15 -8 A17 17 0 0 1 4 -18" fill="none" stroke={C.mashLight} strokeWidth={3} />
        <g transform={`rotate(${a})`}>
          <rect x={-3} y={-24} width={6} height={30} rx={2} fill={C.woodLight} {...S} strokeWidth={2} />
          <rect x={-7} y={2} width={14} height={9} rx={3} fill={C.woodLight} {...S} strokeWidth={2} />
        </g>
      </g>
    );
  }
  return (
    <g>
      <Shadow />
      <circle r={36} fill={C.copper} {...S} />
      <path d="M-36 0 A36 36 0 0 0 36 0 A36 36 0 0 1 -36 0" fill={C.copperDark} opacity={0.35} />
      <circle r={30} fill="none" stroke={C.copperDark} strokeWidth={3} />
      {Array.from({ length: 8 }, (_, i) => {
        const ang = (i * 45 * Math.PI) / 180;
        return <circle key={i} cx={Math.cos(ang) * 33} cy={Math.sin(ang) * 33} r={2.2} fill={C.gold} stroke={C.ink} strokeWidth={1} />;
      })}
      <circle r={26} fill={C.mash} {...S} strokeWidth={2.5} />
      <path d="M-18 -9 A20 20 0 0 1 4 -21" fill="none" stroke={C.mashLight} strokeWidth={3} />
      <g transform={`rotate(${a})`}>
        {[0, 90].map((r) => (
          <rect key={r} transform={`rotate(${r})`} x={-3} y={-24} width={6} height={48} rx={2} fill="#B8883F" {...S} strokeWidth={2} />
        ))}
        <circle r={7} fill="#6E6A60" {...S} strokeWidth={2} />
      </g>
      <rect x={24} y={-40} width={16} height={14} rx={3} fill={C.steelDark} {...S} strokeWidth={2} />
      <circle cx={32} cy={-33} r={3} fill={active ? '#8CE08A' : '#50594F'} />
    </g>
  );
}

/** Ferment: domed tank with a window; bubbles while fermenting; liquid rises with progress. */
export function Fermenter({ tier, active, clock, fill }: { tier: 1 | 2; active: boolean; clock: number; fill: number }) {
  const r = tier === 1 ? 27 : 35;
  const id = `fw${tier}`;
  return (
    <g>
      <Shadow rx={r + 1} ry={r} />
      <defs>
        <radialGradient id={`dome${tier}`} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor={C.copperLight} />
          <stop offset="0.55" stopColor={C.copper} />
          <stop offset="1" stopColor={C.copperDark} />
        </radialGradient>
        <clipPath id={id}><circle r={tier === 1 ? 10 : 13} /></clipPath>
      </defs>
      <circle r={r} fill={`url(#dome${tier})`} {...S} />
      {tier === 2 && <circle r={r - 6} fill="none" stroke={C.copperDark} strokeWidth={3} />}
      {tier === 2 && Array.from({ length: 4 }, (_, i) => (
        <rect key={i} transform={`rotate(${i * 90 + 45}) translate(0 ${-r + 1})`} x={-4} y={-4} width={8} height={8} rx={2} fill={C.steelDark} stroke={C.ink} strokeWidth={1.5} />
      ))}
      <g clipPath={`url(#${id})`}>
        <rect x={-15} y={-15} width={30} height={30} fill="#3A2C20" />
        <rect x={-15} y={15 - 30 * fill} width={30} height={30 * fill} fill={C.beer} />
        {active && [0, 1, 2, 3].map((i) => {
          const ph = (clock * 0.9 + i * 0.27) % 1;
          return <circle key={i} cx={-7 + i * 5} cy={12 - ph * 24} r={1.6 + (i % 2)} fill={C.beerLight} opacity={1 - ph * 0.7} />;
        })}
      </g>
      <circle r={tier === 1 ? 10 : 13} fill="none" {...S} strokeWidth={2.5} />
      <path d={`M${-r * 0.55} ${-r * 0.35} A${r * 0.65} ${r * 0.65} 0 0 1 ${-r * 0.1} ${-r * 0.62}`} fill="none" stroke="#FFE3B0" strokeWidth={3} opacity={0.9} />
      {/* airlock bubbling */}
      <g transform={`translate(${r * 0.55} ${-r * 0.55})`}>
        <circle r={5} fill={C.steelLight} {...S} strokeWidth={2} />
        {active && <circle r={2} cy={-((clock * 2) % 1) * 6} fill="#FFFFFF" opacity={0.9} />}
      </g>
    </g>
  );
}

function BottleTop({ x, y, fill, capped }: { x: number; y: number; fill: number; capped: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={7.5} fill={C.glass} stroke={C.ink} strokeWidth={2} />
      <circle r={5.5 * Math.max(0, Math.min(1, fill))} fill={C.beer} />
      {capped ? <circle r={4} fill={C.gold} stroke={C.ink} strokeWidth={1.5} /> : <circle r={2.5} fill="#2E3A2A" />}
    </g>
  );
}

/** Bottle: hand bottling bench (tier 1) or an automatic carousel (tier 2). */
export function Bottler({ tier, active, clock, fill }: { tier: 1 | 2; active: boolean; clock: number; fill: number }) {
  if (tier === 1) {
    const pump = active ? Math.sin(clock * 8) * 3 : 0;
    return (
      <g>
        <Shadow rx={36} ry={26} dy={8} />
        <rect x={-34} y={-24} width={68} height={48} rx={6} fill={C.wood} {...S} />
        {[-16, -2, 12].map((y) => <line key={y} x1={-32} x2={32} y1={y} y2={y} stroke={C.woodDark} strokeWidth={2} />)}
        <BottleTop x={-18} y={0} fill={1} capped />
        <BottleTop x={0} y={0} fill={active ? fill : 0} capped={fill >= 0.99} />
        <BottleTop x={18} y={0} fill={0} capped={false} />
        <g transform={`translate(0 ${-14 + pump})`}>
          <rect x={-5} y={-8} width={10} height={12} rx={2} fill={C.steelDark} {...S} strokeWidth={2} />
          <line x1={0} y1={-8} x2={16} y2={-16} stroke={C.ink} strokeWidth={3} />
          <circle cx={17} cy={-16} r={3.5} fill={C.red} stroke={C.ink} strokeWidth={1.5} />
        </g>
      </g>
    );
  }
  const spin = active ? (clock * 60) % 360 : 0;
  return (
    <g>
      <Shadow rx={37} ry={34} />
      <rect x={-36} y={-34} width={72} height={68} rx={10} fill={C.steel} {...S} />
      <rect x={-36} y={8} width={72} height={26} rx={8} fill={C.steelDark} opacity={0.35} />
      <circle r={25} fill={C.steelLight} {...S} strokeWidth={2.5} />
      <g transform={`rotate(${spin})`}>
        {Array.from({ length: 6 }, (_, i) => {
          const ang = (i * 60 * Math.PI) / 180;
          return <BottleTop key={i} x={Math.cos(ang) * 16} y={Math.sin(ang) * 16} fill={i === 0 ? fill : i < 3 ? 1 : 0} capped={i > 0 && i < 3} />;
        })}
      </g>
      <circle r={5} fill={C.steelDark} stroke={C.ink} strokeWidth={2} />
      <rect x={20} y={-32} width={14} height={10} rx={2} fill="#2E3A2A" stroke={C.ink} strokeWidth={1.5} />
      <circle cx={27} cy={-27} r={2.6} fill={active ? '#8CE08A' : '#8A3A3A'} />
    </g>
  );
}

export function MachineSprite({ id, active, clock, fill }: { id: string; active: boolean; clock: number; fill: number }) {
  const tier = id.endsWith('2') ? 2 : 1;
  if (id.startsWith('mash')) return <MashTun tier={tier} active={active} clock={clock} />;
  if (id.startsWith('ferm')) return <Fermenter tier={tier} active={active} clock={clock} fill={fill} />;
  return <Bottler tier={tier} active={active} clock={clock} fill={fill} />;
}

/** Items that ride the belts. */
export type ItemKind = 'grain' | 'wort' | 'beer' | 'crate';
export function Item({ kind }: { kind: ItemKind }) {
  switch (kind) {
    case 'grain':
      return (
        <g>
          <path d="M-9 -7 Q0 -12 9 -7 L10 8 Q0 12 -10 8 Z" fill={C.grain} stroke={C.ink} strokeWidth={2} />
          <path d="M-4 -9 L0 -4 L4 -9" fill="none" stroke={C.grainDark} strokeWidth={1.8} />
        </g>
      );
    case 'wort':
      return (
        <g>
          <circle r={9} fill={C.steelLight} stroke={C.ink} strokeWidth={2} />
          <circle r={6} fill={C.mash} />
        </g>
      );
    case 'beer':
      return (
        <g>
          <circle r={9.5} fill={C.copper} stroke={C.ink} strokeWidth={2} />
          <circle r={6} fill="none" stroke={C.copperDark} strokeWidth={2} />
          <circle r={2.5} fill={C.beerLight} />
        </g>
      );
    case 'crate':
      return (
        <g>
          <rect x={-10} y={-10} width={20} height={20} rx={3} fill={C.wood} stroke={C.ink} strokeWidth={2} />
          {[-5, 5].map((x) => [-5, 5].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r={3} fill={C.glass} stroke={C.ink} strokeWidth={1} />))}
        </g>
      );
  }
}

/** A barrel = one buffer place, seen from above. */
export function Barrel({ full }: { full: boolean }) {
  return (
    <g>
      <circle cx={2} cy={3} r={15} fill="rgba(33,27,22,.2)" />
      <circle r={14.5} fill={C.wood} stroke={C.ink} strokeWidth={2.5} />
      <circle r={11} fill="none" stroke="#6E6A60" strokeWidth={2.5} />
      <circle r={7.5} fill={full ? C.copper : C.woodDark} stroke={C.ink} strokeWidth={1.5} />
      {full && <circle r={2.5} fill={C.beerLight} />}
    </g>
  );
}

export function Silo({ waiting }: { waiting: number }) {
  return (
    <g>
      <circle cx={6} cy={8} r={54} fill="rgba(33,27,22,.22)" />
      <circle r={54} fill="#C9B489" stroke={C.ink} strokeWidth={3.5} />
      {Array.from({ length: 12 }, (_, i) => {
        const a0 = (i * 30 * Math.PI) / 180; const a1 = ((i + 1) * 30 * Math.PI) / 180;
        return <path key={i} d={`M0 0 L${Math.cos(a0) * 50} ${Math.sin(a0) * 50} A50 50 0 0 1 ${Math.cos(a1) * 50} ${Math.sin(a1) * 50} Z`} fill={i % 2 ? '#B89E6C' : '#D6C299'} />;
      })}
      <circle r={50} fill="none" stroke={C.ink} strokeWidth={2} />
      <circle r={12} fill="#8C7B55" stroke={C.ink} strokeWidth={2.5} />
      <circle r={5} fill={C.grain} />
      <path d="M-44 -20 A48 48 0 0 1 -20 -44" fill="none" stroke="#F3E6C4" strokeWidth={4} />
      <text y={80} textAnchor="middle" className="fx-label">GRAIN SILO</text>
      {waiting > 0 && (
        <g transform="translate(40 -46)">
          <rect x={-8} y={-14} width={Math.max(34, 18 + String(waiting).length * 10)} height={24} rx={12} fill={C.gold} stroke={C.ink} strokeWidth={2} />
          <text x={9} y={3} className="fx-badge">{waiting}</text>
        </g>
      )}
    </g>
  );
}

export function Truck({ loaded, clock }: { loaded: number; clock: number }) {
  const shown = loaded % 12;
  return (
    <g>
      <rect x={-40} y={-66} width={88} height={146} rx={12} fill="rgba(33,27,22,.2)" transform="translate(5 7)" />
      {/* bed */}
      <rect x={-40} y={-66} width={80} height={110} rx={6} fill={C.woodLight} stroke={C.ink} strokeWidth={3} />
      {[-44, -22, 0, 22].map((y) => <line key={y} x1={-38} x2={38} y1={y} y2={y} stroke={C.woodDark} strokeWidth={2} />)}
      {Array.from({ length: shown }, (_, i) => (
        <g key={i} transform={`translate(${-22 + (i % 3) * 22} ${-50 + Math.floor(i / 3) * 24})`}><Item kind="crate" /></g>
      ))}
      {/* cab */}
      <rect x={-34} y={46} width={68} height={40} rx={10} fill={C.green} stroke={C.ink} strokeWidth={3} />
      <rect x={-26} y={52} width={52} height={14} rx={4} fill="#A9D0E0" stroke={C.ink} strokeWidth={2} />
      <path d="M-20 55 L-8 55" stroke="#FFFFFF" strokeWidth={2.5} opacity={0.8} />
      {[-46, 46].map((x) => <rect key={x} x={x - 5} y={-50} width={10} height={22} rx={3} fill="#2A2622" />)}
      {[-46, 46].map((x) => <rect key={`b${x}`} x={x - 5} y={20} width={10} height={22} rx={3} fill="#2A2622" />)}
      <circle cx={0} cy={-80 + ((clock * 2) % 1) * 0} r={0} />
      <text y={112} textAnchor="middle" className="fx-label">SHIPPING</text>
    </g>
  );
}

export function Tree({ x, y, s = 1, tone = 0 }: { x: number; y: number; s?: number; tone?: number }) {
  const fills = [['#5E8A4A', '#46703A', '#7FAE5E'], ['#6C9650', '#517C3F', '#8EBB69']][tone];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cx={6} cy={8} r={22} fill="rgba(33,27,22,.18)" />
      <circle r={22} fill={fills[1]} stroke={C.ink} strokeWidth={3} />
      <circle cx={-6} cy={-6} r={13} fill={fills[0]} />
      <circle cx={-9} cy={-9} r={5} fill={fills[2]} />
    </g>
  );
}
