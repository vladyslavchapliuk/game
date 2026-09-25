import type { Level, World } from './types';
import { world1 } from './world1';
import { world2 } from './world2';
import { world3 } from './world3';
import { world4 } from './world4';
import { world5 } from './world5';
import { world6 } from './world6';
import { world7 } from './world7';

export const WORLDS: World[] = [
  world1,
  world2,
  world3,
  world4,
  world5,
  world6,
  world7,
];

export const findLevel = (id: string): { world: World; level: Level; index: number } | undefined => {
  for (const world of WORLDS) {
    const index = world.levels.findIndex((l) => l.id === id);
    if (index >= 0) return { world, level: world.levels[index], index };
  }
  return undefined;
};

export const nextLevelId = (id: string): string | undefined => {
  const found = findLevel(id);
  if (!found) return undefined;
  const { world, index } = found;
  if (index + 1 < world.levels.length) return world.levels[index + 1].id;
  const nextWorld = WORLDS.find((w) => w.id === world.id + 1);
  return nextWorld?.levels[0]?.id;
};

export const isLevelPlayable = (id: string) => !!findLevel(id);
