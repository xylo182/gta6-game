// Procedural WebAudio only: no audio files, no network. Engine hum follows
// the driven car's speed, the siren wails while the player is wanted, and
// blips, shots and crashes are short synthesized bursts. Created lazily on
// the first user gesture, so browsers never autoplay before an interaction.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let muted = false;
  let sirenOn = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Engine: a low sawtooth whose pitch follows speed, kept very quiet.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a sine that swings between two notes on a slow LFO.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 720;
      sirenLfo = ctx.createOscillator();
      sirenLfo.type = 'square';
      sirenLfo.frequency.value = 0.55;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 180;
      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenLfo.start();
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type, vol) {
    if (!ensure() || muted) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol || 0.25, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(g);
      g.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  function noiseBurst(dur, vol, freq) {
    if (!ensure() || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = freq || 1200;
      const g = ctx.createGain();
      g.gain.value = vol || 0.3;
      src.connect(filter);
      filter.connect(g);
      g.connect(master);
      src.start();
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    setEngine(speedRatio) {
      if (!ctx || muted) {
        if (engineGain) engineGain.gain.value = 0;
        return;
      }
      engineOsc.frequency.value = 55 + speedRatio * 165;
      engineGain.gain.value = speedRatio > 0.02 ? 0.05 + speedRatio * 0.05 : 0;
    },
    setSiren(on) {
      sirenOn = on;
      if (!ctx) return;
      sirenGain.gain.value = on && !muted ? 0.045 : 0;
    },
    sirenActive() {
      return sirenOn;
    },
    pickup() {
      blip(880, 0.12, 'sine', 0.25);
      setTimeout(() => blip(1320, 0.14, 'sine', 0.2), 70);
    },
    shot() {
      noiseBurst(0.09, 0.35, 2600);
    },
    crash() {
      noiseBurst(0.25, 0.4, 500);
    },
    missionDone() {
      blip(523, 0.14, 'triangle', 0.3);
      setTimeout(() => blip(659, 0.14, 'triangle', 0.3), 130);
      setTimeout(() => blip(784, 0.26, 'triangle', 0.3), 260);
    },
    busted() {
      blip(220, 0.5, 'sawtooth', 0.25);
      setTimeout(() => blip(165, 0.7, 'sawtooth', 0.25), 350);
    },
  };
}
