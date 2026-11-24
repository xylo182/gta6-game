// Traffic and pedestrians: the city feeling alive. Traffic cars cruise
// their road lane and wrap at the city edge; pedestrians stroll the
// sidewalks and turn at intersections. Both keep a little distance from the
// car ahead, and pedestrians scatter when a car bears down on them.
import { CFG } from './config.js';
import { carsTouch, driveCar, makeCar, separateCars } from './vehicles.js';
import { clampToWorld, nearestRoadPoint } from './world.js';

export function spawnTraffic(world, rng) {
  const cars = [];
  for (let i = 0; i < CFG.TRAFFIC_COUNT; i += 1) {
    const vertical = rng.chance(0.5);
    const road = vertical
      ? rng.pick(world.roadsV)
      : rng.pick(world.roadsH);
    const along = rng.range(100, (vertical ? world.H : world.W) - 100);
    const lane = (rng.chance(0.5) ? -1 : 1) * 35;
    const dir = rng.chance(0.5) ? 1 : -1;
    const x = vertical ? road + lane : along;
    const y = vertical ? along : road + lane;
    const angle = vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const color = rng.chance(0.12) ? CFG.COLORS.taxi : rng.pick(CFG.COLORS.car);
    const car = makeCar(x, y, angle, {
      color,
      kind: rng.chance(0.12) ? 'taxi' : 'sedan',
      driver: 'traffic',
      axis: vertical ? 'v' : 'h',
      dir,
      cruise: rng.range(CFG.TRAFFIC_SPEED_MIN, CFG.TRAFFIC_SPEED_MAX),
      lane,
    });
    car.speed = car.cruise;
    cars.push(car);
  }
  return cars;
}

export function spawnParked(world, rng) {
  const cars = [];
  for (let i = 0; i < CFG.PARKED_COUNT; i += 1) {
    const vertical = rng.chance(0.5);
    const road = vertical ? rng.pick(world.roadsV) : rng.pick(world.roadsH);
    const along = rng.range(200, (vertical ? world.H : world.W) - 200);
    const side = rng.chance(0.5) ? -1 : 1;
    const x = vertical ? road + side * 52 : along;
    const y = vertical ? along : road + side * 52;
    const angle = vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
    cars.push(makeCar(x, y, angle, {
      color: rng.pick(CFG.COLORS.car),
      kind: 'sedan',
      driver: 'parked',
    }));
  }
  // A few more in the parking lots, angled into their bays.
  for (const lot of world.parkingLots.slice(0, 4)) {
    for (let i = 0; i < 2; i += 1) {
      cars.push(makeCar(
        lot.x + 60 + i * 90 + rng.range(-10, 10),
        lot.y + lot.h / 2 + rng.range(-30, 30),
        rng.chance(0.5) ? 0 : Math.PI,
        { color: rng.pick(CFG.COLORS.car), kind: 'sedan', driver: 'parked' },
      ));
    }
  }
  return cars;
}

export function spawnPedestrians(world, rng) {
  const peds = [];
  const shirts = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#fd79a8'];
  for (let i = 0; i < CFG.PED_COUNT; i += 1) {
    const vertical = rng.chance(0.5);
    const road = vertical ? rng.pick(world.roadsV) : rng.pick(world.roadsH);
    const along = rng.range(100, (vertical ? world.H : world.W) - 100);
    const side = rng.chance(0.5) ? -1 : 1;
    const x = vertical ? road + side * 96 : along;
    const y = vertical ? along : road + side * 96;
    peds.push({
      x, y,
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(CFG.PED_SPEED_MIN, CFG.PED_SPEED_MAX),
      color: rng.pick(shirts),
      vertical,
      dir: rng.chance(0.5) ? 1 : -1,
      side,
      panic: 0,
      wander: rng.range(2, 6),
    });
  }
  return peds;
}

// One traffic step: cruise the lane, ease off behind the car ahead, wrap at
// the edge of the city, and never drive through a building.
export function updateTraffic(world, cars, dt) {
  for (const car of cars) {
    if (car.driver !== 'traffic' || car.wrecked) continue;
    // Ease off when another car is close ahead on the same lane.
    let ahead = Infinity;
    for (const other of cars) {
      if (other === car || other.wrecked) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const forward = car.axis === 'h' ? dx * car.dir : dy * car.dir;
      const lateral = car.axis === 'h' ? Math.abs(dy) : Math.abs(dx);
      if (forward > 0 && forward < 90 && lateral < 40) ahead = Math.min(ahead, forward);
    }
    const target = ahead < 70 ? Math.max(0, car.cruise * (ahead / 90)) : car.cruise;
    car.speed += (target - car.speed) * Math.min(1, dt * 2);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Wrap around the far edge so the streets never empty out.
    if (car.axis === 'h') {
      if (car.x > world.W + 60) car.x = -60;
      if (car.x < -60) car.x = world.W + 60;
    } else {
      if (car.y > world.H + 60) car.y = -60;
      if (car.y < -60) car.y = world.H + 60;
    }
  }
  // Keep touching cars from overlapping.
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      if (a.wrecked || b.wrecked) continue;
      if (carsTouch(a, b)) separateCars(a, b);
    }
  }
}

export function updatePedestrians(world, peds, threat, rng, dt) {
  for (const ped of peds) {
    ped.wander -= dt;
    // A fast car nearby sends them running for the sidewalk's far side.
    let fleeX = 0;
    let fleeY = 0;
    if (threat) {
      const dx = ped.x - threat.x;
      const dy = ped.y - threat.y;
      const d = Math.hypot(dx, dy);
      if (d < 130 && Math.abs(threat.speed) > 150) {
        ped.panic = 1.2;
        fleeX = dx / (d || 1);
        fleeY = dy / (d || 1);
      }
    }
    if (ped.panic > 0) {
      ped.panic -= dt;
      ped.x += fleeX * 190 * dt;
      ped.y += fleeY * 190 * dt;
      ped.angle = Math.atan2(fleeY, fleeX);
    } else {
      if (ped.wander <= 0) {
        ped.wander = rng.range(2, 6);
        // At an intersection, sometimes turn onto the cross street.
        if (rng.chance(0.45)) {
          ped.vertical = !ped.vertical;
          const p = nearestRoadPoint(world, ped.x, ped.y);
          if (p) {
            if (ped.vertical) { ped.x = p.x + ped.side * 96; }
            else { ped.y = p.y + ped.side * 96; }
          }
        } else if (rng.chance(0.3)) {
          ped.dir *= -1;
        }
      }
      const step = ped.speed * dt;
      if (ped.vertical) {
        ped.y += ped.dir * step;
        ped.angle = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        ped.x += ped.dir * step;
        ped.angle = ped.dir > 0 ? 0 : Math.PI;
      }
    }
    clampToWorld(world, ped, 60);
  }
}
