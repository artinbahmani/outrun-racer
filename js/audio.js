/* audio.js — engine hum synthesized with two detuned oscillators whose pitch
   follows speed, plus a noise burst for collisions. Everything is guarded so
   the game runs fine when WebAudio is unavailable or not yet allowed. */
'use strict';

var EngineAudio = (function () {
  var ctx = null;
  var master, oscGain, filter, osc1, osc2, noiseBuf;
  var muted = false;
  var lastCrash = 0;

  function ensure() {
    if (ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);

      filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 600;

      oscGain = ctx.createGain();
      oscGain.gain.value = 0.02;

      osc1 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.value = 60;

      osc2 = ctx.createOscillator();
      osc2.type = 'square';
      osc2.frequency.value = 90;

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(oscGain);
      oscGain.connect(master);
      osc1.start();
      osc2.start();

      // pre-render a short white-noise buffer for crash sounds
      var len = Math.floor(ctx.sampleRate * 0.25);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    } catch (e) {
      ctx = null;
      return false;
    }
    return true;
  }

  return {
    /* call from a user gesture (race start) */
    start: function () {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
    },

    /* speedRatio 0..1, throttle 0|1 — call every frame */
    update: function (speedRatio, throttle) {
      if (!ctx) return;
      var t = ctx.currentTime;
      var freq = 55 + speedRatio * speedRatio * 300 + throttle * 22;
      osc1.frequency.setTargetAtTime(freq, t, 0.06);
      osc2.frequency.setTargetAtTime(freq * 1.5 + 5, t, 0.06);
      filter.frequency.setTargetAtTime(400 + 3200 * speedRatio, t, 0.1);
      oscGain.gain.setTargetAtTime(0.02 + 0.07 * speedRatio + 0.05 * throttle, t, 0.1);
    },

    crash: function () {
      if (!ctx) return;
      var now = performance.now();
      if (now - lastCrash < 250) return;   // don't machine-gun the effect
      lastCrash = now;
      var src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      var g = ctx.createGain();
      g.gain.value = 0.6;
      src.connect(g);
      g.connect(master);
      src.start();
    },

    toggleMute: function () {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },

    isMuted: function () { return muted; }
  };
})();
