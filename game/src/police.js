// The wanted system and the Solmar Bay police. Stars rise when the player
// steals or shoots in view of the law, and fall again after a clean stretch
// out of sight. Police cruisers spawn on nearby roads, chase, and ram; on
// foot, a cruiser parked on the player for long enough ends in a bust.
import { CFG } from './config.js';
import { carsTouch, driveCar, makeCar, separateCars } from './vehicles.js';
import { nearestRoadPoint } from './world.js';

export function setWanted(state, level, reason) {
  const next = Math.max(0, Math.min(CFG.WANTED_MAX, level));
  if (next > state.player.wanted) {
    state.player.wanted = next;
    state.wantedTimer = 0;
    state.toast = reason || `Wanted level ${next}`;
    state.toastTimer = 2.5;
  } else {
    state.player.wanted = next;
  }
}

// How many cruisers the current heat should have on the street.
export function wantedCruisers(wanted) {
  return wanted <= 0 ? 0 : Math.min(wanted + 1, 5);
}

export function spawnPoliceCar(world, rng, nearX, nearY) {
  // Spawn on a road a little way from the player, facing roughly toward them.
  const angle = rng.range(0, Math.PI * 2);
  const x = nearX + Math.cos(angle) * CFG.POLICE_SPAWN_DIST;
  const y = nearY + Math.sin(angle) * CFG.POLICE_SPAWN_DIST;
  const p = nearestRoadPoint(world, x, y);
  const car = makeCar(p.x, p.y, Math.atan2(nearY - p.y, nearX - p.x), {
    color: CFG.COLORS.police,
    kind: 'police',
    driver: 'police',
    cruise: CFG.POLICE_MAX_SPEED,
  });
  car.speed = 200;
  return car;
}

// One police step: keep the right number of cruisers, steer each one at the
// player, ram when close, and track the bust timer on foot.
export function updatePolice(state, dt) {
  const player = state.player;
  const wanted = player.wanted;
  const police = state.cars.filter((c) => c.driver === 'police' && !c.wrecked);

  // Spawn up to the heat's cruiser count.
  const want = wantedCruisers(wanted);
  if (police.length < want) {
    const car = spawnPoliceCar(state.world, state.rng, player.x, player.y);
    state.cars.push(car);
    police.push(car);
  }
  // Heat off: extra cruisers give up and drive away as traffic.
  if (police.length > want) {
    const extra = police[police.length - 1];
    extra.driver = 'traffic';
    extra.axis = 'h';
    extra.dir = 1;
    extra.cruise = 170;
  }

  let nearest = Infinity;
  for (const car of police) {
    const dx = player.x - car.x;
    const dy = player.y - car.y;
    const dist = Math.hypot(dx, dy);
    nearest = Math.min(nearest, dist);
    // Steer toward the player, with a little wobble so they do not all
    // arrive on the same line.
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2.2));
    // On foot and caught: the cruiser brakes to a stop on the player so the
    // bust clock can run, instead of driving straight through them.
    const caughtOnFoot = !player.car && dist < 55;
    const throttle = caughtOnFoot ? 0 : (dist > 60 ? 1 : 0.4);
    driveCar(state.world, car, throttle, steer, dt);
    if (caughtOnFoot) car.speed *= Math.max(0, 1 - dt * 6);
    // Ramming: a cruiser touching the player's car damages it and shoves it.
    if (player.car && carsTouch(car, player.car)) {
      separateCars(car, player.car);
      player.car.speed *= 0.82;
      if (state.ramCooldown <= 0) {
        player.health -= 6;
        state.ramCooldown = 0.7;
        state.audio.crash();
        state.shake = 5;
      }
    }
    // On foot, a cruiser sitting on the player runs the bust clock.
    if (!player.car && dist < 46) {
      state.bustTimer += dt;
      if (state.bustTimer >= CFG.BUST_HOLD_SECONDS) {
        state.screen = 'busted';
        state.audio.busted();
      }
    }
  }
  if (nearest > 46 || player.car) state.bustTimer = Math.max(0, state.bustTimer - dt * 2);
  if (state.ramCooldown > 0) state.ramCooldown -= dt;

  // Wanted decay: a clean stretch with no cruiser in sight cools the heat.
  if (wanted > 0) {
    if (nearest > 720) {
      state.wantedTimer += dt;
      if (state.wantedTimer >= CFG.WANTED_DECAY_SECONDS) {
        state.wantedTimer = 0;
        setWanted(state, wanted - 1);
        if (player.wanted === 0) state.toast = 'You lost them. Heat is off.';
      }
    } else {
      state.wantedTimer = 0;
    }
  }
}

// Did anyone in uniform (or any bystander) see the crime?
export function witnessed(state, x, y, radius) {
  for (const car of state.cars) {
    if (car.driver !== 'police') continue;
    if (Math.hypot(car.x - x, car.y - y) < radius) return true;
  }
  for (const ped of state.peds) {
    if (Math.hypot(ped.x - x, ped.y - y) < radius * 0.45) return true;
  }
  return false;
}
