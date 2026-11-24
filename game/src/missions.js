// Missions and the Solmar Bay story. Three jobs from fixer Dana Voss, in
// order; each one names its target on the map and in the HUD, pays on
// completion, and hands the story to the next job. Finishing all three ends
// the story — the city is the player's now.
import { CFG } from './config.js';
import { setWanted } from './police.js';

export const MISSIONS = [
  {
    id: 'first-wheels',
    name: '1 — First Wheels',
    giver: 'Dana Voss',
    briefing: 'Dana: "Welcome back, Rook. You need wheels before you need anything. Take any car on the street and bring it to the Marina Docks. Quietly, if you can."',
    objective: 'Steal a car (E) and drive to the Marina Docks',
    targetKey: 'docks',
    reward: CFG.MISSION_REWARDS[0],
    setup(state) {
      // Nothing scripted: the player steals any car and drives north-east.
    },
    done(state) {
      const p = state.player;
      const t = state.world.places.docks;
      return p.car !== null && Math.hypot(p.x - t.x, p.y - t.y) < 130;
    },
  },
  {
    id: 'bay-run',
    name: '2 — Bay Run',
    giver: 'Dana Voss',
    briefing: 'Dana: "A package for the Market, and the Bay PD is already sniffing around. Eighty seconds, Rook — drive like the rent is due."',
    objective: 'Deliver the package to Solmar Market before the timer ends',
    targetKey: 'market',
    reward: CFG.MISSION_REWARDS[1],
    timeLimit: CFG.BAY_RUN_SECONDS,
    setup(state) {
      // The run starts hot: two stars the moment the engine turns over.
      setWanted(state, 2, 'The Bay Run starts hot — 2 stars');
    },
    done(state) {
      const p = state.player;
      const t = state.world.places.market;
      return p.car !== null && Math.hypot(p.x - t.x, p.y - t.y) < 130;
    },
  },
  {
    id: 'heat',
    name: '3 — Heat',
    giver: 'Old Sal',
    briefing: 'Old Sal: "Three stars, kid, and every cruiser in Solmar Bay wants a piece of you. Lose them and get to your safehouse. Do not get busted."',
    objective: 'Escape the 3-star chase and reach your safehouse',
    targetKey: 'safehouse',
    reward: CFG.MISSION_REWARDS[2],
    timeLimit: CFG.HEAT_SECONDS,
    setup(state) {
      setWanted(state, 3, 'Three stars — every cruiser is coming');
    },
    done(state) {
      const p = state.player;
      const t = state.world.places.safehouse;
      return Math.hypot(p.x - t.x, p.y - t.y) < 130;
    },
  },
];

export function startMission(state, index) {
  const def = MISSIONS[index];
  state.mission = {
    index,
    def,
    status: 'active',
    timer: def.timeLimit || 0,
    briefingTimer: 7,
  };
  def.setup(state);
  state.toast = `${def.name}: ${def.objective}`;
  state.toastTimer = 4;
}

export function updateMissions(state, dt) {
  const m = state.mission;
  if (!m || m.status !== 'active') return;
  if (m.briefingTimer > 0) m.briefingTimer -= dt;
  if (m.def.timeLimit) {
    m.timer -= dt;
    if (m.timer <= 0) {
      m.status = 'failed';
      state.screen = 'mission-failed';
      state.audio.busted();
      return;
    }
  }
  if (m.def.done(state)) {
    m.status = 'done';
    state.player.cash += m.def.reward;
    state.missionsDone += 1;
    state.audio.missionDone();
    state.audio.setSiren(false);
    // Cool the heat between jobs, and save after every job.
    state.player.wanted = 0;
    state.wantedTimer = 0;
    state.save();
    if (state.mission.index + 1 < MISSIONS.length) {
      state.screen = 'mission-done';
    } else {
      state.screen = 'story-done';
    }
  }
}

// Where the current mission points, in world coordinates.
export function missionTarget(state) {
  const m = state.mission;
  if (!m) return null;
  return state.world.places[m.def.targetKey];
}
