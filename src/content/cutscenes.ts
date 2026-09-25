// Cutscene scripts from the Astra package (storyboards/timings-and-movements.md).
// Each sequence: 5 frames × 1.6 s. Frames are the cropped storyboard SVGs.
import type { OutcomeKind } from './types';

export interface Cutscene { title: string; headline: string; mood: string; captions: string[]; soda?: string[] }

export const CUTSCENES: Record<OutcomeKind, Cutscene> = {
  perfect: {
    title: 'PERFECT · A well-earned break',
    headline: 'Perfect plan. Bruno is off to the beach.',
    mood: 'beach-rich',
    captions: [
      'The numbers worked. The beach is open.',
      'Bruno has diversified into… relaxing.',
      'A tiny umbrella. A very large bonus.',
      'Even the steel band is on schedule.',
      'Perfect plan. Maximum banana potential.',
    ],
  },
  'good-enough': {
    title: 'GOOD ENOUGH · The banana bonus',
    headline: 'A banana-worthy shift.',
    mood: 'proud',
    captions: [
      'The shift is over. Mostly on time.',
      'The boss checks the numbers.',
      'A respectable result deserves…',
      'One performance-related banana.',
      'Not perfect. Still progress.',
    ],
  },
  'too-much': {
    title: 'TOO MUCH · A surplus of confidence',
    headline: 'Too much beer. Bruno "tested" the surplus.',
    mood: 'tipsy',
    captions: [
      'The forecast said "some". Bruno heard "all".',
      'Stock climbs. Storage cost follows.',
      'A tiny quality check… or three.',
      'Inventory has a surprisingly wide turning circle.',
      'Next time: a smaller batch.',
    ],
    soda: [
      'The forecast said "some". Bruno heard "all".',
      'Stock climbs. Storage cost follows.',
      'A fizzy quality check… hic!',
      'Inventory has a surprisingly wide turning circle.',
      'Next time: a smaller batch.',
    ],
  },
  'too-little': {
    title: 'TOO LITTLE · A very dry opening',
    headline: 'Not enough beer. Bruno got the pink slip.',
    mood: 'fired',
    captions: [
      'The festival starts. The tap does not.',
      'Demand: here. Inventory: elsewhere.',
      'The boss has a short meeting in mind.',
      'Bruno packs his important business banana.',
      'Try the plan again. Bruno is counting on you.',
    ],
  },
  'bottleneck-fail': {
    title: 'BOTTLENECK FAIL · Surf\'s up, output\'s down',
    headline: 'The kettle overflowed. Bruno went surfing.',
    mood: 'worried',
    captions: [
      'The mash keeps coming…',
      '…faster than the kettle can clear it.',
      'There is now a river in the process flow.',
      'Bruno finds a temporary workaround.',
      'Fun commute. Terrible throughput.',
    ],
  },
  'queue-fail': {
    title: 'QUEUE FAIL · The conga line of lost customers',
    headline: 'The queue left the building.',
    mood: 'worried',
    captions: [
      'One server. A very popular bar.',
      'The line is learning choreography.',
      'Waiting time has left the building.',
      'So have the customers.',
      'Next shift: more capacity, less conga.',
    ],
  },
  'wrong-classification': {
    title: 'WRONG CLASSIFICATION · Wrong turn, right enthusiasm',
    headline: 'The truck went to the wrong festival.',
    mood: 'worried',
    captions: [
      'One delivery. Three important labels.',
      'The route depends on the classification.',
      'That does not look like our festival.',
      'Excellent jazz. Incorrect destination.',
      'Review the axes, then reroute.',
    ],
  },
};

export const OUTCOME_LABEL: Record<OutcomeKind, string> = {
  perfect: 'PERFECT!',
  'good-enough': 'GOOD ENOUGH!',
  'too-much': 'TOO MUCH!',
  'too-little': 'TOO LITTLE!',
  'bottleneck-fail': 'BOTTLENECK!',
  'queue-fail': 'QUEUE MELTDOWN!',
  'wrong-classification': 'WRONG TURN!',
};
