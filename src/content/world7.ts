// World 7 — Factory Yard: capacity planning by building a production hall.
// Links Lecture I (process capacity, bottleneck, utilization) with the
// capacity-planning side of OPM ("how to set capacity?").
import type { Level, World } from './types';
import { MISSIONS } from '../engine/factory';

const levels: Level[] = MISSIONS.map((m, i) => ({
  id: `7.${i + 1}`,
  world: 7,
  title: m.title,
  subtitle: `${m.demand} L/h · budget €${m.budget} · ${m.slots} slots per zone`,
  failKind: 'too-little',
  steps: () => [
    { kind: 'learn', title: m.learn.title, body: m.learn.body },
    { kind: 'factory', missionId: m.id },
  ],
}));

export const world7: World = {
  id: 7,
  room: 'brewhouse',
  name: 'Factory Yard',
  topic: 'Capacity planning',
  color: 'var(--room-5)',
  lecture: 'Lecture I · capacity, bottleneck · capacity planning',
  levels,
};
