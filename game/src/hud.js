// The HUD, the minimap, and every full-screen panel: title, pause, busted,
// wasted, mission results and the story's end. Drawn in screen pixels over
// the world; nothing here touches the simulation.
import { CFG, FONT } from './config.js';
import { missionTarget } from './missions.js';

function text(ctx, value, x, y, size, color, align, weight) {
  ctx.font = `${weight || 400} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

function panel(ctx, x, y, w, h, alpha) {
  ctx.fillStyle = `rgba(12, 16, 24, ${alpha ?? 0.82})`;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
}

function stars(ctx, wanted, x, y) {
  for (let i = 0; i < CFG.WANTED_MAX; i += 1) {
    const cx = x + 15 + i * 30;
    ctx.font = `700 24px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = i < wanted ? '#ffd23f' : 'rgba(255,255,255,0.35)';
    ctx.fillText(i < wanted ? '★' : '☆', cx, y);
  }
}

export function drawMinimap(ctx, state, x, y) {
  const w = CFG.MINIMAP_W;
  const h = CFG.MINIMAP_H;
  const world = state.world;
  const sx = w / world.W;
  const sy = h / world.H;
  panel(ctx, x - 6, y - 6, w + 12, h + 12, 0.72);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = '#5d8a4a';
  ctx.fillRect(x, y, w, h);
  // Beach and water along the south shore.
  ctx.fillStyle = '#e6d49a';
  ctx.fillRect(x, y + (world.beachY * sy), w, h - world.beachY * sy);
  ctx.fillStyle = '#2f8fc0';
  ctx.fillRect(x, y + ((world.H - 80) * sy), w, 80 * sy);
  // Roads.
  ctx.strokeStyle = '#3d4149';
  ctx.lineWidth = Math.max(2, CFG.ROAD_W * sx);
  for (const rx of world.roadsV) {
    ctx.beginPath();
    ctx.moveTo(x + rx * sx, y);
    ctx.lineTo(x + rx * sx, y + h);
    ctx.stroke();
  }
  for (const ry of world.roadsH) {
    ctx.beginPath();
    ctx.moveTo(x, y + ry * sy);
    ctx.lineTo(x + w, y + ry * sy);
    ctx.stroke();
  }
  // Buildings as small blocks.
  ctx.fillStyle = '#8a6f5c';
  for (const b of world.buildings) {
    ctx.fillRect(x + b.x * sx, y + b.y * sy, Math.max(1.5, b.w * sx), Math.max(1.5, b.h * sy));
  }
  // Mission marker: a pulsing yellow star.
  const target = missionTarget(state);
  if (target && state.mission && state.mission.status === 'active') {
    const pulse = 5 + Math.sin(state.time * 5) * 1.5;
    ctx.font = `700 ${Math.round(10 + pulse)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd23f';
    ctx.fillText('★', x + target.x * sx, y + target.y * sy);
  }
  // Cars as white dots, police as red.
  for (const car of state.cars) {
    if (car.wrecked) continue;
    ctx.fillStyle = car.driver === 'police' ? '#ff3b30' : 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(x + car.x * sx, y + car.y * sy, car.driver === 'police' ? 3.5 : 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // The player: a green triangle pointing where they face.
  const p = state.player;
  ctx.save();
  ctx.translate(x + p.x * sx, y + p.y * sy);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#39d353';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  text(ctx, 'SOLMAR BAY', x + w / 2, y + h + 18, 11, 'rgba(255,255,255,0.75)', 'center', 700);
}

export function drawHud(ctx, state, viewW, viewH) {
  const p = state.player;
  // Top-left: cash, health, ammo.
  panel(ctx, 12, 12, 218, 92, 0.72);
  text(ctx, `$${p.cash.toLocaleString('en-US')}`, 24, 42, 26, '#7CFC9A', 'left', 700);
  text(ctx, 'CASH', 24, 60, 11, 'rgba(255,255,255,0.6)', 'left', 700);
  // Health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(24, 70, 130, 12);
  ctx.fillStyle = p.health > 50 ? '#39d353' : p.health > 25 ? '#ffb020' : '#ff3b30';
  ctx.fillRect(24, 70, 130 * Math.max(0, p.health / 100), 12);
  text(ctx, 'HP', 160, 81, 11, 'rgba(255,255,255,0.8)', 'left', 700);
  text(ctx, `AMMO ${p.ammo}`, 24, 98, 13, '#e8e8e8', 'left', 700);

  // Top-right: wanted stars on their own row, label underneath.
  panel(ctx, viewW - 190, 12, 178, 66, 0.72);
  stars(ctx, p.wanted, viewW - 176, 34);
  text(ctx, p.wanted > 0 ? 'WANTED' : 'CLEAN', viewW - 101, 64, 12, p.wanted > 0 ? '#ffb020' : 'rgba(255,255,255,0.6)', 'center', 700);

  // Top-centre: the active mission.
  const m = state.mission;
  if (m && m.status === 'active') {
    const label = `${m.def.name}  ·  ${m.def.objective}`;
    ctx.font = `600 15px ${FONT}`;
    const tw = ctx.measureText(label).width;
    panel(ctx, viewW / 2 - tw / 2 - 16, 12, tw + 32, 40, 0.72);
    text(ctx, label, viewW / 2, 38, 15, '#ffffff', 'center', 600);
    if (m.def.timeLimit) {
      const t = Math.max(0, Math.ceil(m.timer));
      text(ctx, `⏱ ${t}s`, viewW / 2, 70, 20, t <= 15 ? '#ff6b5e' : '#ffd23f', 'center', 700);
    }
    // Distance to the marker, so the player always knows how far the job is.
    const target = missionTarget(state);
    if (target) {
      const d = Math.round(Math.hypot(p.x - target.x, p.y - target.y));
      text(ctx, `${d}m to marker`, viewW / 2, 92, 12, 'rgba(255,255,255,0.7)', 'center');
    }
  }

  // Briefing: the giver's words, across the top for the first seconds.
  if (m && m.briefingTimer > 0 && m.status === 'active') {
    const lines = wrapText(ctx, m.def.briefing, 640, 17);
    const h = 24 + lines.length * 22;
    panel(ctx, viewW / 2 - 340, 110, 680, h, 0.85);
    lines.forEach((line, i) => text(ctx, line, viewW / 2, 110 + 30 + i * 22, 17, '#ffe9a8', 'center'));
  }

  // Toast: one-line feedback, centre-low.
  if (state.toast) {
    ctx.font = `600 17px ${FONT}`;
    const tw = ctx.measureText(state.toast).width;
    panel(ctx, viewW / 2 - tw / 2 - 14, viewH - 210, tw + 28, 34, 0.78);
    text(ctx, state.toast, viewW / 2, viewH - 186, 17, '#ffffff', 'center', 600);
  }

  // Bottom-left: speed and controls.
  if (p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.32);
    text(ctx, `${kmh}`, 24, viewH - 66, 44, '#ffffff', 'left', 700);
    text(ctx, 'km/h', 92, viewH - 66, 15, 'rgba(255,255,255,0.65)', 'left');
  }
  text(ctx, 'WASD move/drive · E enter car · Click shoot · P pause · M mute', 24, viewH - 24, 12, 'rgba(255,255,255,0.55)', 'left');

  // Bottom-right: the minimap.
  drawMinimap(ctx, state, viewW - CFG.MINIMAP_W - 18, viewH - CFG.MINIMAP_H - 40);
}

export function wrapText(ctx, value, maxWidth, size) {
  ctx.font = `400 ${size}px ${FONT}`;
  const words = value.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = trial;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function centerPanel(ctx, viewW, viewH, title, lines, prompt, titleColor) {
  const w = 640;
  const h = 150 + lines.length * 28;
  const x = (viewW - w) / 2;
  const y = (viewH - h) / 2;
  ctx.fillStyle = 'rgba(8, 10, 16, 0.55)';
  ctx.fillRect(0, 0, viewW, viewH);
  panel(ctx, x, y, w, h, 0.92);
  text(ctx, title, viewW / 2, y + 62, 40, titleColor || '#ffffff', 'center', 800);
  lines.forEach((line, i) => text(ctx, line, viewW / 2, y + 108 + i * 28, 17, '#dfe6ee', 'center'));
  if (prompt) text(ctx, prompt, viewW / 2, y + h - 26, 16, '#ffd23f', 'center', 600);
}

export function drawOverlay(ctx, state, viewW, viewH) {
  const p = state.player;
  const m = state.mission;
  switch (state.screen) {
    case 'title': {
      const lines = [
        'Solmar Bay, 2026. Rook Reyes is back in the city that owes him everything.',
        'Steal cars, outrun the Bay PD, and run three jobs for fixer Dana Voss.',
        '',
        'WASD / arrows — move & drive      E — steal / exit car      Click — shoot',
        'P — pause      M — mute      The story saves itself after every job.',
      ];
      const hasSave = state.saveData && state.saveData.missionsDone > 0;
      if (hasSave) lines.push(`Continue: ${state.saveData.missionsDone} of 3 jobs done, $${state.saveData.cash.toLocaleString('en-US')} in the bank.`);
      centerPanel(ctx, viewW, viewH, 'SOLMAR BAY', lines, hasSave ? 'Press ENTER to continue the story' : 'Press ENTER to start', '#ffd23f');
      text(ctx, 'A SOLMAR BAY STORY — AN ORIGINAL GAME', viewW / 2, viewH / 2 + 250, 12, 'rgba(255,255,255,0.5)', 'center', 700);
      break;
    }
    case 'paused':
      centerPanel(ctx, viewW, viewH, 'PAUSED', ['The city waits for no one — except right now.'], 'Press P or ENTER to resume');
      break;
    case 'busted':
      centerPanel(ctx, viewW, viewH, 'BUSTED', [`The Bay PD caught Rook. Bail cost $${Math.min(300, p.cash)}.`, 'The story picks up at the safehouse.'], 'Press ENTER to continue', '#7fb2ff');
      break;
    case 'wasted':
      centerPanel(ctx, viewW, viewH, 'WASTED', ['Rook went down in Solmar Bay.', 'The hospital patched him up — for a fee.'], 'Press ENTER to continue', '#ff6b5e');
      break;
    case 'mission-done': {
      const done = m ? m.def : null;
      centerPanel(
        ctx, viewW, viewH, 'JOB DONE',
        done ? [`${done.name} complete — $${done.reward} paid.`, `Bank: $${p.cash.toLocaleString('en-US')}. Next job is on the map.`] : ['Job complete.'],
        'Press ENTER for the next job', '#7CFC9A',
      );
      break;
    }
    case 'mission-failed':
      centerPanel(ctx, viewW, viewH, 'JOB FAILED', ['The clock ran out. Dana does not pay for late work.', 'Try the job again — the city is patient.'], 'Press ENTER to retry the job', '#ff6b5e');
      break;
    case 'story-done':
      centerPanel(
        ctx, viewW, viewH, 'SOLMAR BAY IS YOURS',
        [`All three jobs done. Rook owns the night — $${p.cash.toLocaleString('en-US')} in the bank.`, 'Free roam: keep driving, keep the heat low, keep the city.'],
        'Press ENTER to keep playing', '#ffd23f',
      );
      break;
    default:
      break;
  }
}
