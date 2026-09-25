// Asset paths with theme and soda-mode swaps (specs/soda-mode-swaps.json).
const BASE = 'assets';

export const roomSrc = (slug: string, theme: 'sunny' | 'evening', soda: boolean) =>
  `${BASE}/rooms/room_${slug}${theme === 'evening' ? '_dark' : ''}${soda ? '_soda' : ''}.svg`;

export const mapSrc = (theme: 'sunny' | 'evening') => `${BASE}/rooms/map_brewery${theme === 'evening' ? '_dark' : ''}.svg`;

export type Mood = 'neutral' | 'focused' | 'worried' | 'sweaty' | 'proud' | 'tipsy' | 'fired' | 'beach-rich';
export const brunoSrc = (mood: Mood | string, soda: boolean) =>
  soda && mood === 'tipsy' ? `${BASE}/characters/bruno_soda_mood_bubbly.svg` : `${BASE}/characters/bruno_mood_${mood}.svg`;

const SODA_PROPS = new Set(['bottle', 'tap', 'barrel', 'mug', 'cocktail']);
export const propSrc = (name: string, soda: boolean) =>
  `${BASE}/props/prop_${name}${soda && SODA_PROPS.has(name) ? '_soda' : ''}.svg`;

export const iconSrc = (name: string) => `${BASE}/icons/icon_${name}.svg`;

export const storyboardSrc = (kind: string, frame: number) =>
  `${BASE}/storyboards/${kind}/storyboard_${kind}_0${frame + 1}.svg`;

// Soda mode copy swaps. Mechanics and numbers stay identical.
const SWAPS: [RegExp, string][] = [
  [/\bbeers\b/gi, 'lemonades'],
  [/\bbeer\b/gi, 'lemonade'],
  [/\bbrewery\b/gi, 'lemonade works'],
  [/\bwort\b/gi, 'lemon concentrate'],
  [/\bfermentation\b/gi, 'chilling'],
  [/\btipsy\b/gi, 'bubbly'],
  [/\b(lager|IPA|stout)\b/gi, 'lemonade'],
];
export const sodaText = (text: string, soda: boolean) =>
  !soda ? text : SWAPS.reduce((t, [re, to]) => t.replace(re, (m) => (m[0] === m[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to)), text);
