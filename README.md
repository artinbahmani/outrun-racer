# outrun-racer

OutRun-style pseudo-3D arcade racer: curves, hills, traffic, rubber-band rivals, three tracks, synth engine audio. Canvas, no dependencies.

## Features

- Classic segment-based pseudo-3D road renderer: perspective projection, S-curves, hills with occlusion clipping, rumble strips, lane markers, distance fog
- Three hand-laid circuits: **Coral Coast** (palms, rolling hills), **Dune Run** (desert straights, big dunes), **Neon City** (night, buildings, tighter corners, neon rumble strips)
- Race against **5 AI opponents** with rubber-band pacing and traffic avoidance, plus **12 roaming traffic cars** to thread through
- Full car handling: acceleration, braking, steering, centrifugal push on curves, off-road slowdown, collisions with cars and roadside objects (with screen shake + crash sound)
- Race structure: countdown start, 3 laps, live position (P1–P6), lap timer with last/best lap — best lap per track persists in `localStorage`
- Procedural everything: roadside objects (palms, cacti, rocks, signs, billboards, buildings), rival cars and parallax background strips are all generated on offscreen canvases at load — zero image assets
- Synthesized engine sound: two detuned oscillators + lowpass filter, pitch and filter cutoff tied to speed; noise-burst crash effect; mute toggle
- Attract mode: the menu plays over a self-driving demo of the current track
- Keyboard + touch controls (on-screen gas/brake/steer on touch devices), pause, responsive HUD

## Run

Open `index.html` in any modern browser. No build step, no dependencies.

## Controls

- **↑ / W** — gas
- **↓ / S** — brake
- **← → / A D** — steer
- **P / Esc** — pause
- **M** — mute
- **1–3 / Enter** — quick-start a track from the menu
- Touch devices get on-screen GAS / BRAKE / steering buttons

## Tech notes

- The road is a flat list of segments with world `(x, y, z)`; each frame `drawDistance` segments are projected with `scale = cameraDepth / z`, curve offsets accumulate per segment, and a `maxy` clipping line hides anything behind hill crests
- Opponents race on accumulated distance, not segment index, so position tracking and rubber-banding stay correct across laps
- Sprites are scaled by `projection scale × road width`, so the same draw path handles roadside billboards and cars at any distance, with source-rect cropping for hill occlusion
- Engine pitch uses `speed²` mapping (~55–380 Hz) so the rev range feels nonlinear like a real gearbox, all inside one `setTargetAtTime`-smoothed WebAudio graph

## Roadmap

- Minimap with live dots for opponents and traffic
- Split gearing (manual/automatic) with shift points in the audio
- Championship mode: points across all three tracks, persistent standings
- Weather/time-of-day variants per track (rain streaks, dawn fog)
- Ghost replay of your best lap, stored in `localStorage`
- Gamepad support via the Gamepad API
