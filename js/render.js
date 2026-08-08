/* render.js — classic segment-based pseudo-3D renderer. The road is a list of
   segments with world (x, y, z); each frame we walk drawDistance segments from
   the camera, project them to screen space, accumulate curve offsets, and
   paint road/grass/rumble polygons back-to-front with a hill-clipping line
   (maxy). Sprites and cars are then drawn far-to-near so nearer things cover
   farther ones. */
'use strict';

var Renderer = (function () {
  var W = 0, H = 0;

  function resize(w, h) { W = w; H = h; }

  function project(p, cameraX, cameraY, cameraZ) {
    p.camera.x = (p.world.x || 0) - cameraX;
    p.camera.y = (p.world.y || 0) - cameraY;
    p.camera.z = (p.world.z || 0) - cameraZ;
    p.screen.scale = CFG.cameraDepth / Math.max(p.camera.z, 1);
    p.screen.x = Math.round((W / 2) + (p.screen.scale * p.camera.x * W / 2));
    p.screen.y = Math.round((H / 2) - (p.screen.scale * p.camera.y * H / 2));
    p.screen.w = Math.round(p.screen.scale * CFG.roadWidth * W / 2);
  }

  function polygon(ctx, x1, y1, x2, y2, x3, y3, x4, y4, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.closePath();
    ctx.fill();
  }

  function renderSegment(ctx, game, x1, y1, w1, x2, y2, w2, fog, colorKey) {
    var pal = game.track.palette[colorKey];
    ctx.fillStyle = pal.grass;
    ctx.fillRect(0, y2, W, y1 - y2);

    var r1 = w1 / 6, r2 = w2 / 6;
    polygon(ctx, x1 - w1 - r1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - r2, y2, pal.rumble);
    polygon(ctx, x1 + w1 + r1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 + r2, y2, pal.rumble);
    polygon(ctx, x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2, pal.road);

    if (colorKey === 'light' && pal.lane) {
      var lw1 = (w1 * 2) / CFG.lanes, lw2 = (w2 * 2) / CFG.lanes;
      var mw1 = Math.max(1, w1 / 40), mw2 = Math.max(1, w2 / 40);
      for (var lane = 1; lane < CFG.lanes; lane++) {
        var lx1 = x1 - w1 + lane * lw1, lx2 = x2 - w2 + lane * lw2;
        polygon(ctx, lx1 - mw1, y1, lx1 + mw1, y1, lx2 + mw2, y2, lx2 - mw2, y2, pal.lane);
      }
    }

    if (fog < 1) {
      ctx.globalAlpha = 1 - fog;
      ctx.fillStyle = game.track.palette.fog;
      ctx.fillRect(0, y2, W, y1 - y2);
      ctx.globalAlpha = 1;
    }
  }

  /* draw an offscreen-canvas sprite scaled by projection, bottom-anchored at
     (destX, destY), with the part below clipY hidden (hill occlusion) */
  function drawScaled(ctx, img, frac, scale, destX, destY, clipY) {
    var destW = frac * scale * CFG.roadWidth * (W / 2);
    var destH = destW * (img.height / img.width);
    var dx = destX - destW / 2;
    var dy = destY - destH;
    var clipH = clipY ? Math.max(0, dy + destH - clipY) : 0;
    if (clipH >= destH) return;
    if (clipH > 0) {
      var srcH = img.height * (destH - clipH) / destH;
      ctx.drawImage(img, 0, 0, img.width, srcH, dx, dy, destW, destH - clipH);
    } else {
      ctx.drawImage(img, dx, dy, destW, destH);
    }
  }

  function drawBackground(ctx, game) {
    var sky = game.track.sky;
    var horizon = H / 2;

    var g = ctx.createLinearGradient(0, 0, 0, horizon);
    g.addColorStop(0, sky.top);
    g.addColorStop(0.7, sky.mid);
    g.addColorStop(1, sky.horizon);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, horizon + 1);

    // sun / moon with a soft glow
    var sx = W * sky.sunX + game.skyOff * 30, sy = H * sky.sunY, sr = H * 0.055;
    var glow = ctx.createRadialGradient(sx, sy, sr * 0.4, sx, sy, sr * 2.4);
    glow.addColorStop(0, sky.sun);
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sx - sr * 2.4, sy - sr * 2.4, sr * 4.8, sr * 4.8);
    ctx.fillStyle = sky.sun;
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, 7); ctx.fill();

    // parallax strips, bottom edge on the horizon
    var offsets = [game.farOff, game.nearOff];
    for (var i = 0; i < game.background.length; i++) {
      var layer = game.background[i];
      var img = layer.img;
      var off = ((offsets[i] * layer.speed * 8) % 1) * img.width;
      var y = horizon - img.height;
      ctx.drawImage(img, -off, y);
      ctx.drawImage(img, -off + img.width, y);
    }

    // base ground colour below the horizon (furthest segments paint over it)
    ctx.fillStyle = game.track.palette.dark.grass;
    ctx.fillRect(0, horizon, W, H - horizon);
  }

  function drawRoad(ctx, game) {
    var segments = game.segments, N = segments.length;
    var baseSegment = Util.findSegment(segments, game.position);
    var basePercent = Util.percentRemaining(game.position, CFG.segmentLength);
    var playerSegment = Util.findSegment(segments, game.position + CFG.playerZ);
    var playerPercent = Util.percentRemaining(game.position + CFG.playerZ, CFG.segmentLength);
    var playerY = Util.interpolate(playerSegment.p1.world.y, playerSegment.p2.world.y, playerPercent);

    var maxy = H;
    var x = 0, dx = -(baseSegment.curve * basePercent);
    var n, segment, i;

    for (n = 0; n < CFG.drawDistance; n++) {
      segment = segments[(baseSegment.index + n) % N];
      segment.looped = segment.index < baseSegment.index;
      segment.fog = Util.exponentialFog(n / CFG.drawDistance, CFG.fogDensity);
      segment.clip = maxy;
      var camZ = game.position - (segment.looped ? game.trackLength : 0);
      project(segment.p1, (game.playerX * CFG.roadWidth) - x, playerY + CFG.cameraHeight, camZ);
      project(segment.p2, (game.playerX * CFG.roadWidth) - x - dx, playerY + CFG.cameraHeight, camZ);
      x += dx;
      dx += segment.curve;
      segment.visible = !((segment.p1.camera.z <= CFG.cameraDepth) ||
                          (segment.p2.screen.y >= segment.p1.screen.y) ||
                          (segment.p2.screen.y >= maxy));
      if (!segment.visible) continue;
      renderSegment(ctx, game,
        segment.p1.screen.x, segment.p1.screen.y, segment.p1.screen.w,
        segment.p2.screen.x, segment.p2.screen.y, segment.p2.screen.w,
        segment.fog, segment.color);
      maxy = segment.p1.screen.y;
    }

    // sprites and cars, far to near
    for (n = CFG.drawDistance - 1; n > 0; n--) {
      segment = segments[(baseSegment.index + n) % N];
      if (!segment.visible || segment.p1.camera.z <= CFG.cameraDepth) continue;

      for (i = 0; i < segment.sprites.length; i++) {
        var sp = segment.sprites[i];
        var def = Sprites.OBJECT_DEFS[sp.type];
        var img = game.objectSprites[sp.type];
        if (!img) continue;
        var sScale = segment.p1.screen.scale;
        var sX = segment.p1.screen.x + sScale * sp.offset * CFG.roadWidth * (W / 2);
        drawScaled(ctx, img, def.frac, sScale, sX, segment.p1.screen.y, segment.clip);
      }

      var cars = game.segmentCars[segment.index];
      if (cars) {
        for (i = 0; i < cars.length; i++) {
          var car = cars[i];
          var pct = Util.percentRemaining(car.z, CFG.segmentLength);
          var cScale = Util.interpolate(segment.p1.screen.scale, segment.p2.screen.scale, pct);
          var cX = Util.interpolate(segment.p1.screen.x, segment.p2.screen.x, pct) +
                   cScale * car.offset * CFG.roadWidth * (W / 2);
          var cY = Util.interpolate(segment.p1.screen.y, segment.p2.screen.y, pct);
          drawScaled(ctx, game.carSprites[car.color], Sprites.CAR_FRAC, cScale, cX, cY, segment.clip);
        }
      }
    }
  }

  function drawPlayerCar(ctx, game) {
    var cw = Math.min(W * 0.24, 330);
    var ch = cw * 0.6;
    var speedRatio = game.speed / CFG.maxSpeed;
    var bounce = speedRatio * (game.offroad ? 7 : 2.5);
    var cx = W / 2;
    var cy = H - ch * 0.28 + (Math.random() - 0.5) * bounce;
    var steer = (game.input.right ? 1 : 0) - (game.input.left ? 1 : 0);
    var tilt = steer * 0.035 * (0.3 + speedRatio);

    // headlight beams on the night track
    if (game.track.sky.night) {
      var beam = ctx.createRadialGradient(cx, cy - ch * 0.3, 10, cx, cy - ch * 0.3, H * 0.5);
      beam.addColorStop(0, 'rgba(255,240,180,0.16)');
      beam.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = beam;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilt);
    ctx.translate(-steer * cw * 0.03, 0);
    ctx.scale(cw / 300, ch / 180);   // draw in a 300x180 design space

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(150, 168, 138, 14, 0, 0, 7); ctx.fill();
    // wheels
    ctx.fillStyle = '#0c0c0c';
    rr(ctx, 18, 104, 48, 70, 12);
    rr(ctx, 234, 104, 48, 70, 12);
    // body — lower skirt then main shell
    ctx.fillStyle = '#8f1218';
    rr(ctx, 12, 118, 276, 44, 14);
    ctx.fillStyle = '#d22630';
    rr(ctx, 12, 74, 276, 64, 18);
    // cabin + rear glass
    ctx.fillStyle = '#b11c24';
    rr(ctx, 62, 26, 176, 62, 16);
    ctx.fillStyle = '#16202c';
    rr(ctx, 76, 34, 148, 44, 10);
    // spoiler
    ctx.fillStyle = '#7a0e14';
    ctx.fillRect(46, 8, 208, 14);
    ctx.fillRect(62, 20, 14, 20);
    ctx.fillRect(224, 20, 14, 20);
    // taillights glow harder under braking
    ctx.fillStyle = game.input.down ? '#ff8078' : '#ff3b30';
    rr(ctx, 26, 96, 62, 18, 6);
    rr(ctx, 212, 96, 62, 18, 6);
    if (game.input.down) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#ff5040';
      ctx.beginPath(); ctx.ellipse(57, 105, 46, 22, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(243, 105, 46, 22, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // exhaust flame flicker while accelerating
    if (game.input.up && speedRatio < 0.98) {
      ctx.fillStyle = 'rgba(255,' + (140 + Math.floor(Math.random() * 80)) + ',40,0.85)';
      var fl = 8 + Math.random() * 12;
      ctx.beginPath(); ctx.ellipse(128, 162, 7, fl, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(172, 162, 7, fl, 0, 0, 7); ctx.fill();
    }
    // exhausts
    ctx.fillStyle = '#c8c8c8';
    ctx.beginPath(); ctx.arc(128, 158, 8, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(172, 158, 8, 0, 7); ctx.fill();

    ctx.restore();

    function rr(c, x, y, w, h, r) {
      c.beginPath();
      c.moveTo(x + r, y);
      c.lineTo(x + w - r, y);
      c.arcTo(x + w, y, x + w, y + r, r);
      c.lineTo(x + w, y + h - r);
      c.arcTo(x + w, y + h, x + w - r, y + h, r);
      c.lineTo(x + r, y + h);
      c.arcTo(x, y + h, x, y + h - r, r);
      c.lineTo(x, y + r);
      c.arcTo(x, y, x + r, y, r);
      c.closePath();
      c.fill();
    }
  }

  function draw(ctx, game) {
    if (!game.track) return;
    ctx.save();
    if (game.shake > 0.01) {
      ctx.translate((Math.random() - 0.5) * game.shake * 26,
                    (Math.random() - 0.5) * game.shake * 18);
    }
    drawBackground(ctx, game);
    drawRoad(ctx, game);
    drawPlayerCar(ctx, game);
    ctx.restore();
  }

  return { resize: resize, draw: draw };
})();
