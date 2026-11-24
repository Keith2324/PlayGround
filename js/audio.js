/* Tiny synthesized sound kit — no external assets. */
export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.noiseBuf = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.musicOn = false;
    this.lastWhoosh = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      const len = Math.floor(this.ctx.sampleRate * 1.2);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    } catch (e) {
      this.ctx = null;
    }
  }

  toggle() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.55;
    return this.muted;
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  noise({ dur = 0.15, gain = 0.2, type = 'bandpass', f0 = 800, f1 = 300, q = 1, delay = 0 } = {}) {
    if (!this.ctx || this.muted) return;
    const t = this.now() + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = type;
    filt.Q.value = q;
    filt.frequency.setValueAtTime(f0, t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  tone({ f0 = 440, f1 = f0, dur = 0.2, type = 'sine', gain = 0.18, delay = 0, attack = 0.008 } = {}) {
    if (!this.ctx || this.muted) return;
    const t = this.now() + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, f0), t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.04);
  }

  whoosh(power = 1) {
    const n = this.now();
    if (n - this.lastWhoosh < 0.04) return;
    this.lastWhoosh = n;
    this.noise({ dur: 0.11 + power * 0.05, gain: 0.05 + power * 0.04, type: 'bandpass', f0: 500, f1: 1700, q: 1.4 });
  }

  hit(power = 1) {
    this.noise({ dur: 0.12 + power * 0.07, gain: 0.22 + power * 0.15, type: 'lowpass', f0: 1900, f1: 200, q: 0.8 });
    this.tone({ f0: 130 + power * 30, f1: 52, dur: 0.16 + power * 0.06, type: 'triangle', gain: 0.24 + power * 0.1 });
    if (power > 0.7) this.tone({ f0: 800, f1: 300, dur: 0.09, type: 'square', gain: 0.05 });
  }

  block() {
    this.noise({ dur: 0.09, gain: 0.16, type: 'highpass', f0: 1800, f1: 1200, q: 1 });
    this.tone({ f0: 700, f1: 520, dur: 0.08, type: 'square', gain: 0.05 });
  }

  jump() {
    this.tone({ f0: 220, f1: 420, dur: 0.1, type: 'sine', gain: 0.05 });
  }

  land() {
    this.noise({ dur: 0.1, gain: 0.1, type: 'lowpass', f0: 500, f1: 120 });
  }

  fireball() {
    this.tone({ f0: 180, f1: 720, dur: 0.32, type: 'sawtooth', gain: 0.1 });
    this.noise({ dur: 0.4, gain: 0.1, type: 'bandpass', f0: 380, f1: 1600, q: 2 });
  }

  uppercut() {
    this.tone({ f0: 150, f1: 900, dur: 0.28, type: 'square', gain: 0.08 });
    this.noise({ dur: 0.3, gain: 0.12, type: 'bandpass', f0: 300, f1: 2000, q: 1.5 });
  }

  spin() {
    this.noise({ dur: 0.5, gain: 0.12, type: 'bandpass', f0: 250, f1: 1400, q: 3 });
    this.tone({ f0: 300, f1: 500, dur: 0.35, type: 'triangle', gain: 0.04 });
  }

  ko() {
    this.tone({ f0: 240, f1: 45, dur: 0.9, type: 'sawtooth', gain: 0.2 });
    this.noise({ dur: 0.8, gain: 0.24, type: 'lowpass', f0: 2400, f1: 90 });
    this.tone({ f0: 70, f1: 40, dur: 1.1, type: 'sine', gain: 0.24, delay: 0.03 });
  }

  roundStart() {
    this.tone({ f0: 440, dur: 0.08, type: 'square', gain: 0.06 });
    this.tone({ f0: 660, dur: 0.14, type: 'square', gain: 0.06, delay: 0.1 });
  }

  fight() {
    [330, 440, 554, 660].forEach((f, i) =>
      this.tone({ f0: f, dur: 0.16, type: 'sawtooth', gain: 0.055, delay: i * 0.055 }));
  }

  win() {
    [392, 523, 659, 784, 1046].forEach((f, i) =>
      this.tone({ f0: f, dur: 0.32, type: 'triangle', gain: 0.09, delay: i * 0.09 }));
  }

  lose() {
    [392, 349, 311, 233].forEach((f, i) =>
      this.tone({ f0: f, dur: 0.4, type: 'triangle', gain: 0.08, delay: i * 0.12 }));
  }

  ui() {
    this.tone({ f0: 700, f1: 900, dur: 0.05, type: 'square', gain: 0.035 });
  }

  superReady() {
    this.tone({ f0: 523, dur: 0.12, type: 'triangle', gain: 0.07 });
    this.tone({ f0: 784, dur: 0.18, type: 'triangle', gain: 0.07, delay: 0.1 });
  }

  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.musicStep = 0;
    this.musicTimer = setInterval(() => this.musicTick(), 250);
  }

  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  musicTick() {
    if (!this.ctx || this.muted || !this.musicOn) return;
    const s = this.musicStep % 16;
    const bass = [55, 55, 65.4, 55, 49, 49, 46.2, 55, 55, 55, 65.4, 73.4, 65.4, 55, 49, 46.2];
    if (s % 2 === 0) {
      this.tone({ f0: bass[s], dur: 0.2, type: 'triangle', gain: 0.05 });
      this.tone({ f0: bass[s] * 2, dur: 0.12, type: 'sine', gain: 0.02 });
    }
    if (s % 4 === 2) this.noise({ dur: 0.05, gain: 0.02, type: 'highpass', f0: 6000, f1: 5000 });
    if (s === 0 || s === 8) this.tone({ f0: 120, f1: 45, dur: 0.22, type: 'sine', gain: 0.1 });
    this.musicStep++;
  }
}
