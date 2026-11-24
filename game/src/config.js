// Tuning and constants for Solmar Bay. One place for every magic number so
// the rest of the game reads like a design doc, not a pile of literals.
export const CFG = {
  // World: a 4800x3600 coastal city, roads on a 600px grid.
  WORLD_W: 4800,
  WORLD_H: 3600,
  ROAD_W: 140,
  ROAD_SPACING: 600,
  ROAD_FIRST: 300,

  // Player on foot.
  WALK_SPEED: 210,
  PLAYER_R: 13,
  PLAYER_HEALTH: 100,

  // Cars.
  CAR_LEN: 48,
  CAR_WID: 24,
  CAR_ACCEL: 420,
  CAR_BRAKE: 700,
  CAR_MAX_SPEED: 540,
  CAR_REVERSE_MAX: 190,
  CAR_TURN: 2.6, // radians per second at full lock, scaled by speed
  CAR_DRAG: 0.55, // per-second speed decay when coasting

  // Traffic and pedestrians.
  TRAFFIC_SPEED_MIN: 130,
  TRAFFIC_SPEED_MAX: 200,
  PED_SPEED_MIN: 45,
  PED_SPEED_MAX: 85,
  TRAFFIC_COUNT: 26,
  PED_COUNT: 42,
  PARKED_COUNT: 14,

  // Police and wanted.
  WANTED_MAX: 5,
  POLICE_MAX_SPEED: 565,
  POLICE_SPAWN_DIST: 750,
  WANTED_DECAY_SECONDS: 10,
  BUST_HOLD_SECONDS: 1.6,

  // Combat.
  PISTOL_AMMO_START: 24,
  PISTOL_RANGE: 420,
  PISTOL_DAMAGE: 34,
  PISTOL_RATE: 0.22, // seconds between shots

  // Missions.
  MISSION_REWARDS: [500, 800, 1500],
  BAY_RUN_SECONDS: 80,
  HEAT_SECONDS: 95,

  // Camera and view.
  CAM_ZOOM_FOOT: 1.0,
  CAM_ZOOM_CAR: 0.78,
  MINIMAP_W: 208,
  MINIMAP_H: 156,

  // Palette: sun-soaked coastal city.
  COLORS: {
    grass: '#7fae62',
    grassDark: '#74a158',
    sand: '#e6d49a',
    water: '#2f8fc0',
    waterDeep: '#2277a8',
    road: '#3d4149',
    roadEdge: '#2c2f36',
    sidewalk: '#b9b09c',
    lane: '#d8c95a',
    buildingRoof: ['#d98a6a', '#7fa8d9', '#e8c96a', '#b48ac9', '#8ac9a0', '#d97a7a', '#6ab0b8', '#e0a458'],
    park: '#5d9b4e',
    tree: '#3f7a34',
    treeLight: '#5aa348',
    car: ['#c0392b', '#2980b9', '#f1c40f', '#7f8c8d', '#8e44ad', '#16a085', '#e67e22', '#ecf0f1', '#2c3e50', '#d35400'],
    police: '#1e4fd8',
    taxi: '#f5c518',
  },

  SAVE_KEY: 'solmar-bay-save-v1',
};

export const STEP = 1 / 60;
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
