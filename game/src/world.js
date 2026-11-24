// The city of Solmar Bay: a road grid, the blocks between the roads, the
// buildings and parks that fill them, and the beach along the south shore.
// Pure data in, pure data out — no drawing and no browser in here — plus the
// collision helpers the player, cars and AI all share.
import { CFG } from './config.js';

function roadCenters(first, spacing, max) {
  const out = [];
  for (let v = first; v <= max; v += spacing) out.push(v);
  return out;
}

export function createWorld(rng) {
  const W = CFG.WORLD_W;
  const H = CFG.WORLD_H;
  const roadsV = roadCenters(CFG.ROAD_FIRST, CFG.ROAD_SPACING, W - CFG.ROAD_FIRST);
  const roadsH = roadCenters(CFG.ROAD_FIRST, CFG.ROAD_SPACING, H - CFG.ROAD_FIRST - 300);
  const half = CFG.ROAD_W / 2;

  const buildings = [];
  const parks = [];
  const parkingLots = [];

  // Every block is the rectangle between four roads (or the city edge).
  const xs = [0, ...roadsV.map((x) => x + half), W];
  const ys = [0, ...roadsH.map((y) => y + half), H - 300];
  const xEdges = [0];
  for (const x of roadsV) xEdges.push(x - half, x + half);
  xEdges.push(W);
  const yEdges = [0];
  for (const y of roadsH) yEdges.push(y - half, y + half);
  yEdges.push(H - 300);

  // Walk the block grid between neighbouring road edges.
  for (let bi = 0; bi + 1 < xEdges.length; bi += 2) {
    const bx0 = xEdges[bi];
    const bx1 = xEdges[bi + 1];
    if (bx1 - bx0 < 200) continue;
    for (let bj = 0; bj + 1 < yEdges.length; bj += 2) {
      const by0 = yEdges[bj];
      const by1 = yEdges[bj + 1];
      if (by1 - by0 < 200) continue;
      const roll = rng.next();
      if (roll < 0.18) {
        // Park: grass and a scatter of trees.
        const trees = [];
        const n = rng.int(5, 10);
        for (let t = 0; t < n; t += 1) {
          trees.push({ x: rng.range(bx0 + 30, bx1 - 30), y: rng.range(by0 + 30, by1 - 30), r: rng.range(14, 24) });
        }
        parks.push({ x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0, trees });
      } else if (roll < 0.3) {
        // Parking lot: flat asphalt with painted bays, where parked cars live.
        parkingLots.push({ x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 });
      } else {
        // Buildings: one to three roofed blocks with a margin from the road.
        const count = rng.int(1, 3);
        const bw = (bx1 - bx0 - 60) / (count > 1 ? 2 : 1);
        for (let b = 0; b < count; b += 1) {
          const col = b % 2;
          const row = Math.floor(b / 2);
          const w = rng.range(bw * 0.55, bw * 0.9);
          const h = rng.range(90, Math.min(200, by1 - by0 - 60));
          const x = bx0 + 30 + col * bw + rng.range(0, Math.max(0, bw - w));
          const y = by0 + 30 + row * 140 + rng.range(0, 20);
          if (x + w > bx1 - 20 || y + h > by1 - 20) continue;
          buildings.push({
            x, y, w, h,
            color: rng.pick(CFG.COLORS.buildingRoof),
            roof: rng.chance(0.5),
          });
        }
      }
    }
  }

  // Named places the story and the missions point at.
  const places = {
    docks: { x: 4470, y: 300, label: 'Marina Docks' },
    safehouse: { x: 330, y: 2730, label: 'Rook\u2019s Safehouse' },
    market: { x: 2430, y: 1530, label: 'Solmar Market' },
    hospital: { x: 1530, y: 930, label: 'Bay General' },
    plaza: { x: 2130, y: 2130, label: 'Plaza del Sol' },
  };
  const spawn = { x: 900, y: 900 };

  return { W, H, roadsV, roadsH, half, buildings, parks, parkingLots, places, spawn, beachY: H - 300 };
}

export function isOnRoad(world, x, y) {
  const { half } = world;
  for (const rx of world.roadsV) if (Math.abs(x - rx) <= half) return true;
  for (const ry of world.roadsH) if (Math.abs(y - ry) <= half) return true;
  return false;
}

// Nearest point on a road centreline, used to snap spawned cars onto lanes.
export function nearestRoadPoint(world, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of world.roadsV) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y, vertical: true }; }
  }
  for (const ry of world.roadsH) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry, vertical: false }; }
  }
  return best;
}

export function buildingAt(world, x, y) {
  for (const b of world.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

// Circle-vs-buildings test; returns the building hit, if any.
export function circleHitsBuilding(world, x, y, r) {
  for (const b of world.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return b;
  }
  return null;
}

// Push a circle out of a building it overlaps; returns true when it pushed.
export function resolveBuildingCollision(world, obj, r) {
  const b = circleHitsBuilding(world, obj.x, obj.y, r);
  if (!b) return false;
  const cx = Math.max(b.x, Math.min(obj.x, b.x + b.w));
  const cy = Math.max(b.y, Math.min(obj.y, b.y + b.h));
  let dx = obj.x - cx;
  let dy = obj.y - cy;
  const d = Math.hypot(dx, dy);
  if (d < 0.01) {
    // Dead centre: push out along the smallest penetration axis.
    const left = obj.x - b.x;
    const right = b.x + b.w - obj.x;
    const top = obj.y - b.y;
    const bottom = b.y + b.h - obj.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) obj.x = b.x - r;
    else if (m === right) obj.x = b.x + b.w + r;
    else if (m === top) obj.y = b.y - r;
    else obj.y = b.y + b.h + r;
    return true;
  }
  dx /= d;
  dy /= d;
  obj.x = cx + dx * r;
  obj.y = cy + dy * r;
  return true;
}

export function clampToWorld(world, obj, margin) {
  obj.x = Math.max(margin, Math.min(world.W - margin, obj.x));
  obj.y = Math.max(margin, Math.min(world.H - margin, obj.y));
}
