// The camera and every pixel of the world: streets, blocks, buildings,
// the beach, cars, pedestrians, the player, and the effects. The HUD lives
// in hud.js; this file only paints the city itself.
import { CFG } from './config.js';
import { missionTarget } from './missions.js';

export function createCamera() {
  const cam = {
    x: 0, y: 0, zoom: 1,
    shakeX: 0, shakeY: 0,
    // Screen (CSS pixel) point -> world point, for mouse aiming.
    toWorld(sx, sy, viewW, viewH) {
      return {
        x: cam.x + (sx - viewW / 2) / cam.zoom,
        y: cam.y + (sy - viewH / 2) / cam.zoom,
      };
    },
    follow(state, dt) {
      const p = state.player;
      const targetZoom = p.car ? CFG.CAM_ZOOM_CAR : CFG.CAM_ZOOM_FOOT;
      cam.zoom += (targetZoom - cam.zoom) * Math.min(1, dt * 2);
      cam.x += (p.x - cam.x) * Math.min(1, dt * 6);
      cam.y += (p.y - cam.y) * Math.min(1, dt * 6);
      if (state.shake > 0) {
        cam.shakeX = (Math.random() - 0.5) * state.shake;
        cam.shakeY = (Math.random() - 0.5) * state.shake;
      } else {
        cam.shakeX = 0;
        cam.shakeY = 0;
      }
    },
    snapTo(x, y) {
      cam.x = x;
      cam.y = y;
    },
  };
  return cam;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawWorld(ctx, state, cam, viewW, viewH) {
  const world = state.world;
  const C = CFG.COLORS;
  ctx.save();
  ctx.translate(viewW / 2, viewH / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x + cam.shakeX, -cam.y + cam.shakeY);

  // Ground: grass everywhere, then the beach and the sea along the south.
  ctx.fillStyle = C.grass;
  ctx.fillRect(0, 0, world.W, world.H);
  ctx.fillStyle = C.sand;
  ctx.fillRect(0, world.beachY, world.W, world.H - world.beachY);
  ctx.fillStyle = C.water;
  ctx.fillRect(0, world.H - 70, world.W, 70);
  ctx.fillStyle = C.waterDeep;
  for (let x = 0; x < world.W; x += 260) {
    ctx.fillRect(x + 40, world.H - 52, 120, 4);
    ctx.fillRect(x + 150, world.H - 30, 90, 4);
  }

  // Sidewalks: a pale border along every road, drawn before the asphalt.
  ctx.fillStyle = C.sidewalk;
  for (const rx of world.roadsV) ctx.fillRect(rx - world.half - 16, 0, CFG.ROAD_W + 32, world.H);
  for (const ry of world.roadsH) ctx.fillRect(0, ry - world.half - 16, world.W, CFG.ROAD_W + 32);

  // Parks.
  for (const park of world.parks) {
    ctx.fillStyle = C.park;
    ctx.fillRect(park.x, park.y, park.w, park.h);
    for (const t of park.trees) {
      ctx.fillStyle = C.tree;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.treeLight;
      ctx.beginPath();
      ctx.arc(t.x - 4, t.y - 4, t.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Parking lots.
  for (const lot of world.parkingLots) {
    ctx.fillStyle = '#4a4d55';
    ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    for (let x = lot.x + 50; x < lot.x + lot.w - 20; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, lot.y + 12);
      ctx.lineTo(x, lot.y + lot.h - 12);
      ctx.stroke();
    }
  }

  // Roads: asphalt, edge lines, dashed centre line.
  for (const rx of world.roadsV) {
    ctx.fillStyle = C.road;
    ctx.fillRect(rx - world.half, 0, CFG.ROAD_W, world.H);
    ctx.strokeStyle = C.lane;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 30]);
    ctx.beginPath();
    ctx.moveTo(rx, 0);
    ctx.lineTo(rx, world.H);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  for (const ry of world.roadsH) {
    ctx.fillStyle = C.road;
    ctx.fillRect(0, ry - world.half, world.W, CFG.ROAD_W);
    ctx.strokeStyle = C.lane;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 30]);
    ctx.beginPath();
    ctx.moveTo(0, ry);
    ctx.lineTo(world.W, ry);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Buildings: roof colour, a darker edge, and a roof unit for texture.
  for (const b of world.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    if (b.roof) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.25, b.w * 0.6, b.h * 0.5);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + b.w * 0.65, b.y + b.h * 0.6, 18, 14);
    }
  }

  // Named places: a small label plate on the map.
  ctx.font = `700 13px ${'system-ui, sans-serif'}`;
  ctx.textAlign = 'center';
  for (const key of Object.keys(world.places)) {
    const pl = world.places[key];
    ctx.fillStyle = 'rgba(12,16,24,0.65)';
    const w = ctx.measureText(pl.label).width + 18;
    ctx.fillRect(pl.x - w / 2, pl.y - 34, w, 20);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(pl.label, pl.x, pl.y - 20);
  }

  // Mission target: a pulsing ring and a light column you can see coming.
  const target = missionTarget(state);
  if (target && state.mission && state.mission.status === 'active') {
    const pulse = 1 + Math.sin(state.time * 4) * 0.12;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(target.x - 6, target.y - 260, 12, 260);
    ctx.restore();
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 46 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(target.x, target.y, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pickups.
  for (const pk of state.pickups) {
    if (pk.taken) continue;
    if (pk.kind === 'cash') {
      ctx.fillStyle = '#2fae4e';
      ctx.beginPath();
      ctx.arc(pk.x, pk.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', pk.x, pk.y + 1);
    } else if (pk.kind === 'health') {
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(pk.x - 11, pk.y - 11, 22, 22);
      ctx.fillStyle = '#e63946';
      ctx.fillRect(pk.x - 3, pk.y - 8, 6, 16);
      ctx.fillRect(pk.x - 8, pk.y - 3, 16, 6);
    } else {
      ctx.fillStyle = '#f5c518';
      ctx.fillRect(pk.x - 10, pk.y - 8, 20, 16);
      ctx.fillStyle = '#222';
      ctx.font = '700 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('AMMO', pk.x, pk.y + 1);
    }
  }

  // Smoke particles.
  for (const pt of state.particles) {
    ctx.fillStyle = `rgba(120,120,120,${Math.max(0, pt.t)})`;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 16 + (0.9 - pt.t) * 22, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pedestrians.
  for (const ped of state.peds) {
    if (ped.down) {
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 12, 6, ped.angle, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(ped.x, ped.y + 8, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(ped.x + Math.cos(ped.angle) * 4, ped.y + Math.sin(ped.angle) * 4, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cars.
  for (const car of state.cars) drawCar(ctx, state, car);

  // The player's tracer line, briefly, after a shot.
  if (state.tracer) {
    ctx.strokeStyle = `rgba(255, 220, 90, ${state.tracer.t / 0.09})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(state.tracer.x, state.tracer.y);
    ctx.lineTo(
      state.tracer.x + Math.cos(state.tracer.angle) * state.tracer.len,
      state.tracer.y + Math.sin(state.tracer.angle) * state.tracer.len,
    );
    ctx.stroke();
  }

  // The player on foot.
  const p = state.player;
  if (!p.car) {
    const blink = p.invulnerable > 0 && Math.floor(p.invulnerable * 10) % 2 === 0;
    if (!blink) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 9, 11, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2b6cb0';
      ctx.beginPath();
      ctx.arc(p.x, p.y, CFG.PLAYER_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(p.angle) * 5, p.y + Math.sin(p.angle) * 5, 6, 0, Math.PI * 2);
      ctx.fill();
      // The pistol, when the player is aiming.
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(p.angle) * 10, p.y + Math.sin(p.angle) * 10);
      ctx.lineTo(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20);
      ctx.stroke();
      if (p.muzzle > 0) {
        ctx.fillStyle = '#ffe066';
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(p.angle) * 26, p.y + Math.sin(p.angle) * 26, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.restore();
}

function drawCar(ctx, state, car) {
  const L = CFG.CAR_LEN;
  const Wd = CFG.CAR_WID;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  roundRect(ctx, -L / 2 + 3, -Wd / 2 + 4, L, Wd, 7);
  ctx.fill();
  // Wheels.
  ctx.fillStyle = '#16181c';
  const wheelY = [-Wd / 2 - 2, Wd / 2 - 2];
  for (const wy of wheelY) {
    ctx.fillRect(-L / 2 + 6, wy, 10, 5);
    ctx.fillRect(L / 2 - 16, wy, 10, 5);
  }
  // Body.
  ctx.fillStyle = car.wrecked ? '#3a3a3a' : car.color;
  roundRect(ctx, -L / 2, -Wd / 2, L, Wd, 7);
  ctx.fill();
  if (car.kind === 'police') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-L / 2 + 4, -Wd / 2, L - 8, Wd);
    ctx.fillStyle = '#1e4fd8';
    ctx.fillRect(-L / 2 + 4, -Wd / 2, 10, Wd);
  }
  if (car.kind === 'taxi') {
    ctx.fillStyle = '#222';
    ctx.font = '700 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TAXI', 0, 0);
  }
  // Windshield and rear window.
  ctx.fillStyle = 'rgba(180, 220, 240, 0.85)';
  ctx.fillRect(L / 2 - 16, -Wd / 2 + 3, 9, Wd - 6);
  ctx.fillRect(-L / 2 + 7, -Wd / 2 + 3, 7, Wd - 6);
  // Headlights.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(L / 2 - 2, -Wd / 2 + 2, 3, 5);
  ctx.fillRect(L / 2 - 2, Wd / 2 - 7, 3, 5);
  // Police light bar, flashing red and blue.
  if (car.kind === 'police' && !car.wrecked) {
    const phase = Math.floor(state.time * 6) % 2 === 0;
    ctx.fillStyle = phase ? '#ff2d2d' : '#2d5bff';
    ctx.fillRect(-4, -Wd / 2 - 1, 8, 5);
    ctx.fillStyle = phase ? '#2d5bff' : '#ff2d2d';
    ctx.fillRect(-4, Wd / 2 - 4, 8, 5);
  }
  // Smoke from a wreck.
  if (car.wrecked) {
    ctx.fillStyle = 'rgba(90,90,90,0.7)';
    ctx.beginPath();
    ctx.arc(-L / 4, 0, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
