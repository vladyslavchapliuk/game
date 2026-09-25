import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Grade, StepRecord } from '../engine/outcome';
import { coinsFor } from '../engine/outcome';
import { WORLDS } from '../content/worlds';

export type ThemeSetting = 'auto' | 'sunny' | 'evening';
export interface Settings {
  theme: ThemeSetting;
  soda: boolean;
  sound: boolean;
  reducedMotion: boolean;
  skipCutscenes: boolean;
  unlockAll: boolean;
}
export interface LevelProgress { stars: number; passed: boolean; plays: number }
export interface CardState { box: number; due: number }
export interface Progress {
  levels: Record<string, LevelProgress>;
  coins: number;
  /** Last 5 first-try results per concept. */
  concepts: Record<string, boolean[]>;
  cards: Record<string, CardState>;
  onboarded: boolean;
}
export interface LastRun { levelId: string; grade: Grade; records: StepRecord[]; coins: number; seed: number }

const DEFAULT_SETTINGS: Settings = { theme: 'auto', soda: false, sound: true, reducedMotion: false, skipCutscenes: false, unlockAll: false };
const EMPTY: Progress = { levels: {}, coins: 0, concepts: {}, cards: {}, onboarded: false };
const KEY = 'monkey-brewery/v1';

// Storage can be unavailable (private windows, blocked site data): never crash.
const load = (): { settings: Settings; progress: Progress } => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return { settings: { ...DEFAULT_SETTINGS, ...data.settings }, progress: { ...EMPTY, ...data.progress } };
    }
  } catch { /* ignore */ }
  return { settings: DEFAULT_SETTINGS, progress: EMPTY };
};

interface Store {
  settings: Settings;
  progress: Progress;
  lastRun?: LastRun;
  resolvedTheme: 'sunny' | 'evening';
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  finishLevel: (run: Omit<LastRun, 'coins'>) => LastRun;
  isLevelUnlocked: (id: string) => boolean;
  isWorldUnlocked: (worldId: number) => boolean;
  mastery: (conceptPrefix: string) => number | undefined;
  reviewCard: (id: string, ok: 'again' | 'hard' | 'good') => void;
  setOnboarded: () => void;
  resetProgress: () => void;
  totalStars: number;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(load, []);
  const [settings, setSettings] = useState<Settings>(initial.settings);
  const [progress, setProgress] = useState<Progress>(initial.progress);
  const [lastRun, setLastRun] = useState<LastRun>();
  const [prefersDark, setPrefersDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const fn = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ settings, progress })); } catch { /* ignore */ }
  }, [settings, progress]);

  const resolvedTheme = settings.theme === 'auto' ? (prefersDark ? 'evening' : 'sunny') : settings.theme;
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme === 'evening' ? 'evening-pub' : 'sunny-brewery';
    document.documentElement.dataset.motion = settings.reducedMotion ? 'reduced' : 'full';
  }, [resolvedTheme, settings.reducedMotion]);

  const setSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
  }, []);

  const finishLevel = useCallback((run: Omit<LastRun, 'coins'>): LastRun => {
    const coins = coinsFor(run.grade);
    setProgress((p) => {
      const prev = p.levels[run.levelId] ?? { stars: 0, passed: false, plays: 0 };
      const concepts = { ...p.concepts };
      for (const r of run.records) {
        const ok = r.kind === 'question' ? r.result === 'first' : r.kind === 'decision' ? r.plan.kind === 'perfect' : r.outcome === 'perfect';
        concepts[r.concept] = [...(concepts[r.concept] ?? []), ok].slice(-5);
      }
      return {
        ...p,
        coins: p.coins + coins,
        concepts,
        levels: {
          ...p.levels,
          [run.levelId]: { stars: Math.max(prev.stars, run.grade.stars), passed: prev.passed || run.grade.passed, plays: prev.plays + 1 },
        },
      };
    });
    const full = { ...run, coins };
    setLastRun(full);
    return full;
  }, []);

  const isWorldUnlocked = useCallback((worldId: number) => {
    // Independent entry points: basics (1), planning over time (4) and the Factory Yard (7).
    if (settings.unlockAll || worldId === 1 || worldId === 4 || worldId === 7) return true;
    const prev = WORLDS.find((w) => w.id === worldId - 1);
    if (!prev || prev.levels.length === 0) return false;
    return !!progress.levels[prev.levels[prev.levels.length - 1].id]?.passed;
  }, [settings.unlockAll, progress.levels]);

  const isLevelUnlocked = useCallback((id: string) => {
    if (settings.unlockAll) return true;
    for (const w of WORLDS) {
      const i = w.levels.findIndex((l) => l.id === id);
      if (i < 0) continue;
      if (!isWorldUnlocked(w.id)) return false;
      return i === 0 || !!progress.levels[w.levels[i - 1].id]?.passed;
    }
    return false;
  }, [settings.unlockAll, progress.levels, isWorldUnlocked]);

  const mastery = useCallback((prefix: string) => {
    const all = Object.entries(progress.concepts).filter(([k]) => k.startsWith(prefix)).flatMap(([, v]) => v);
    if (all.length === 0) return undefined;
    return all.filter(Boolean).length / all.length;
  }, [progress.concepts]);

  const reviewCard = useCallback((id: string, ok: 'again' | 'hard' | 'good') => {
    setProgress((p) => {
      const c = p.cards[id] ?? { box: 0, due: 0 };
      const box = ok === 'again' ? 0 : ok === 'hard' ? Math.max(1, c.box) : Math.min(5, c.box + 1);
      const days = [0, 1, 2, 4, 8, 16][box];
      return { ...p, cards: { ...p.cards, [id]: { box, due: Date.now() + days * 86_400_000 } } };
    });
  }, []);

  const totalStars = Object.values(progress.levels).reduce((s, l) => s + l.stars, 0);

  const value: Store = {
    settings, progress, lastRun, resolvedTheme, setSetting, finishLevel, isLevelUnlocked, isWorldUnlocked, mastery, reviewCard,
    setOnboarded: () => setProgress((p) => ({ ...p, onboarded: true })),
    resetProgress: () => { setProgress({ ...EMPTY, onboarded: true }); setLastRun(undefined); },
    totalStars,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useStore = (): Store => {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
};
