import type { Level, World } from './types';
import { world1 } from './world1';
import { world2 } from './world2';
import { world4 } from './world4';
import { world5 } from './world5';
import { world7 } from './world7';

const soon = (id: number, room: string, name: string, topic: string, lecture: string, note: string): World => ({
  id, room, name, topic, color: `var(--room-${id})`, lecture, levels: [], comingSoon: note,
});

export const WORLDS: World[] = [
  world1,
  world2,
  soon(3, 'recipe-office', 'Recipe Office', 'Optimization Modeling', 'Lecture II · ch. 3',
    'Lager vs. Stout project selection, model building, LP vs. IP. Arrives in build phase 3.'),
  world4,
  world5,
  soon(6, 'bar-counter', 'Bar Counter', 'Queues & Variability', 'Tutorials 6–7',
    'cv, single-server queues, Little\'s law. Arrives in build phase 4.'),
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
