import { rand, clamp } from './util.js';

const LEVELS = {
  easy: {
    think: [0.34, 0.62], block: 0.34, antiAir: 0.16, jump: 0.5, special: 0.35,
    aggression: 0.5, retreat: 0.22, reaction: 0.5, mistake: 0.22,
  },
  normal: {
    think: [0.22, 0.44], block: 0.6, antiAir: 0.42, jump: 0.5, special: 0.6,
    aggression: 0.68, retreat: 0.18, reaction: 0.3, mistake: 0.1,
  },
  hard: {
    think: [0.13, 0.3], block: 0.82, antiAir: 0.7, jump: 0.5, special: 0.85,
    aggression: 0.85, retreat: 0.14, reaction: 0.17, mistake: 0.03,
  },
};

export class CPU {
  constructor(fighter, level = 'normal') {
    this.f = fighter;
    this.opp = null;
    this.level = level;
    this.cfg = LEVELS[level] || LEVELS.normal;
    this.timer = 0.4;
    this.mode = 'wait';
    this.modeTime = 0;
    this.issued = false;
    this.jumpRequested = false;
    this.lastPlayerMove = null;
  }

  reset() {
    this.timer = 0.4;
    this.mode = 'wait';
    this.modeTime = 0;
    this.issued = false;
    this.jumpRequested = false;
  }

  setLevel(level) {
    this.level = level;
    this.cfg = LEVELS[level] || LEVELS.normal;
  }

  isThreatClose(o, dist) {
    if (!o.move) return false;
    const m = o.move;
    if (m.time > m.startup + m.active * 0.7) return false;
    const reach = (m.hitbox?.x || 0) + (m.hitbox?.w || 0) + 30;
    return dist < reach + 20;
  }

  update(dt, game) {
    const f = this.f;
    const o = game.cpu === f ? game.player : game.cpu;
    this.opp = o;
    const ctrl = { dir: 0, jump: false, crouch: false, action: null, oppX: o.x };
    const dist = Math.abs(o.x - f.x);
    const toward = o.x > f.x ? 1 : -1;

    if (f.state === 'ko' || f.state === 'knockdown' || game.state !== 'fight') {
      f.control(ctrl, dt, game);
      return;
    }

    if (f.hitstun > 0 || f.blockstun > 0) {
      ctrl.dir = -f.facing;
      f.control(ctrl, dt, game);
      return;
    }

    this.timer -= dt;
    this.modeTime -= dt;
    const canAct = f.canAct();

    // ---------------------------------------------------------
    // reactions (checked every frame)
    // ---------------------------------------------------------
    if (canAct) {
      const incoming = game.projectiles.find(
        (p) => p.owner !== f && !p.dead &&
          Math.sign(p.vx) === Math.sign(f.x - p.x) &&
          Math.abs(p.x - f.x) < 460
      );
      if (incoming) {
        const timeToHit = Math.abs(incoming.x - f.x) / Math.abs(incoming.vx);
        if (timeToHit < 0.55 && Math.random() < 0.06 * (this.cfg.block + 0.5)) {
          if (this.cfg.jump > Math.random() * 1.6 && dist > 160) {
            ctrl.jump = true;
            ctrl.dir = toward;
            f.control(ctrl, dt, game);
            return;
          }
          this.mode = 'block';
          this.modeTime = 0.34;
        }
        if (timeToHit < 0.9 && f.meter >= 100 && Math.random() < this.cfg.special * 0.05) {
          ctrl.action = 'fire';
          f.control(ctrl, dt, game);
          return;
        }
      }

      if (o.airborne && dist < 240 && o.vy < 0 && Math.random() < this.cfg.antiAir * dt * 26) {
        ctrl.action = 'dp';
        f.control(ctrl, dt, game);
        return;
      }

      if (this.isThreatClose(o, dist) && Math.random() < this.cfg.block * clamp(this.cfg.reaction + 0.2, 0, 1) * dt * 24) {
        this.mode = 'block';
        this.modeTime = 0.32;
      }

      if (o.move && o.move.hits > 0 && o.move.time > o.move.startup + o.move.active && dist < 190 &&
          Math.random() < this.cfg.aggression * dt * 12) {
        this.mode = Math.random() < 0.5 ? 'heavy' : 'kick';
        this.modeTime = 0.4;
        this.issued = false;
      }
    }

    // ---------------------------------------------------------
    // planning
    // ---------------------------------------------------------
    if (this.timer <= 0) {
      this.timer = rand(this.cfg.think[0], this.cfg.think[1]);
      if (canAct) {
        this.choose(dist, toward, game);
      }
    }

    // ---------------------------------------------------------
    // execute current mode
    // ---------------------------------------------------------
    if (this.modeTime <= 0 && ['block', 'retreat', 'approach', 'wait'].includes(this.mode)) {
      if (canAct) this.mode = 'wait';
    }

    switch (this.mode) {
      case 'approach':
        ctrl.dir = toward;
        break;
      case 'retreat':
        ctrl.dir = -toward;
        break;
      case 'block':
        ctrl.dir = -f.facing;
        ctrl.crouch = this.oppCrouchGuess(o);
        break;
      case 'jumpIn':
        ctrl.dir = toward;
        if (!this.jumpRequested && !f.airborne && canAct) {
          ctrl.jump = true;
          this.jumpRequested = true;
        }
        if (f.airborne && dist < 190 && !this.issued) {
          ctrl.action = 'kick';
          this.issued = true;
        }
        break;
      case 'fire':
        if (canAct && !this.issued) {
          ctrl.action = 'fire';
          this.issued = true;
        }
        break;
      case 'dp':
        if (canAct && !this.issued) {
          ctrl.action = 'dp';
          this.issued = true;
        }
        break;
      case 'spin':
        if (canAct && !this.issued) {
          ctrl.action = 'spin';
          this.issued = true;
        }
        break;
      case 'light':
        if (canAct && !this.issued) {
          ctrl.action = 'lp';
          this.issued = true;
        }
        break;
      case 'heavy':
        if (canAct && !this.issued) {
          ctrl.action = 'hp';
          this.issued = true;
        }
        break;
      case 'sweep':
        ctrl.crouch = true;
        if (canAct && !this.issued) {
          ctrl.action = 'kick';
          this.issued = true;
        }
        break;
      case 'kick':
        if (canAct && !this.issued) {
          ctrl.action = 'kick';
          this.issued = true;
        }
        break;
      case 'special':
        if (canAct && !this.issued) {
          this.issued = true;
          const roll = Math.random();
          if (f.meter >= 100 || roll < 0.34) ctrl.action = 'fire';
          else if (roll < 0.68) ctrl.action = 'spin';
          else ctrl.action = 'dp';
        }
        break;
      default:
        if (canAct && Math.random() < this.cfg.aggression * 0.4) ctrl.dir = toward;
        break;
    }

    f.control(ctrl, dt, game);
  }

  oppCrouchGuess(o) {
    if (o.move && o.move.low) return true;
    return Math.random() < 0.3;
  }

  choose(dist, toward, game) {
    const f = this.f;
    const o = this.opp;
    const cfg = this.cfg;
    const r = Math.random();
    const hasProjectile = game.projectiles.some((p) => p.owner === f && !p.dead);
    const cornered = (toward > 0 && o.x > 980) || (toward < 0 && o.x < 300);
    const lowHp = f.hp < f.maxHp * 0.35;

    if (Math.random() < cfg.mistake) {
      this.mode = 'wait';
      this.modeTime = 0.35;
      this.issued = false;
      return;
    }

    if (f.meter >= 100 && dist < 300 && Math.random() < 0.5) {
      this.mode = 'special';
      this.modeTime = 0.5;
      this.issued = false;
      return;
    }

    if (lowHp && dist < 220 && Math.random() < cfg.retreat + 0.15) {
      this.mode = 'retreat';
      this.modeTime = rand(0.3, 0.55);
      this.issued = false;
      return;
    }

    if (dist > 430) {
      if (!hasProjectile && r < 0.34 * cfg.special + 0.1) {
        this.mode = 'fire';
      } else if (r < 0.62) {
        this.mode = 'approach';
        this.modeTime = rand(0.3, 0.6);
      } else if (r < 0.78) {
        this.mode = 'jumpIn';
        this.modeTime = 0.9;
        this.jumpRequested = false;
      } else {
        this.mode = 'wait';
        this.modeTime = 0.25;
      }
    } else if (dist > 250) {
      if (!hasProjectile && r < 0.2 + cfg.special * 0.18) {
        this.mode = 'fire';
      } else if (r < 0.5) {
        this.mode = 'approach';
        this.modeTime = rand(0.2, 0.45);
      } else if (r < 0.66) {
        this.mode = 'spin';
        this.modeTime = 0.6;
      } else if (r < 0.8) {
        this.mode = 'jumpIn';
        this.modeTime = 0.9;
        this.jumpRequested = false;
      } else if (r < 0.9) {
        this.mode = 'kick';
        this.modeTime = 0.5;
      } else {
        this.mode = 'retreat';
        this.modeTime = 0.32;
      }
    } else if (dist > 145) {
      if (r < 0.28 + cfg.aggression * 0.14) {
        this.mode = 'approach';
        this.modeTime = rand(0.16, 0.3);
      } else if (r < 0.5) {
        this.mode = 'kick';
        this.modeTime = 0.5;
      } else if (r < 0.66) {
        this.mode = 'spin';
        this.modeTime = 0.6;
      } else if (r < 0.78) {
        this.mode = 'sweep';
        this.modeTime = 0.5;
      } else if (r < 0.9) {
        this.mode = 'jumpIn';
        this.modeTime = 0.9;
        this.jumpRequested = false;
      } else {
        this.mode = 'retreat';
        this.modeTime = 0.3;
      }
    } else {
      if (r < 0.27 * cfg.aggression + 0.06) {
        this.mode = 'light';
        this.modeTime = 0.32;
      } else if (r < 0.46) {
        this.mode = 'heavy';
        this.modeTime = 0.5;
      } else if (r < 0.58) {
        this.mode = 'sweep';
        this.modeTime = 0.5;
      } else if (r < 0.68) {
        this.mode = 'dp';
        this.modeTime = 0.6;
      } else if (r < 0.8) {
        this.mode = 'retreat';
        this.modeTime = 0.28;
      } else if (cornered && r < 0.9) {
        this.mode = 'block';
        this.modeTime = 0.32;
      } else {
        this.mode = 'approach';
        this.modeTime = 0.2;
      }
    }
    this.issued = false;
    this.jumpRequested = false;
    if (this.mode === 'jumpIn') this.jumpRequested = false;
  }
}
