/* tracks.js — the three circuits. Each plan entry is
   [enter, hold, leave, curve, hill] in segments; `curve` bends the road
   (0 = straight, ~2 easy, ~4 medium, 6 = hairpin) and `hill` is the total
   elevation change across the section in camera-heights-ish units. */
'use strict';

var TRACKS = [
  {
    id: 'coast',
    name: 'Coral Coast',
    tagline: 'Palm-lined shore highway. Sweeping curves, rolling hills.',
    bg: 'coast',
    sky: { top: '#2f6bb3', mid: '#79b8e0', horizon: '#cfe8d8', sun: '#fff6c9', sunX: 0.74, sunY: 0.2, night: false },
    palette: {
      light: { road: '#6e6e6e', grass: '#67b34f', rumble: '#f2f2f2', lane: '#f2f2f2' },
      dark: { road: '#686868', grass: '#5ea647', rumble: '#c8372e', lane: '' },
      fog: '#cfe8d8'
    },
    objects: ['palm', 'palm', 'palm', 'sign', 'billboard'],
    billboardText: 'CORAL COAST',
    spriteEvery: 9,
    plan: [
      [30, 40, 30, 0, 0],
      [25, 40, 25, 2, 12],
      [25, 50, 25, -1, 0],
      [20, 30, 20, 3, -12],
      [30, 60, 30, 0, 18],
      [25, 40, 25, -3, 0],
      [20, 30, 20, 2, -8],
      [30, 50, 30, -2, 0],
      [25, 40, 25, 1, -10],
      [40, 60, 40, 0, 0]
    ]
  },
  {
    id: 'desert',
    name: 'Dune Run',
    tagline: 'Open desert flats. Long straights, huge dunes, full throttle.',
    bg: 'desert',
    sky: { top: '#3f6aa8', mid: '#e8b96a', horizon: '#f2d8a0', sun: '#fff2c0', sunX: 0.3, sunY: 0.16, night: false },
    palette: {
      light: { road: '#6d6a63', grass: '#d9b26a', rumble: '#f2f2f2', lane: '#f2f2f2' },
      dark: { road: '#66635c', grass: '#cfa758', rumble: '#a33c2e', lane: '' },
      fog: '#f2d8a0'
    },
    objects: ['cactus', 'cactus', 'rock', 'sign', 'billboard', 'palm'],
    billboardText: 'OASIS 5 KM',
    spriteEvery: 11,
    plan: [
      [40, 80, 40, 0, 0],
      [30, 70, 30, 1, 20],
      [40, 90, 40, 0, -15],
      [25, 50, 25, 2, 10],
      [40, 80, 40, -1, -20],
      [30, 60, 30, 2, 15],
      [50, 90, 50, 0, -10],
      [30, 60, 30, -2, 0],
      [40, 80, 40, 0, 0]
    ]
  },
  {
    id: 'city',
    name: 'Neon City',
    tagline: 'Midnight downtown. Tight corners between the towers.',
    bg: 'city',
    sky: { top: '#050510', mid: '#140a2a', horizon: '#3a1050', sun: '#e8ecff', sunX: 0.62, sunY: 0.14, night: true },
    palette: {
      light: { road: '#3e3e48', grass: '#11111c', rumble: '#ff2d95', lane: '#8fd8ff' },
      dark: { road: '#383840', grass: '#0d0d16', rumble: '#22d3ee', lane: '' },
      fog: '#1a0f2e'
    },
    objects: ['building', 'building', 'building', 'sign', 'billboard'],
    billboardText: 'NEON CITY',
    spriteEvery: 6,
    plan: [
      [25, 30, 25, 0, 0],
      [20, 25, 20, 4, 0],
      [20, 25, 20, -4, 5],
      [15, 20, 15, 5, -5],
      [25, 40, 25, -2, 0],
      [20, 25, 20, -5, 8],
      [20, 30, 20, 3, -8],
      [15, 25, 15, 6, 0],
      [25, 35, 25, -3, 5],
      [30, 50, 30, 0, -5]
    ]
  }
];
