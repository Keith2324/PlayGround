const KEYMAP = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  lp: ['KeyJ'],
  hp: ['KeyK'],
  kick: ['KeyL'],
  fire: ['KeyU'],
  dp: ['KeyI'],
  spin: ['KeyO'],
  pause: ['KeyP', 'Escape'],
  mute: ['KeyM'],
  start: ['Enter', 'Space'],
};

const CODE_TO_ACTION = {};
for (const [action, codes] of Object.entries(KEYMAP)) {
  for (const code of codes) CODE_TO_ACTION[code] = action;
}

export class InputManager {
  constructor() {
    this.kb = new Set();
    this.kbPressed = new Set();
    this.ts = new Set();
    this.tsPressed = new Set();
    this.pad = { x: 0, y: 0, active: false, pointerId: null };
    this.touchMode = false;
    this.onFirstGesture = null;
    this.padEl = null;
    this.knobEl = null;
    this._bind();
  }

  _bind() {
    const isTouchDevice =
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
      (navigator.maxTouchPoints || 0) > 0 ||
      window.innerWidth < 760;
    if (isTouchDevice) this.enableTouchMode();

    window.addEventListener('keydown', (e) => {
      const action = CODE_TO_ACTION[e.code];
      if (e.repeat) {
        if (action) e.preventDefault();
        return;
      }
      if (action) {
        e.preventDefault();
        this.kb.add(action);
        this.kbPressed.add(action);
        this._gesture();
      }
    });
    window.addEventListener('keyup', (e) => {
      const action = CODE_TO_ACTION[e.code];
      if (action) {
        e.preventDefault();
        this.kb.delete(action);
      }
    });
    window.addEventListener('blur', () => {
      this.kb.clear();
      this.ts.clear();
      this.resetPad();
      this.padEl?.classList.remove('active');
    });
    window.addEventListener('pointerdown', () => this._gesture(), { passive: true });
    window.addEventListener('touchstart', () => this.enableTouchMode(), { passive: true });
    window.addEventListener('contextmenu', (e) => {
      if (e.target.closest('#touch')) e.preventDefault();
    });
  }

  enableTouchMode() {
    if (this.touchMode) return;
    this.touchMode = true;
    document.body.classList.add('is-touch');
  }

  _gesture() {
    if (this.onFirstGesture) {
      const fn = this.onFirstGesture;
      this.onFirstGesture = null;
      try { fn(); } catch (e) { /* ignore */ }
    }
  }

  attachTouch() {
    this.padEl = document.getElementById('pad');
    this.knobEl = document.getElementById('knob');
    if (!this.padEl) return;

    const rect = () => this.padEl.getBoundingClientRect();

    const update = (clientX, clientY) => {
      const r = rect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let dx = (clientX - cx) / (r.width * 0.42);
      let dy = (clientY - cy) / (r.height * 0.42);
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      this.pad.x = dx;
      this.pad.y = dy;
      const wasUp = this.ts.has('up');
      const wasDown = this.ts.has('down');
      this.ts.delete('left'); this.ts.delete('right'); this.ts.delete('up'); this.ts.delete('down');
      if (dx < -0.28) this.ts.add('left');
      if (dx > 0.28) this.ts.add('right');
      if (dy < -0.4) this.ts.add('up');
      if (dy > 0.36) this.ts.add('down');
      if (!wasUp && this.ts.has('up')) this.tsPressed.add('up');
      if (!wasDown && this.ts.has('down')) this.tsPressed.add('down');
      if (this.knobEl) {
        const px = Math.max(-1, Math.min(1, dx));
        const py = Math.max(-1, Math.min(1, dy));
        this.knobEl.style.transform = `translate(calc(-50% + ${px * 38}%), calc(-50% + ${py * 38}%))`;
        this.knobEl.classList.toggle('active', len > 0.2);
      }
    };

    const end = () => {
      this.pad.active = false;
      this.pad.pointerId = null;
      this.pad.x = 0; this.pad.y = 0;
      this.ts.delete('left'); this.ts.delete('right'); this.ts.delete('up'); this.ts.delete('down');
      if (this.knobEl) {
        this.knobEl.style.transform = 'translate(-50%, -50%)';
        this.knobEl.classList.remove('active');
      }
      this.padEl.classList.remove('active');
    };

    this.padEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.enableTouchMode();
      this._gesture();
      this.pad.active = true;
      this.pad.pointerId = e.pointerId;
      this.padEl.classList.add('active');
      this.padEl.setPointerCapture(e.pointerId);
      update(e.clientX, e.clientY);
    });
    this.padEl.addEventListener('pointermove', (e) => {
      if (!this.pad.active || e.pointerId !== this.pad.pointerId) return;
      e.preventDefault();
      update(e.clientX, e.clientY);
    });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      this.padEl.addEventListener(ev, (e) => {
        if (this.pad.pointerId !== null && e.pointerId !== this.pad.pointerId) return;
        end();
      });
    }

    document.querySelectorAll('.tbtn').forEach((btn) => {
      const raw = btn.dataset.action;
      const action = raw === 'jump' ? 'up' : raw;
      const press = (e) => {
        e.preventDefault();
        this.enableTouchMode();
        this._gesture();
        this.ts.add(action);
        this.tsPressed.add(action);
        btn.classList.add('pressed');
        try { btn.setPointerCapture(e.pointerId); } catch (_) {}
      };
      const release = (e) => {
        e.preventDefault();
        this.ts.delete(action);
        btn.classList.remove('pressed');
      };
      btn.addEventListener('pointerdown', press);
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        btn.addEventListener(ev, release);
      }
    });
  }

  resetPad() {
    this.pad.active = false;
    this.pad.x = 0;
    this.pad.y = 0;
    this.ts.delete('up'); this.ts.delete('down');
    this.ts.delete('left'); this.ts.delete('right');
  }

  held(action) {
    return this.kb.has(action) || this.ts.has(action);
  }

  pressed(action) {
    return this.kbPressed.has(action) || this.tsPressed.has(action);
  }

  clearPressed() {
    this.kbPressed.clear();
    this.tsPressed.clear();
  }

  releaseAll() {
    this.kb.clear();
    this.ts.clear();
    this.clearPressed();
    this.resetPad();
  }
}
