// Cars: creation, arcade driving physics, and collisions. A car is plain
// data; driveCar advances one step from throttle/steer input, and the same
// update runs for the player's car, traffic and police — only the driver
// feeding the inputs differs.
import { CFG } from './config.js';
import { clampToWorld, resolveBuildingCollision } from './world.js';

let nextCarId = 1;

export function makeCar(x, y, angle, opts = {}) {
  return {
    id: nextCarId,
    x, y, angle,
    speed: 0,
    color: opts.color || '#c0392b',
    kind: opts.kind || 'sedan', // sedan | taxi | truck | police
    driver: opts.driver || 'parked', // parked | traffic | police | player
    // Traffic AI state.
    axis: opts.axis || 'h', // 'h' drives along x, 'v' along y
    dir: opts.dir || 1,
    cruise: opts.cruise || 160,
    lane: opts.lane || 0,
    honk: 0,
    wrecked: false,
  };
}

// Arcade car physics: throttle accelerates, steering turns harder the faster
// the car goes (up to a point), drag bleeds speed when coasting.
export function driveCar(world, car, throttle, steer, dt) {
  const maxFwd = car.kind === 'police' ? CFG.POLICE_MAX_SPEED : CFG.CAR_MAX_SPEED;
  if (throttle > 0) car.speed += CFG.CAR_ACCEL * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 5) car.speed -= CFG.CAR_BRAKE * dt;
    else car.speed += CFG.CAR_ACCEL * 0.55 * throttle * dt; // reversing
  } else {
    car.speed -= car.speed * CFG.CAR_DRAG * dt;
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  car.speed = Math.max(-CFG.CAR_REVERSE_MAX, Math.min(maxFwd, car.speed));
  const turnRate = CFG.CAR_TURN * Math.min(1, Math.abs(car.speed) / 260) * Math.sign(car.speed || 1);
  car.angle += steer * turnRate * dt;
  const prevX = car.x;
  const prevY = car.y;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  clampToWorld(world, car, 30);
  if (resolveBuildingCollision(world, car, CFG.CAR_LEN * 0.42)) {
    // A scrape, not a stop: keep some speed, lose the rest.
    if (Math.abs(car.speed) > 120) car.speed *= 0.45;
    else car.speed *= 0.7;
  }
  return { prevX, prevY };
}

// Cheap circle test for car-vs-car contact, used by traffic and police.
// Radius 44 keeps two 48-long cars from ever drawing on top of each other.
export function carsTouch(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = 44;
  return dx * dx + dy * dy < r * r;
}

// Separate two touching cars along the line between them.
export function separateCars(a, b) {
  let dx = a.x - b.x;
  let dy = a.y - b.y;
  let d = Math.hypot(dx, dy);
  if (d < 0.01) { dx = 1; dy = 0; d = 1; }
  const push = (44 - d) / 2;
  if (push <= 0) return;
  dx /= d;
  dy /= d;
  a.x += dx * push;
  a.y += dy * push;
  b.x -= dx * push;
  b.y -= dy * push;
}
