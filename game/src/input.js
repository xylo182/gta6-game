// Keyboard and pointer input. Held keys are a live set; one-shot presses
// (interact, pause, confirm, mute) are queued as flags and taken once by the
// loop, so a press between two frames is never lost and never counted twice.
export const ACT_ENTER_CAR = 1;
export const ACT_PAUSE = 2;
export const ACT_CONFIRM = 4;
export const ACT_MUTE = 8;

const CONFIRM_KEYS = new Set(['Enter', 'Space']);
const PAUSE_KEYS = new Set(['KeyP', 'Escape']);

export function createInput(canvas) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  let actions = 0;

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'KeyE') actions |= ACT_ENTER_CAR;
    else if (PAUSE_KEYS.has(event.code)) actions |= ACT_PAUSE;
    else if (CONFIRM_KEYS.has(event.code)) actions |= ACT_CONFIRM;
    else if (event.code === 'KeyM') actions |= ACT_MUTE;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  }
  function onMouseDown(event) {
    onMouseMove(event);
    mouse.down = true;
    mouse.clicked = true;
  }
  function onMouseUp() {
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    keys,
    mouse,
    down(code) {
      return keys.has(code);
    },
    // WASD or arrows as a -1..1 pair, for driving and walking alike.
    axes() {
      const x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      const y = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
      return { x, y };
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeClick() {
      const was = mouse.clicked;
      mouse.clicked = false;
      return was;
    },
  };
}

// A scripted stand-in for the same interface, used by the screenshot staging
// to drive the player with fixed keys for a fixed number of steps.
export function scriptedInput() {
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  return {
    keys,
    mouse,
    down(code) {
      return keys.has(code);
    },
    axes() {
      const x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      const y = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
      return { x, y };
    },
    takeActions() {
      return 0;
    },
    takeClick() {
      return false;
    },
  };
}
