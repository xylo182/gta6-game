// The screenshot scenes behind ?shot=start|drive|chase|street. Each one sets
// the game to a real, busy moment — a title vista, a drive, a police chase,
// a downtown street — then the caller plays it forward a fixed number of
// steps with fixed keys, so the frame is what a short game really looks like
// and the same seed always gives the same frame.
import { CFG } from './config.js';
import { startMission } from './missions.js';
import { spawnPoliceCar } from './police.js';

function putPlayerInCar(state, x, y, angle, speed) {
  // Take the nearest parked car and put the player behind its wheel.
  let best = null;
  let bestD = Infinity;
  for (const car of state.cars) {
    if (car.driver !== 'parked') continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) return null;
  best.driver = 'player';
  best.x = x;
  best.y = y;
  best.angle = angle;
  best.speed = speed;
  state.player.car = best;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
  return best;
}

// Pull a few traffic cars and pedestrians onto the roads around the player,
// so the frame is busy even when the global spawn put them elsewhere.
// Traffic stays off the player's own lane (avoid 'h' skips the horizontal
// road through the player, 'v' the vertical one); pedestrians go on the
// sidewalks, never in the player's path.
function crowdTheFrame(state, cx, cy, avoid) {
  const traffic = state.cars.filter((c) => c.driver === 'traffic');
  const spots = avoid === 'h'
    ? [
        { x: cx - 500, y: cy - 600, angle: 0 },
        { x: cx + 480, y: cy - 600, angle: Math.PI },
        { x: cx - 520, y: cy + 600, angle: 0 },
        { x: cx + 500, y: cy + 600, angle: Math.PI },
        { x: cx - 600, y: cy - 600, angle: Math.PI / 2 },
        { x: cx + 600, y: cy + 600, angle: -Math.PI / 2 },
      ]
    : avoid === 'v'
      ? [
          { x: cx - 600, y: cy - 600, angle: 0 },
          { x: cx + 600, y: cy - 600, angle: Math.PI },
          { x: cx - 600, y: cy + 600, angle: 0 },
          { x: cx + 600, y: cy + 600, angle: Math.PI },
          { x: cx - 600, y: cy - 600, angle: Math.PI / 2 },
          { x: cx + 600, y: cy + 600, angle: -Math.PI / 2 },
        ]
      : [
          { x: cx - 420, y: cy, angle: 0 },
          { x: cx + 380, y: cy, angle: Math.PI },
          { x: cx - 260, y: cy - 70, angle: 0 },
          { x: cx + 520, y: cy + 70, angle: Math.PI },
          { x: cx, y: cy - 420, angle: Math.PI / 2 },
          { x: cx, y: cy + 380, angle: -Math.PI / 2 },
        ];
  for (let i = 0; i < Math.min(spots.length, traffic.length); i += 1) {
    const car = traffic[i];
    const s = spots[i];
    car.x = s.x;
    car.y = s.y;
    car.angle = s.angle;
    car.speed = car.cruise;
  }
  // Sidewalk spots: 96px off a road centreline, along both roads.
  const pedSpots = [
    { x: cx - 260, y: cy + 96 }, { x: cx - 120, y: cy + 96 }, { x: cx + 140, y: cy + 96 },
    { x: cx + 300, y: cy + 96 }, { x: cx - 200, y: cy - 96 }, { x: cx + 220, y: cy - 96 },
    { x: cx + 96, y: cy - 260 }, { x: cx + 96, y: cy + 240 }, { x: cx - 96, y: cy - 180 },
    { x: cx - 96, y: cy + 300 },
  ];
  const peds = state.peds;
  for (let i = 0; i < Math.min(pedSpots.length, peds.length); i += 1) {
    const ped = peds[i];
    ped.x = pedSpots[i].x;
    ped.y = pedSpots[i].y;
    ped.down = false;
  }
}

export function stageShot(state, name) {
  const p = state.player;
  if (name === 'drive') {
    // Mid-drive on Bay Avenue, first job live, traffic all around.
    putPlayerInCar(state, 1500, 1500, 0, 200);
    startMission(state, 0);
    crowdTheFrame(state, p.x, p.y, 'h');
    state.camera.snapTo(p.x - 120, p.y);
    state.screen = 'playing';
    return { screen: 'playing', ticks: 90, keys: ['KeyW'] };
  }
  if (name === 'chase') {
    // Three stars, three cruisers on the tail, safehouse run live.
    putPlayerInCar(state, 1500, 2100, 0, 380);
    startMission(state, 2);
    crowdTheFrame(state, p.x, p.y, 'h');
    for (let i = 0; i < 3; i += 1) {
      const cruiser = spawnPoliceCar(state.world, state.rng, p.x - 260 - i * 120, p.y + (i - 1) * 90);
      state.cars.push(cruiser);
    }
    state.camera.snapTo(p.x - 120, p.y);
    state.screen = 'playing';
    return { screen: 'playing', ticks: 120, keys: ['KeyW'] };
  }
  if (name === 'street') {
    // On foot on a downtown corner, pedestrians and traffic passing.
    p.x = 2100 - 96;
    p.y = 1500 - 96;
    p.angle = Math.PI / 4;
    p.car = null;
    startMission(state, 0);
    crowdTheFrame(state, 2100, 1500);
    state.camera.snapTo(2100, 1500);
    state.screen = 'playing';
    return { screen: 'playing', ticks: 260, keys: [] };
  }
  // Default: the title vista over a downtown crossing, the city alive behind it.
  p.x = 1800;
  p.y = 1500;
  p.angle = -Math.PI / 2;
  p.car = null;
  crowdTheFrame(state, p.x, p.y);
  state.camera.snapTo(p.x, p.y);
  state.screen = 'title';
  return { screen: 'title', ticks: 300, keys: [] };
}
