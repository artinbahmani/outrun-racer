/* util.js — shared config constants and math helpers */
'use strict';

/* Global tuning constants. Distances are in world units; one road segment is
   200 units long and the camera sits 1000 units above the road. */
var CFG = {
  segmentLength: 200,
  rumbleLength: 3,          // segments per rumble-strip colour alternation
  roadWidth: 2000,          // half-width of the road in world units
  lanes: 2,
  fov: 100,                 // camera field of view in degrees
  cameraHeight: 1000,
  drawDistance: 220,        // how many segments are projected per frame
  fogDensity: 5,
  centrifugal: 0.32,        // how hard curves push the car outward
  totalLaps: 3,
  trafficCount: 12,         // AI traffic cars per track
  opponentCount: 5          // racers you compete against
};

CFG.cameraDepth = 1 / Math.tan((CFG.fov / 2) * Math.PI / 180);
CFG.playerZ = CFG.cameraHeight * CFG.cameraDepth; // distance of player behind camera
CFG.maxSpeed = CFG.segmentLength * 60;            // one segment per frame at 60fps
CFG.accel = CFG.maxSpeed / 5;
CFG.brake = -CFG.maxSpeed;
CFG.decel = -CFG.maxSpeed / 5;
CFG.offRoadDecel = -CFG.maxSpeed * 0.75;
CFG.offRoadLimit = CFG.maxSpeed / 4;
CFG.topDisplayKmh = 320;    // speedometer reading at maxSpeed

var Util = {
  clamp: function (v, min, max) { return Math.max(min, Math.min(max, v)); },
  interpolate: function (a, b, p) { return a + (b - a) * p; },
  easeIn: function (a, b, p) { return a + (b - a) * p * p; },
  easeInOut: function (a, b, p) { return a + (b - a) * ((-Math.cos(p * Math.PI) / 2) + 0.5); },

  /* wrap `start + inc` into [0, max) */
  increase: function (start, inc, max) {
    var r = start + inc;
    while (r >= max) r -= max;
    while (r < 0) r += max;
    return r;
  },

  percentRemaining: function (n, total) { return (n % total) / total; },

  /* classic pseudo-3D fog falloff */
  exponentialFog: function (distance, density) {
    return 1 / Math.pow(Math.E, distance * distance * density);
  },

  /* 1D box overlap test on centred boxes */
  overlap: function (x1, w1, x2, w2) {
    return (x1 + w1 / 2 > x2 - w2 / 2) && (x1 - w1 / 2 < x2 + w2 / 2);
  },

  /* signed shortest distance from a to b on a ring of length `wrap` */
  ringDelta: function (a, b, wrap) {
    var d = b - a;
    if (d > wrap / 2) d -= wrap;
    else if (d < -wrap / 2) d += wrap;
    return d;
  },

  findSegment: function (segments, z) {
    return segments[Math.floor(z / CFG.segmentLength) % segments.length];
  },

  randomInt: function (min, max) { return Math.floor(min + Math.random() * (max - min + 1)); },
  pick: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },

  formatTime: function (ms) {
    if (ms == null || !isFinite(ms)) return '--:--.---';
    var m = Math.floor(ms / 60000);
    var s = Math.floor((ms % 60000) / 1000);
    var milli = Math.floor(ms % 1000);
    return m + ':' + ('0' + s).slice(-2) + '.' + ('00' + milli).slice(-3);
  },

  ordinal: function (n) {
    var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
};
