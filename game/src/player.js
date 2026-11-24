// The player on foot: walking, aiming, shooting, and getting in and out of
// cars. Driving itself lives in vehicles.js; this module is the person, and
// the handoff between the two.
import { CFG } from './config.js';
import { carsTouch } from './vehicles.js';
import { clampToWorld, resolveBuildingCollision } from './world.js';
import { setWanted, witnessed } from './police.js';

export function makePlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    health: CFG.PLAYER_HEALTH,
    cash: 0,
    ammo: CFG.PISTOL_AMMO_START,
    wanted: 0,
    car: null, // the car being driven, or null when on foot
    fireCooldown: 0,
    muzzle: 0,
    invulnerable: 0,
  };
}

export function nearestCar(state, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    if (car.wrecked) continue;
    if (car.driver === 'player') continue;
    const dist = Math.hypot(car.x - state.player.x, car.y - state.player.y);
    if (dist < bestD) { bestD = dist; best = car; }
  }
  return best;
}

// E near a car: climb in. Stealing in view of the law (or a bystander) heats
// the player up. E while driving: step out beside the car.
export function tryEnterExitCar(state) {
  const player = state.player;
  if (player.car) {
    const car = player.car;
    car.driver = 'parked';
    car.speed = 0;
    player.car = null;
    // Step out to the car's left, clear of the body.
    player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    clampToWorld(state.world, player, 20);
    return 'out';
  }
  const car = nearestCar(state, 70);
  if (!car) return null;
  const wasTraffic = car.driver === 'traffic';
  const seen = witnessed(state, car.x, car.y, 620);
  car.driver = 'player';
  car.speed = 0;
  player.car = car;
  player.x = car.x;
  player.y = car.y;
  if (seen || wasTraffic) {
    setWanted(state, Math.max(player.wanted, 1), 'Car stolen — the law is coming');
    state.audio.setSiren(true);
  }
  return 'in';
}

// One on-foot step: walk with WASD/arrows, face the mouse while the pistol
// is out, and fire on click.
export function updateOnFoot(state, input, camera, dt) {
  const player = state.player;
  const axes = input.axes();
  const mag = Math.hypot(axes.x, axes.y);
  if (mag > 0) {
    const nx = axes.x / mag;
    const ny = axes.y / mag;
    player.x += nx * CFG.WALK_SPEED * dt;
    player.y += ny * CFG.WALK_SPEED * dt;
    player.angle = Math.atan2(ny, nx);
  }
  clampToWorld(state.world, player, 20);
  resolveBuildingCollision(state.world, player, CFG.PLAYER_R);

  // Aim at the mouse; click fires the pistol.
  const worldMouse = camera.toWorld(input.mouse.x, input.mouse.y);
  player.angle = Math.atan2(worldMouse.y - player.y, worldMouse.x - player.x);
  if (player.fireCooldown > 0) player.fireCooldown -= dt;
  if (player.muzzle > 0) player.muzzle -= dt;
  if (input.takeClick() && player.fireCooldown <= 0 && player.ammo > 0) {
    player.ammo -= 1;
    player.fireCooldown = CFG.PISTOL_RATE;
    player.muzzle = 0.07;
    state.audio.shot();
    fireShot(state);
  }
  if (player.invulnerable > 0) player.invulnerable -= dt;
}

// A shot travels from the player along the aim angle; the first car or
// pedestrian it meets inside range takes the hit.
function fireShot(state) {
  const player = state.player;
  const dx = Math.cos(player.angle);
  const dy = Math.sin(player.angle);
  let best = null;
  let bestT = CFG.PISTOL_RANGE;
  const consider = (x, y, radius, target) => {
    const ox = x - player.x;
    const oy = y - player.y;
    const t = ox * dx + oy * dy;
    if (t < 0 || t > bestT) return;
    const perp = Math.abs(-ox * dy + oy * dx);
    if (perp < radius + 8) {
      bestT = t;
      best = target;
    }
  };
  for (const car of state.cars) {
    if (car.driver === 'player') continue;
    consider(car.x, car.y, 26, { kind: 'car', car });
  }
  for (const ped of state.peds) {
    consider(ped.x, ped.y, 12, { kind: 'ped', ped });
  }
  state.tracer = { x: player.x, y: player.y, angle: player.angle, len: best ? bestT : CFG.PISTOL_RANGE, t: 0.09 };
  if (!best) return;
  if (best.kind === 'car') {
    best.car.wrecked = true;
    best.car.speed = 0;
    best.car.driver = 'parked';
    state.particles.push({ x: best.car.x, y: best.car.y, kind: 'smoke', t: 0.9 });
    if (witnessed(state, best.car.x, best.car.y, 620)) {
      setWanted(state, Math.max(player.wanted, 2), 'Shots fired — police alerted');
    }
  } else {
    // A hit pedestrian goes down and stays down; the law notices.
    best.ped.down = true;
    best.ped.speed = 0;
    setWanted(state, Math.max(player.wanted, 2), 'Shots fired — police alerted');
  }
  state.audio.setSiren(player.wanted > 0);
}

// Cash, health and ammo lying on the street.
export function updatePickups(state, dt) {
  const player = state.player;
  for (const pk of state.pickups) {
    if (pk.taken) continue;
    const d = Math.hypot(pk.x - player.x, pk.y - player.y);
    if (d < 34) {
      pk.taken = true;
      if (pk.kind === 'cash') {
        player.cash += pk.value;
        state.toast = `+$${pk.value} picked up`;
        state.toastTimer = 1.6;
      } else if (pk.kind === 'health') {
        player.health = Math.min(CFG.PLAYER_HEALTH, player.health + 40);
        state.toast = 'Health +40';
        state.toastTimer = 1.6;
      } else if (pk.kind === 'ammo') {
        player.ammo += 18;
        state.toast = 'Ammo +18';
        state.toastTimer = 1.6;
      }
      state.audio.pickup();
    }
  }
  for (const pt of state.particles) pt.t -= dt;
  state.particles = state.particles.filter((p) => p.t > 0);
  if (state.tracer) {
    state.tracer.t -= dt;
    if (state.tracer.t <= 0) state.tracer = null;
  }
  if (state.toastTimer > 0) {
    state.toastTimer -= dt;
    if (state.toastTimer <= 0) state.toast = '';
  }
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);
}
