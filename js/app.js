/* app.js — bootstrap: canvas sizing, keyboard/touch input, the main loop and
   the engine-audio hookup. Plain scripts (no modules) so it runs from file://. */
'use strict';

(function () {
  function boot() {
    var canvas = document.getElementById('game');
    var ctx = canvas.getContext('2d');

    Game.init(canvas);
    resize();
    window.addEventListener('resize', resize);

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      Renderer.resize(window.innerWidth, window.innerHeight);
    }

    bindKeyboard();
    bindTouch();

    var last = performance.now();
    function frame(now) {
      var dt = Math.min((now - last) / 1000, 1 / 20); // clamp big tab-switch gaps
      last = now;
      Game.update(dt);
      Renderer.draw(ctx, Game);
      driveAudio(now);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function driveAudio(now) {
    if (Game.state === 'paused') { EngineAudio.update(0, 0); return; }
    if (Game.state === 'countdown') {
      // revving on the grid
      EngineAudio.update(0.18 + 0.12 * Math.sin(now / 110), 1);
      return;
    }
    EngineAudio.update(Game.speed / CFG.maxSpeed, Game.input.up ? 1 : 0);
  }

  var KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down'
  };

  function bindKeyboard() {
    window.addEventListener('keydown', function (e) {
      var k = KEYMAP[e.code];
      if (k) { Game.input[k] = true; e.preventDefault(); return; }
      if (e.code === 'KeyM') Game.toggleMute();
      else if (e.code === 'KeyP' || e.code === 'Escape') Game.togglePause();
      else if (e.code === 'Enter') {
        if (Game.state === 'menu') Game.startRace(Game.track);
        else if (Game.state === 'finished') Game.startRace(Game.track);
      } else if (e.code.indexOf('Digit') === 0 && Game.state === 'menu') {
        var i = parseInt(e.code.slice(5), 10) - 1;
        if (TRACKS[i]) Game.startRace(TRACKS[i]);
      }
    });
    window.addEventListener('keyup', function (e) {
      var k = KEYMAP[e.code];
      if (k) Game.input[k] = false;
    });
  }

  function bindTouch() {
    if (!('ontouchstart' in window) && navigator.maxTouchPoints === 0) return;
    document.body.classList.add('touch');
    var pad = document.getElementById('touch');
    pad.classList.remove('hidden');
    var map = { 't-left': 'left', 't-right': 'right', 't-brake': 'down', 't-gas': 'up' };
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      var flag = map[id];
      function on(e) { Game.input[flag] = true; e.preventDefault(); }
      function off(e) { Game.input[flag] = false; e.preventDefault(); }
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('pointerleave', off);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
