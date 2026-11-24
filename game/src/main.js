// Boot and the one loop for Solmar Bay: input is read every frame, the
// world advances in fixed 1/60 s steps, and the renderer paints what is
// there. The game moves between title, play, pause and the end screens.
//
// ?seed=N fixes the city. ?shot=start|drive|chase|street (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { CFG, STEP } from './config.js';
import { makeRng } from './random.js';
import { createWorld } from './world.js';
import { ACT_CONFIRM, ACT_ENTER_CAR, ACT_MUTE, ACT_PAUSE, createInput, scriptedInput } from './input.js';
import { createAudio } from './audio.js';
import { makePlayer, tryEnterExitCar, updateOnFoot, updatePickups } from './player.js';
import { carsTouch, driveCar, separateCars } from './vehicles.js';
import { spawnParked, spawnPedestrians, spawnTraffic, updatePedestrians, updateTraffic } from './traffic.js';
import { updatePolice } from './police.js';
import { MISSIONS, startMission, updateMissions } from './missions.js';
import { drawHud, drawOverlay } from './hud.js';
import { createCamera, drawWorld } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const ctx = canvas.getContext('2d');

function loadSave() {
  try {
    const raw = window.localStorage.getItem(CFG.SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.missionsDone !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

function createGameState(seedValue) {
  const rng = makeRng(seedValue);
  const world = createWorld(rng);
  const audio = createAudio();
  const state = {
    seed: seedValue,
    rng,
    world,
    audio,
    camera: createCamera(),
    player: makePlayer(world.spawn.x, world.spawn.y),
    cars: [],
    peds: [],
    pickups: [],
    particles: [],
    tracer: null,
    time: 0,
    screen: 'title',
    mission: null,
    missionsDone: 0,
    wantedTimer: 0,
    bustTimer: 0,
    ramCooldown: 0,
    toast: '',
    toastTimer: 0,
    shake: 0,
    saveData: loadSave(),
  };
  state.cars = [...spawnParked(world, rng), ...spawnTraffic(world, rng)];
  state.peds = spawnPedestrians(world, rng);
  // Street pickups: cash on the sidewalks, health by the hospital, ammo by the docks.
  const pickupSpots = [
    { kind: 'cash', x: 960, y: 830, value: 50 },
    { kind: 'cash', x: 2160, y: 1430, value: 50 },
    { kind: 'cash', x: 3360, y: 2330, value: 100 },
    { kind: 'cash', x: 1560, y: 3230, value: 50 },
    { kind: 'health', x: 1530, y: 1010, value: 0 },
    { kind: 'health', x: 2760, y: 1730, value: 0 },
    { kind: 'ammo', x: 4410, y: 360, value: 0 },
    { kind: 'ammo', x: 360, y: 2670, value: 0 },
  ];
  state.pickups = pickupSpots.map((s) => ({ ...s, taken: false }));
  state.save = () => {
    try {
      window.localStorage.setItem(CFG.SAVE_KEY, JSON.stringify({ cash: state.player.cash, missionsDone: state.missionsDone }));
    } catch {
      // Storage can be off: the save then lasts this visit only.
    }
  };
  if (state.saveData) {
    state.player.cash = state.saveData.cash;
    state.missionsDone = Math.min(state.saveData.missionsDone, MISSIONS.length);
  }
  state.camera.snapTo(state.player.x, state.player.y);
  return state;
}

const state = createGameState(seed);

// Debug handle for play-testing in the browser console.
window.__solmar = state;

function resize() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(window.innerWidth * ratio);
  canvas.height = Math.round(window.innerHeight * ratio);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
}

function draw() {
  const ratio = window.devicePixelRatio || 1;
  const viewW = window.innerWidth;
  const viewH = window.innerHeight;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.fillStyle = '#0e1420';
  ctx.fillRect(0, 0, viewW, viewH);
  drawWorld(ctx, state, state.camera, viewW, viewH);
  if (state.screen !== 'title') drawHud(ctx, state, viewW, viewH);
  if (state.screen !== 'playing') drawOverlay(ctx, state, viewW, viewH);
}

function announce(message) {
  status.textContent = message;
}

function startGame() {
  const idx = Math.min(state.missionsDone, MISSIONS.length - 1);
  state.player.health = CFG.PLAYER_HEALTH;
  state.player.wanted = 0;
  state.player.car = null;
  state.player.x = state.world.spawn.x;
  state.player.y = state.world.spawn.y;
  state.camera.snapTo(state.player.x, state.player.y);
  startMission(state, idx);
  state.screen = 'playing';
  announce(`Playing. ${MISSIONS[idx].name}.`);
}

function respawn(after) {
  const p = state.player;
  p.health = CFG.PLAYER_HEALTH;
  p.cash = Math.max(0, p.cash - Math.min(300, p.cash));
  p.wanted = 0;
  p.car = null;
  p.ammo = Math.max(p.ammo, 12);
  state.bustTimer = 0;
  state.wantedTimer = 0;
  if (after === 'busted') {
    p.x = state.world.places.safehouse.x;
    p.y = state.world.places.safehouse.y;
  } else {
    p.x = state.world.places.hospital.x;
    p.y = state.world.places.hospital.y;
  }
  state.camera.snapTo(p.x, p.y);
  // The job restarts: the story does not punish a setback with a dead end.
  if (state.mission && state.mission.status === 'active') startMission(state, state.mission.index);
  state.screen = 'playing';
  announce('Back on the streets.');
}

function updateGame(input, dt) {
  state.time += dt;
  const p = state.player;

  if (state.screen === 'title') {
    // The city stays alive behind the title panel.
    updateTraffic(state.world, state.cars, dt);
    updatePedestrians(state.world, state.peds, null, state.rng, dt);
    state.camera.follow(state, dt);
    return;
  }
  if (state.screen !== 'playing') return;

  const axes = input.axes();
  if (p.car) {
    // Driving: W/S throttle, A/D steering.
    const throttle = -axes.y;
    const steer = axes.x;
    driveCar(state.world, p.car, throttle, steer, dt);
    p.x = p.car.x;
    p.y = p.car.y;
    p.angle = p.car.angle;
    // Shoving through traffic and crowds.
    for (const other of state.cars) {
      if (other === p.car || other.wrecked) continue;
      if (carsTouch(p.car, other)) {
        separateCars(p.car, other);
        if (Math.abs(p.car.speed) > 200 && state.ramCooldown <= 0) {
          state.audio.crash();
          state.ramCooldown = 0.6;
          state.shake = 4;
        }
        p.car.speed *= 0.94;
      }
    }
    for (const ped of state.peds) {
      if (ped.down) continue;
      if (Math.hypot(ped.x - p.x, ped.y - p.y) < 30 && Math.abs(p.car.speed) > 60) {
        ped.down = true;
        ped.speed = 0;
        p.car.speed *= 0.8;
        state.audio.crash();
        state.shake = 5;
        p.wanted = Math.max(p.wanted, 1);
        state.toast = 'Pedestrian hit — the heat is on';
        state.toastTimer = 2.5;
      }
    }
  } else {
    updateOnFoot(state, input, state.camera, dt);
  }

  updateTraffic(state.world, state.cars, dt);
  updatePedestrians(state.world, state.peds, p.car || (Math.hypot(axes.x, axes.y) > 0 ? p : null), state.rng, dt);
  updatePolice(state, dt);
  updateMissions(state, dt);
  updatePickups(state, dt);

  if (p.health <= 0 && state.screen === 'playing') {
    state.screen = 'wasted';
    state.audio.busted();
    announce('Wasted.');
  }
  state.audio.setEngine(p.car ? Math.abs(p.car.speed) / CFG.CAR_MAX_SPEED : 0);
  state.audio.setSiren(p.wanted > 0);
  state.camera.follow(state, dt);
}

function handleActions(input) {
  const actions = input.takeActions();
  if (actions & ACT_MUTE) {
    state.audio.setMuted(!state.audio.isMuted());
    state.toast = state.audio.isMuted() ? 'Sound muted (M to unmute)' : 'Sound on';
    state.toastTimer = 1.5;
  }
  if (actions & ACT_ENTER_CAR && state.screen === 'playing') {
    const result = tryEnterExitCar(state);
    if (result === 'in') state.toast = 'Car stolen — drive!';
    else if (result === 'out') state.toast = 'Out of the car';
    if (result) state.toastTimer = 1.6;
  }
  if (actions & ACT_PAUSE) {
    if (state.screen === 'playing') {
      state.screen = 'paused';
      announce('Paused.');
    } else if (state.screen === 'paused') {
      state.screen = 'playing';
      announce('Playing.');
    }
  }
  if (actions & ACT_CONFIRM) {
    state.audio.unlock();
    if (state.screen === 'title') startGame();
    else if (state.screen === 'paused') state.screen = 'playing';
    else if (state.screen === 'busted') respawn('busted');
    else if (state.screen === 'wasted') respawn('wasted');
    else if (state.screen === 'mission-done') {
      startMission(state, Math.min(state.mission.index + 1, MISSIONS.length - 1));
      state.screen = 'playing';
    } else if (state.screen === 'mission-failed') {
      startMission(state, state.mission.index);
      state.screen = 'playing';
    } else if (state.screen === 'story-done') {
      state.screen = 'playing';
    }
  }
}

function runShot(name) {
  const scene = stageShot(state, name);
  const input = scriptedInput();
  for (const key of scene.keys) input.keys.add(key);
  for (let i = 0; i < scene.ticks; i += 1) updateGame(input, STEP);
  resize();
  let painted = 0;
  function paint() {
    draw();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  resize();
  window.addEventListener('resize', resize);
  let accumulator = 0;
  let last = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions(input);
    if (state.screen === 'title' || state.screen === 'playing') {
      while (accumulator >= STEP && (state.screen === 'title' || state.screen === 'playing')) {
        updateGame(input, STEP);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    draw();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === 'playing') {
      state.screen = 'paused';
      announce('Paused.');
    }
  });

  announce('Solmar Bay. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
