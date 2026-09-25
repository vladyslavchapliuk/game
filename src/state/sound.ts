// Tiny synthesized sound effects (no audio files needed).
let ctx: AudioContext | undefined;
let enabled = true;
export const setSoundEnabled = (on: boolean) => { enabled = on; };

const tone = (freq: number, start: number, dur: number, type: OscillatorType = 'triangle', gain = 0.08) => {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, ctx.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + start);
  o.stop(ctx.currentTime + start + dur + 0.05);
};

const SOUNDS = {
  click: () => tone(660, 0, 0.06, 'sine', 0.04),
  correct: () => { tone(660, 0, 0.12); tone(990, 0.1, 0.2); },
  wrong: () => { tone(220, 0, 0.18, 'sawtooth', 0.04); tone(180, 0.12, 0.22, 'sawtooth', 0.035); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.3)),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, i * 0.16, 0.35, 'triangle', 0.06)),
  hiccup: () => { tone(900, 0, 0.05, 'square', 0.03); tone(500, 0.06, 0.08, 'square', 0.03); },
};

export const play = (name: keyof typeof SOUNDS) => {
  if (!enabled) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    SOUNDS[name]();
  } catch { /* audio unavailable */ }
};
