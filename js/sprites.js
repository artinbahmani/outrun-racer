/* sprites.js — all artwork is generated procedurally on offscreen canvases at
   load time: roadside objects, rival/traffic cars and parallax background
   strips. No image assets, no dependencies. */
'use strict';

var Sprites = (function () {

  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  /* deterministic PRNG so buildings/skyline look the same every visit */
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  /* shift a #rrggbb colour by `amt` per channel */
  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.min(255, Math.max(0, (n >> 16) + amt));
    var g = Math.min(255, Math.max(0, ((n >> 8) & 255) + amt));
    var b = Math.min(255, Math.max(0, (n & 255) + amt));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  /* ------------------------------------------------------------------ */
  /* Roadside objects (anchored at bottom-centre)                        */
  /* ------------------------------------------------------------------ */

  function drawPalm() {
    var c = makeCanvas(180, 240), ctx = c.getContext('2d');
    ctx.lineCap = 'round';
    // trunk (two stacked strokes to fake a taper)
    ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 13;
    ctx.beginPath(); ctx.moveTo(88, 240); ctx.quadraticCurveTo(84, 160, 96, 80); ctx.stroke();
    ctx.strokeStyle = '#7d5834'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(90, 200); ctx.quadraticCurveTo(88, 140, 97, 78); ctx.stroke();
    // fronds
    var greens = ['#2e9e4f', '#37b25c', '#278a45'];
    for (var i = 0; i < 7; i++) {
      var a = Math.PI * (0.05 + 0.9 * (i / 6));
      var ex = 96 + Math.cos(a) * 88;
      var ey = 74 - Math.sin(a) * 34 + 46;
      ctx.strokeStyle = greens[i % 3]; ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(96, 72);
      ctx.quadraticCurveTo(96 + Math.cos(a) * 52, 66 - Math.sin(a) * 40, ex, ey);
      ctx.stroke();
    }
    // coconuts
    ctx.fillStyle = '#5a3d20';
    ctx.beginPath(); ctx.arc(88, 82, 7, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(103, 86, 6, 0, 7); ctx.fill();
    return c;
  }

  function drawCactus() {
    var c = makeCanvas(110, 170), ctx = c.getContext('2d');
    ctx.fillStyle = '#3d8b4f';
    roundRectPath(ctx, 44, 10, 24, 158, 12); ctx.fill();   // main column
    roundRectPath(ctx, 12, 60, 16, 54, 8); ctx.fill();    // left arm up
    roundRectPath(ctx, 12, 96, 42, 16, 8); ctx.fill();    // left connector
    roundRectPath(ctx, 80, 40, 16, 62, 8); ctx.fill();    // right arm up
    roundRectPath(ctx, 58, 86, 40, 16, 8); ctx.fill();    // right connector
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRectPath(ctx, 50, 14, 6, 150, 3); ctx.fill();    // sun highlight
    return c;
  }

  function drawRock() {
    var c = makeCanvas(130, 80), ctx = c.getContext('2d');
    ctx.fillStyle = '#8a8578';
    ctx.beginPath();
    ctx.moveTo(5, 80); ctx.lineTo(20, 34); ctx.lineTo(52, 12);
    ctx.lineTo(88, 22); ctx.lineTo(122, 48); ctx.lineTo(126, 80);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#a39d8d';
    ctx.beginPath();
    ctx.moveTo(20, 34); ctx.lineTo(52, 12); ctx.lineTo(70, 44); ctx.lineTo(34, 58);
    ctx.closePath(); ctx.fill();
    return c;
  }

  function drawSign(night) {
    var c = makeCanvas(140, 160), ctx = c.getContext('2d');
    ctx.fillStyle = night ? '#3a3a46' : '#666';
    ctx.fillRect(64, 78, 10, 82);                          // post
    ctx.fillStyle = night ? '#101018' : '#f4c542';
    roundRectPath(ctx, 14, 14, 112, 62, 8); ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = night ? '#22d3ee' : '#222';
    roundRectPath(ctx, 14, 14, 112, 62, 8); ctx.stroke();
    // chevrons
    ctx.strokeStyle = night ? '#ff2d95' : '#222';
    ctx.lineWidth = 9; ctx.lineCap = 'round';
    for (var i = 0; i < 2; i++) {
      var x = 46 + i * 34;
      ctx.beginPath();
      ctx.moveTo(x, 28); ctx.lineTo(x + 18, 45); ctx.lineTo(x, 62);
      ctx.stroke();
    }
    return c;
  }

  function drawBillboard(text, night) {
    var c = makeCanvas(260, 180), ctx = c.getContext('2d');
    ctx.fillStyle = night ? '#2a2a34' : '#5a5a5a';
    ctx.fillRect(46, 104, 12, 76);
    ctx.fillRect(202, 104, 12, 76);
    ctx.fillStyle = night ? '#0c0c16' : '#f2efe6';
    roundRectPath(ctx, 6, 8, 248, 100, 10); ctx.fill();
    ctx.lineWidth = 7;
    ctx.strokeStyle = night ? '#ff2d95' : '#c8372e';
    roundRectPath(ctx, 6, 8, 248, 100, 10); ctx.stroke();
    ctx.fillStyle = night ? '#22d3ee' : '#1d2b3a';
    ctx.font = 'bold 30px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 130, 58);
    if (night) { // cheap neon glow pass
      ctx.globalAlpha = 0.5;
      ctx.fillText(text, 130, 58);
      ctx.globalAlpha = 1;
    }
    return c;
  }

  function drawBuilding(seed, night) {
    var rand = rng(seed);
    var c = makeCanvas(170, 300), ctx = c.getContext('2d');
    ctx.fillStyle = night ? '#1a2030' : '#6d7683';
    ctx.fillRect(8, 20, 154, 280);
    ctx.fillStyle = night ? '#232c42' : '#7d8794';
    ctx.fillRect(8, 20, 154, 10);                          // roof lip
    if (rand() < 0.5) {                                    // antenna
      ctx.strokeStyle = night ? '#394' : '#444';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(85, 20); ctx.lineTo(85, 2); ctx.stroke();
    }
    for (var row = 0; row < 11; row++) {
      for (var col = 0; col < 6; col++) {
        var lit = rand() < (night ? 0.55 : 0.3);
        ctx.fillStyle = lit ? (night ? '#ffd27a' : '#dfe9f2') : (night ? '#0d1220' : '#4a525c');
        ctx.fillRect(20 + col * 23, 44 + row * 23, 14, 13);
      }
    }
    return c;
  }

  /* rear-view car sprite used for opponents and traffic */
  function drawCar(color) {
    var c = makeCanvas(150, 100), ctx = c.getContext('2d');
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(75, 92, 66, 8, 0, 0, 7); ctx.fill();
    // wheels
    ctx.fillStyle = '#111';
    roundRectPath(ctx, 10, 56, 26, 38, 6); ctx.fill();
    roundRectPath(ctx, 114, 56, 26, 38, 6); ctx.fill();
    // body
    ctx.fillStyle = color;
    roundRectPath(ctx, 8, 40, 134, 46, 10); ctx.fill();
    ctx.fillStyle = shade(color, -28);
    roundRectPath(ctx, 8, 66, 134, 20, 8); ctx.fill();     // lower skirt
    // cabin + rear window
    ctx.fillStyle = shade(color, -14);
    roundRectPath(ctx, 30, 12, 90, 36, 9); ctx.fill();
    ctx.fillStyle = '#18222e';
    roundRectPath(ctx, 38, 18, 74, 24, 6); ctx.fill();
    // spoiler
    ctx.fillStyle = shade(color, -40);
    ctx.fillRect(22, 2, 106, 8);
    ctx.fillRect(30, 8, 8, 10);
    ctx.fillRect(112, 8, 8, 10);
    // taillights
    ctx.fillStyle = '#ff3b30';
    roundRectPath(ctx, 16, 50, 34, 11, 4); ctx.fill();
    roundRectPath(ctx, 100, 50, 34, 11, 4); ctx.fill();
    // exhausts
    ctx.fillStyle = '#c8c8c8';
    ctx.beginPath(); ctx.arc(62, 82, 5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(88, 82, 5, 0, 7); ctx.fill();
    return c;
  }

  /* ------------------------------------------------------------------ */
  /* Parallax background strips (drawn with bottom edge on the horizon)  */
  /* ------------------------------------------------------------------ */

  var STRIP_W = 2048;

  function coastFar() {
    var c = makeCanvas(STRIP_W, 150), ctx = c.getContext('2d'), rand = rng(11);
    ctx.fillStyle = '#2e86a8'; ctx.fillRect(0, 96, STRIP_W, 54);       // sea
    ctx.fillStyle = '#9fd8e2'; ctx.fillRect(0, 92, STRIP_W, 5);        // horizon glint
    ctx.fillStyle = '#3f7a5e';                                         // headlands
    for (var x = 0; x < STRIP_W; x += 320) {
      var h = 20 + rand() * 45;
      ctx.beginPath();
      ctx.moveTo(x - 60, 98);
      ctx.quadraticCurveTo(x + 100, 98 - h * 2, x + 260, 98);
      ctx.closePath(); ctx.fill();
    }
    return c;
  }

  function coastNear() {
    var c = makeCanvas(STRIP_W, 190), ctx = c.getContext('2d'), rand = rng(23);
    ctx.fillStyle = '#57a047';
    ctx.beginPath(); ctx.moveTo(0, 190);
    for (var x = 0; x <= STRIP_W; x += 128) ctx.lineTo(x, 190 - (46 + rand() * 96));
    ctx.lineTo(STRIP_W, 190); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2f6b2f';                                         // palm silhouettes
    for (var i = 0; i < 14; i++) {
      var px = rand() * STRIP_W, py = 150 + rand() * 34, s = 0.5 + rand() * 0.6;
      ctx.save(); ctx.translate(px, py); ctx.scale(s, s);
      ctx.fillRect(-2, -34, 4, 34);
      for (var f = 0; f < 5; f++) {
        var a = Math.PI * (0.1 + 0.8 * f / 4);
        ctx.beginPath(); ctx.ellipse(Math.cos(a) * 14, -34 - Math.sin(a) * 8 + 6, 13, 4, a - Math.PI / 2, 0, 7); ctx.fill();
      }
      ctx.restore();
    }
    return c;
  }

  function desertFar() {
    var c = makeCanvas(STRIP_W, 140), ctx = c.getContext('2d'), rand = rng(31);
    ctx.fillStyle = '#e0aa60';
    ctx.beginPath(); ctx.moveTo(0, 140);
    for (var x = 0; x <= STRIP_W; x += 170) {
      ctx.quadraticCurveTo(x + 85, 140 - (50 + rand() * 70), x + 170, 140 - rand() * 20);
    }
    ctx.lineTo(STRIP_W, 140); ctx.closePath(); ctx.fill();
    return c;
  }

  function desertNear() {
    var c = makeCanvas(STRIP_W, 170), ctx = c.getContext('2d'), rand = rng(47);
    ctx.fillStyle = '#c9893f';
    ctx.beginPath(); ctx.moveTo(0, 170);
    for (var x = 0; x <= STRIP_W; x += 110) ctx.lineTo(x, 170 - (30 + rand() * 80));
    ctx.lineTo(STRIP_W, 170); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8a5a28';
    for (var i = 0; i < 10; i++) {                                     // cactus silhouettes
      var px = rand() * STRIP_W, ph = 22 + rand() * 30, py = 140 + rand() * 26;
      ctx.fillRect(px, py - ph, 7, ph);
      ctx.fillRect(px - 9, py - ph + 8, 6, ph * 0.4);
      ctx.fillRect(px + 9, py - ph + 4, 6, ph * 0.5);
    }
    return c;
  }

  function cityFar() {
    var c = makeCanvas(STRIP_W, 240), ctx = c.getContext('2d'), rand = rng(59);
    for (var i = 0; i < 140; i++) {                                    // stars
      ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + rand() * 0.6) + ')';
      ctx.fillRect(rand() * STRIP_W, rand() * 90, 2, 2);
    }
    var x = 0;
    while (x < STRIP_W) {                                              // skyline
      var w = 60 + rand() * 110, h = 60 + rand() * 150;
      ctx.fillStyle = '#181430';
      ctx.fillRect(x, 240 - h, w, h);
      ctx.fillStyle = '#ffd27a';
      for (var wy = 240 - h + 8; wy < 232; wy += 14)
        for (var wx = x + 6; wx < x + w - 8; wx += 14)
          if (rand() < 0.35) ctx.fillRect(wx, wy, 5, 6);
      x += w + 8 + rand() * 30;
    }
    return c;
  }

  function cityNear() {
    var c = makeCanvas(STRIP_W, 210), ctx = c.getContext('2d'), rand = rng(71);
    var x = 0;
    while (x < STRIP_W) {
      var w = 90 + rand() * 140, h = 80 + rand() * 120;
      ctx.fillStyle = '#241c44';
      ctx.fillRect(x, 210 - h, w, h);
      ctx.fillStyle = rand() < 0.5 ? '#ff2d95' : '#22d3ee';            // neon edge
      ctx.fillRect(x, 210 - h, w, 4);
      ctx.fillStyle = '#ffe9a8';
      for (var wy = 210 - h + 10; wy < 202; wy += 16)
        for (var wx = x + 8; wx < x + w - 10; wx += 16)
          if (rand() < 0.3) ctx.fillRect(wx, wy, 6, 7);
      x += w + 12 + rand() * 40;
    }
    return c;
  }

  /* ------------------------------------------------------------------ */

  /* frac = sprite width as a fraction of the road half-width on screen;
     w = collision width in road units (playerX space, road edge = 1) */
  var OBJECT_DEFS = {
    palm: { frac: 0.85, w: 0.32 },
    cactus: { frac: 0.55, w: 0.26 },
    rock: { frac: 0.5, w: 0.3 },
    sign: { frac: 0.85, w: 0.3 },
    billboard: { frac: 1.7, w: 0.75 },
    building: { frac: 2.1, w: 0.85 }
  };

  var CAR_FRAC = 0.55;   // car width as fraction of road half-width
  var CAR_W = 0.3;       // collision width in road units

  function buildObjectSet(track) {
    var night = !!track.sky.night;
    var set = {};
    var unique = {};
    track.objects.forEach(function (t) { unique[t] = true; });
    Object.keys(unique).forEach(function (t) {
      switch (t) {
        case 'palm': set.palm = drawPalm(); break;
        case 'cactus': set.cactus = drawCactus(); break;
        case 'rock': set.rock = drawRock(); break;
        case 'sign': set.sign = drawSign(night); break;
        case 'billboard': set.billboard = drawBillboard(track.billboardText, night); break;
        case 'building': set.building = drawBuilding(900 + track.id.length * 37, night); break;
      }
    });
    return set;
  }

  var OPPONENT_COLORS = ['#ffd23f', '#3fa9ff', '#b46bff', '#3fff8f', '#ff6b3f'];
  var TRAFFIC_COLORS = ['#9aa0a8', '#d8d8d8', '#4a5a6a', '#8a5a3a', '#3a6a4a', '#6a3a5a'];

  function buildCarSet() {
    var set = {};
    OPPONENT_COLORS.concat(TRAFFIC_COLORS).forEach(function (col) {
      set[col] = drawCar(col);
    });
    return set;
  }

  function buildBackground(track) {
    var layers;
    if (track.bg === 'coast') layers = [coastFar(), coastNear()];
    else if (track.bg === 'desert') layers = [desertFar(), desertNear()];
    else layers = [cityFar(), cityNear()];
    return [
      { img: layers[0], speed: 0.06 },
      { img: layers[1], speed: 0.2 }
    ];
  }

  return {
    OBJECT_DEFS: OBJECT_DEFS,
    CAR_FRAC: CAR_FRAC,
    CAR_W: CAR_W,
    OPPONENT_COLORS: OPPONENT_COLORS,
    TRAFFIC_COLORS: TRAFFIC_COLORS,
    buildObjectSet: buildObjectSet,
    buildCarSet: buildCarSet,
    buildBackground: buildBackground
  };
})();
