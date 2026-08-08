/* game.js — game state, player physics, opponent/traffic AI, lap and position
   tracking, HUD sync. Rendering lives in render.js; this module owns the
   world model. */
'use strict';

var Game = {
  state: 'boot',           // menu | countdown | racing | paused | finished
  track: null,
  segments: [],
  trackLength: 0,
  objectSprites: null,
  carSprites: null,
  background: null,

  position: 0,             // camera z along the track
  speed: 0,
  playerX: 0,              // lateral offset, road edge = +-1
  playerDist: 0,           // total race distance (for position tracking)
  offroad: false,

  lap: 1,
  lapTime: 0,
  lastLap: null,
  bestLap: null,
  raceTime: 0,

  opponents: [],
  traffic: [],
  segmentCars: {},         // segment index -> cars in it (rebuilt each frame)

  skyOff: 0, farOff: 0, nearOff: 0,   // parallax accumulators
  shake: 0,
  cdTimer: 0,

  input: { left: false, right: false, up: false, down: false },

  canvas: null,
  ui: {},
  _msgTimer: null,

  /* ------------------------------------------------------------ */
  /* setup                                                         */
  /* ------------------------------------------------------------ */

  init: function (canvas) {
    this.canvas = canvas;
    var ids = ['hud', 'hud-speed', 'hud-lap', 'hud-pos', 't-lap', 't-last', 't-best',
               'banner', 'countdown', 'menu', 'tracks', 'finish', 'fin-title',
               'fin-pos', 'fin-time', 'fin-best', 'fin-last', 'paused', 'mute', 'touch'];
    for (var i = 0; i < ids.length; i++) this.ui[ids[i]] = document.getElementById(ids[i]);

    this.buildMenu();
    this.loadTrack(TRACKS[0]);
    this.state = 'menu';
    this.show('menu');

    var self = this;
    document.getElementById('btn-again').addEventListener('click', function () { self.startRace(self.track); });
    document.getElementById('btn-tracks').addEventListener('click', function () { self.toMenu(); });
    this.ui.mute.addEventListener('click', function () { self.toggleMute(); });
  },

  buildMenu: function () {
    var self = this;
    this.ui.tracks.innerHTML = '';
    TRACKS.forEach(function (t, i) {
      var card = document.createElement('button');
      card.className = 'card';
      card.innerHTML =
        '<span class="card-key">' + (i + 1) + '</span>' +
        '<span class="card-name">' + t.name + '</span>' +
        '<span class="card-tag">' + t.tagline + '</span>' +
        '<span class="card-best">Best lap: <b id="best-' + t.id + '">--:--.---</b></span>';
      card.addEventListener('click', function () { self.startRace(t); });
      self.ui.tracks.appendChild(card);
    });
    this.refreshMenuBest();
  },

  refreshMenuBest: function () {
    TRACKS.forEach(function (t) {
      var el = document.getElementById('best-' + t.id);
      if (el) el.textContent = Util.formatTime(Game.readBest(t));
    });
  },

  /* ------------------------------------------------------------ */
  /* track construction                                            */
  /* ------------------------------------------------------------ */

  lastY: function () {
    return this.segments.length === 0 ? 0 : this.segments[this.segments.length - 1].p2.world.y;
  },

  addSegment: function (curve, y) {
    var n = this.segments.length;
    this.segments.push({
      index: n,
      curve: curve,
      p1: { world: { x: 0, y: this.lastY(), z: n * CFG.segmentLength }, camera: {}, screen: {} },
      p2: { world: { x: 0, y: y, z: (n + 1) * CFG.segmentLength }, camera: {}, screen: {} },
      sprites: [],
      color: Math.floor(n / CFG.rumbleLength) % 2 ? 'dark' : 'light',
      fog: 1, clip: 0, looped: false, visible: false
    });
  },

  addRoad: function (enter, hold, leave, curve, hill) {
    var startY = this.lastY();
    var endY = startY + (hill || 0) * CFG.segmentLength;
    var total = enter + hold + leave, n;
    for (n = 0; n < enter; n++)
      this.addSegment(Util.easeIn(0, curve, n / enter), Util.easeInOut(startY, endY, n / total));
    for (n = 0; n < hold; n++)
      this.addSegment(curve, Util.easeInOut(startY, endY, (enter + n) / total));
    for (n = 0; n < leave; n++)
      this.addSegment(Util.easeInOut(curve, 0, n / leave), Util.easeInOut(startY, endY, (enter + hold + n) / total));
  },

  placeObjects: function () {
    var every = this.track.spriteEvery;
    for (var n = 25; n < this.segments.length - 25; n += every + Util.randomInt(0, every)) {
      var side = Math.random() < 0.5 ? -1 : 1;
      this.segments[n].sprites.push({
        type: Util.pick(this.track.objects),
        offset: side * (1.25 + Math.random() * 1.9)
      });
      if (Math.random() < 0.35) {
        this.segments[n].sprites.push({
          type: Util.pick(this.track.objects),
          offset: -side * (1.3 + Math.random() * 1.6)
        });
      }
    }
  },

  placeTraffic: function () {
    this.traffic = [];
    for (var i = 0; i < CFG.trafficCount; i++) {
      var z = ((i + 1) / (CFG.trafficCount + 1)) * this.trackLength + Math.random() * CFG.segmentLength * 12;
      this.traffic.push({
        kind: 'traffic',
        z: z % this.trackLength,
        offset: (Math.random() < 0.5 ? -1 : 1) * (0.2 + Math.random() * 0.55),
        speed: CFG.maxSpeed * (0.25 + Math.random() * 0.18),
        color: Util.pick(Sprites.TRAFFIC_COLORS)
      });
    }
  },

  setupOpponents: function () {
    this.opponents = [];
    for (var i = 0; i < CFG.opponentCount; i++) {
      var grid = (i + 1) * CFG.segmentLength * 3;   // head start ahead of the player
      var lane = (i % 2 === 0 ? -1 : 1) * (0.3 + 0.15 * (i % 3));
      this.opponents.push({
        kind: 'opponent',
        z: CFG.playerZ + grid,
        offset: lane,
        home: lane,
        speed: 0,
        baseSpeed: CFG.maxSpeed * (0.8 + 0.035 * i),
        color: Sprites.OPPONENT_COLORS[i],
        dist: grid
      });
    }
  },

  loadTrack: function (t) {
    this.track = t;
    this.segments = [];
    for (var i = 0; i < t.plan.length; i++) {
      var s = t.plan[i];
      this.addRoad(s[0], s[1], s[2], s[3], s[4]);
    }
    this.trackLength = this.segments.length * CFG.segmentLength;
    this.objectSprites = Sprites.buildObjectSet(t);
    this.carSprites = Sprites.buildCarSet();
    this.background = Sprites.buildBackground(t);
    this.placeObjects();
    this.placeTraffic();
    this.setupOpponents();
    this.bucketCars();
  },

  /* ------------------------------------------------------------ */
  /* race lifecycle                                                */
  /* ------------------------------------------------------------ */

  startRace: function (t) {
    this.loadTrack(t);
    this.position = 0;
    this.speed = 0;
    this.playerX = 0;
    this.playerDist = 0;
    this.lap = 1;
    this.lapTime = 0;
    this.lastLap = null;
    this.raceTime = 0;
    this.bestLap = this.readBest(t);
    this.skyOff = this.farOff = this.nearOff = 0;
    this.shake = 0;
    this.cdTimer = 3;
    this.state = 'countdown';
    EngineAudio.start();
    this.hide('menu'); this.hide('finish'); this.hide('paused');
    this.show('hud'); this.show('countdown');
    this.ui['hud-pos'].textContent = 'P' + (CFG.opponentCount + 1);
  },

  toMenu: function () {
    this.state = 'menu';
    this.refreshMenuBest();
    this.hide('finish'); this.hide('hud'); this.hide('paused'); this.hide('countdown');
    this.show('menu');
  },

  togglePause: function () {
    if (this.state === 'racing') { this.state = 'paused'; this.show('paused'); }
    else if (this.state === 'paused') { this.state = 'racing'; this.hide('paused'); }
  },

  toggleMute: function () {
    var m = EngineAudio.toggleMute();
    this.ui.mute.textContent = m ? '\u{1F507}' : '\u{1F50A}';
  },

  finishRace: function () {
    this.state = 'finished';
    var pos = this.computePosition();
    this.ui['fin-title'].textContent = pos === 1 ? 'VICTORY!' : Util.ordinal(pos) + ' PLACE';
    this.ui['fin-pos'].textContent = 'P' + pos + ' of ' + (CFG.opponentCount + 1);
    this.ui['fin-time'].textContent = Util.formatTime(this.raceTime);
    this.ui['fin-last'].textContent = Util.formatTime(this.lastLap);
    this.ui['fin-best'].textContent = Util.formatTime(this.bestLap);
    this.hide('countdown');
    this.show('finish');
  },

  lapComplete: function () {
    this.lastLap = this.lapTime;
    if (!this.bestLap || this.lapTime < this.bestLap) {
      this.bestLap = this.lapTime;
      this.saveBest();
    }
    this.lapTime = 0;
    this.lap++;
    if (this.lap > CFG.totalLaps) this.finishRace();
    else if (this.lap === CFG.totalLaps) this.showMsg('FINAL LAP', 1600);
    else this.showMsg('LAP ' + this.lap, 1200);
  },

  computePosition: function () {
    var pos = 1;
    for (var i = 0; i < this.opponents.length; i++)
      if (this.opponents[i].dist > this.playerDist) pos++;
    return pos;
  },

  /* ------------------------------------------------------------ */
  /* per-frame update                                              */
  /* ------------------------------------------------------------ */

  update: function (dt) {
    switch (this.state) {
      case 'menu':
        this.updateWorld(dt, true);
        break;
      case 'countdown':
        this.cdTimer -= dt;
        this.ui.countdown.textContent = Math.max(1, Math.ceil(this.cdTimer));
        if (this.cdTimer <= 0) {
          this.state = 'racing';
          this.hide('countdown');
          this.showMsg('GO!', 900);
        }
        break;
      case 'racing':
        this.raceTime += dt * 1000;
        this.lapTime += dt * 1000;
        this.updateWorld(dt, false);
        break;
      case 'finished':
        this.updateWorld(dt, true);
        break;
      case 'paused':
        break;
    }
    this.syncUI();
  },

  /* shared physics for live races and the attract-mode menu drive */
  updateWorld: function (dt, attract) {
    var playerSegment = Util.findSegment(this.segments, this.position + CFG.playerZ);
    var speedPercent = this.speed / CFG.maxSpeed;
    var dx = dt * 2 * speedPercent;
    var startPosition = this.position;

    this.position = Util.increase(this.position, dt * this.speed, this.trackLength);
    this.playerDist += dt * this.speed;

    // parallax accumulates with distance travelled through curvature
    var travel = (dt * this.speed) / CFG.segmentLength;
    this.skyOff = Util.increase(this.skyOff, 0.002 * playerSegment.curve * travel, 1);
    this.farOff = Util.increase(this.farOff, 0.006 * playerSegment.curve * travel, 1);
    this.nearOff = Util.increase(this.nearOff, 0.014 * playerSegment.curve * travel, 1);

    if (attract) {
      // self-driving demo: centre the car, cruise at ~55%
      this.playerX += (0 - this.playerX) * dt * 2;
      var cap = CFG.maxSpeed * 0.55;
      if (this.speed < cap) this.speed = Math.min(cap, this.speed + CFG.accel * 0.55 * dt);
      else this.speed = Math.max(cap, this.speed + CFG.decel * dt);
    } else {
      if (this.input.left) this.playerX -= dx;
      if (this.input.right) this.playerX += dx;
      if (this.input.up) this.speed += CFG.accel * dt;
      else if (this.input.down) this.speed += CFG.brake * dt;
      else this.speed += CFG.decel * dt;
    }

    // curves throw the car outward
    this.playerX = Util.clamp(
      this.playerX - dx * speedPercent * playerSegment.curve * CFG.centrifugal, -2.2, 2.2);

    this.offroad = this.playerX < -1 || this.playerX > 1;
    if (this.offroad) {
      if (this.speed > CFG.offRoadLimit) this.speed += CFG.offRoadDecel * dt;
      if (!attract) this.collideRoadside(playerSegment);
    }
    this.speed = Util.clamp(this.speed, 0, CFG.maxSpeed);

    this.updateTraffic(dt);
    this.updateOpponents(dt);
    this.bucketCars();

    if (!attract) this.collideCars();

    if (!attract && this.position < startPosition && this.speed > 0) this.lapComplete();

    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1.4);
  },

  collideRoadside: function (segment) {
    for (var i = 0; i < segment.sprites.length; i++) {
      var sp = segment.sprites[i];
      var def = Sprites.OBJECT_DEFS[sp.type];
      if (Util.overlap(this.playerX, 0.3, sp.offset, def.w)) {
        this.speed = CFG.maxSpeed / 6;
        this.shake = 0.5;
        EngineAudio.crash();
        break;
      }
    }
  },

  collideCars: function () {
    var pz = this.position + CFG.playerZ;
    var all = this.traffic.concat(this.opponents);
    for (var i = 0; i < all.length; i++) {
      var car = all[i];
      var dz = Util.ringDelta(pz, car.z, this.trackLength);
      if (Math.abs(dz) < CFG.segmentLength * 0.55 &&
          this.speed > car.speed &&
          Util.overlap(this.playerX, Sprites.CAR_W, car.offset, Sprites.CAR_W)) {
        this.speed = Math.max(car.speed * 0.5, CFG.maxSpeed * 0.05);
        this.playerX += (this.playerX < car.offset ? -0.08 : 0.08);
        this.shake = 0.45;
        EngineAudio.crash();
      }
    }
  },

  updateTraffic: function (dt) {
    for (var i = 0; i < this.traffic.length; i++) {
      var car = this.traffic[i];
      car.z = Util.increase(car.z, dt * car.speed, this.trackLength);
    }
  },

  updateOpponents: function (dt) {
    for (var i = 0; i < this.opponents.length; i++) {
      var opp = this.opponents[i];
      // rubber-banding: trailing rivals get faster, leading ones ease off
      var gap = this.playerDist - opp.dist;
      var band = Util.clamp(gap / this.trackLength, -0.5, 0.5);
      var target = opp.baseSpeed * (1 + band * 0.22);
      if (this.state !== 'countdown' && this.state !== 'paused') {
        if (opp.speed < target) opp.speed = Math.min(target, opp.speed + CFG.accel * 0.9 * dt);
        else opp.speed = Math.max(target, opp.speed - CFG.accel * 0.6 * dt);
      }
      opp.z = Util.increase(opp.z, dt * opp.speed, this.trackLength);
      opp.dist += dt * opp.speed;
      this.steerOpponent(opp, dt);
    }
  },

  steerOpponent: function (opp, dt) {
    var seg = Util.findSegment(this.segments, opp.z);
    var target = opp.home;
    var ahead = this.carAheadOf(opp);
    if (ahead) target = (opp.offset <= ahead.offset) ? ahead.offset - 0.55 : ahead.offset + 0.55;
    target = Util.clamp(target, -0.9, 0.9);
    var maxSteer = dt * 1.6;
    opp.offset += Util.clamp(target - opp.offset, -maxSteer, maxSteer);
    // curves push AI cars outward too
    opp.offset -= dt * (opp.speed / CFG.maxSpeed) * seg.curve * 0.32;
    opp.offset = Util.clamp(opp.offset, -0.95, 0.95);
  },

  carAheadOf: function (opp) {
    var best = null, bestDz = CFG.segmentLength * 8;
    var all = this.traffic.concat(this.opponents);
    for (var i = 0; i < all.length; i++) {
      var c = all[i];
      if (c === opp) continue;
      var dz = Util.ringDelta(opp.z, c.z, this.trackLength);
      if (dz > 0 && dz < bestDz && Math.abs(c.offset - opp.offset) < 0.5) {
        best = c; bestDz = dz;
      }
    }
    return best;
  },

  bucketCars: function () {
    this.segmentCars = {};
    var all = this.traffic.concat(this.opponents);
    for (var i = 0; i < all.length; i++) {
      var idx = Util.findSegment(this.segments, all[i].z).index;
      (this.segmentCars[idx] = this.segmentCars[idx] || []).push(all[i]);
    }
  },

  /* ------------------------------------------------------------ */
  /* HUD / DOM                                                     */
  /* ------------------------------------------------------------ */

  syncUI: function () {
    var s = this.state;
    if (s === 'racing' || s === 'countdown' || s === 'paused' || s === 'finished') {
      this.ui['hud-speed'].textContent = Math.round(this.speed / CFG.maxSpeed * CFG.topDisplayKmh);
      this.ui['hud-lap'].textContent = 'LAP ' + Math.min(this.lap, CFG.totalLaps) + '/' + CFG.totalLaps;
      this.ui['hud-pos'].textContent = 'P' + this.computePosition();
      this.ui['t-lap'].textContent = Util.formatTime(this.lapTime);
      this.ui['t-last'].textContent = Util.formatTime(this.lastLap);
      this.ui['t-best'].textContent = Util.formatTime(this.bestLap);
    }
  },

  showMsg: function (text, ms) {
    var b = this.ui.banner;
    b.textContent = text;
    b.classList.add('show');
    clearTimeout(this._msgTimer);
    this._msgTimer = setTimeout(function () { b.classList.remove('show'); }, ms);
  },

  show: function (id) { this.ui[id].classList.remove('hidden'); },
  hide: function (id) { this.ui[id].classList.add('hidden'); },

  /* ------------------------------------------------------------ */
  /* persistence                                                   */
  /* ------------------------------------------------------------ */

  bestKey: function (t) { return 'outrunracer.bestlap.' + t.id; },

  readBest: function (t) {
    try {
      var v = localStorage.getItem(this.bestKey(t));
      var n = v ? parseFloat(v) : NaN;
      return isFinite(n) ? n : null;
    } catch (e) { return null; }
  },

  saveBest: function () {
    try { localStorage.setItem(this.bestKey(this.track), String(this.bestLap)); } catch (e) { /* private mode */ }
  }
};
