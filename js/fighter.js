import { MOVES, poseForMove, STAND, GUARD, CROUCH, CROUCH_GUARD, AIR } from './moves.js';
import { clamp, lerp } from './util.js';

export const GRAVITY = 2500;
export const FLOOR_Y = 596;
export const STAGE_MIN = 108;
export const STAGE_MAX = 1172;
export const WALK_FWD = 238;
export const WALK_BACK = 178;
export const FIGHTER_SCALE = 1.16;

const KNOCK_POSE = {
  hipY: 23, lean: -1.46, tilt: -0.25, rot: 0, offY: 0,
  handF: { x: 18, y: 4 }, handB: { x: -2, y: 14 },
  footF: { x: 46, y: 22 }, footB: { x: 64, y: 24 },
};

const KO_POSE = {
  hipY: 20, lean: -1.53, tilt: -0.42, rot: 0, offY: 0,
  handF: { x: 26, y: 2 }, handB: { x: -8, y: 18 },
  footF: { x: 50, y: 20 }, footB: { x: 70, y: 24 },
};

function idlePose(t) {
  const b = Math.sin(t * 3.6);
  const b2 = Math.sin(t * 3.6 + 0.8);
  return {
    hipY: 74 + b * 1.4, lean: 0.06 + b * 0.014, tilt: b * 0.025, rot: 0, offY: 0,
    handF: { x: 26 + b * 2, y: -52 + b * 2 },
    handB: { x: 10 + b2, y: -44 - b2 * 1.4 },
    footF: { x: 22, y: 74 }, footB: { x: -24, y: 74 },
  };
}

function walkPose(ph, forward) {
  const s = Math.sin(ph);
  const c = Math.cos(ph);
  return {
    hipY: 73 + Math.abs(c) * 2,
    lean: (forward ? 0.13 : 0.01) + s * 0.012,
    tilt: 0, rot: 0, offY: 0,
    handF: { x: 25 + s * 5, y: -52 + c * 2 },
    handB: { x: 9 - s * 5, y: -44 - c * 2 },
    footF: { x: 20 + s * 19, y: 73 - Math.max(0, s) * 15 },
    footB: { x: -22 - s * 19, y: 73 - Math.max(0, -s) * 15 },
  };
}

function airPose(t, vy) {
  const tuck = clamp(1 - Math.abs(vy) / 850, 0, 1);
  return {
    hipY: 74, lean: vy > 100 ? 0.03 : 0.12, tilt: 0, rot: 0, offY: 0,
    handF: { x: 20, y: -54 }, handB: { x: 2, y: -44 },
    footF: { x: 18 + tuck * 6, y: 90 + tuck * 10 },
    footB: { x: -14 - tuck * 4, y: 96 + tuck * 10 },
  };
}

function hitPose(shock) {
  const k = clamp(shock * 2.2, 0, 1);
  return {
    hipY: 73 - k * 3, lean: -0.06 - k * 0.24, tilt: -0.05 - k * 0.22, rot: 0, offY: 0,
    handF: { x: 24 - k * 34, y: -52 - k * 2 },
    handB: { x: 8 - k * 38, y: -44 - k * 4 },
    footF: { x: 22 - k * 16, y: 73 }, footB: { x: -24 - k * 14, y: 73 },
  };
}

function winPose(t) {
  const b = Math.sin(t * 4) * 3;
  return {
    hipY: 74, lean: 0.01, tilt: -0.04, rot: 0, offY: 0,
    handF: { x: 24, y: -122 + b },
    handB: { x: -8, y: -2 },
    footF: { x: 28, y: 74 }, footB: { x: -28, y: 74 },
  };
}

export class Fighter {
  constructor({ name, tag, palette, isPlayer = false, side = 1 }) {
    this.name = name;
    this.tag = tag;
    this.pal = palette;
    this.isPlayer = isPlayer;
    this.side = side;
    this.maxHp = 1000;
    this.meter = 0;
    this.wins = 0;
    this.time = 0;
    this.walkPhase = 0;
    this.stats = { damageDealt: 0, maxCombo: 0 };
    this.resetRound(0, 1);
  }

  resetRound(x, facing) {
    this.x = x;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.facing = facing;
    this.hp = this.maxHp;
    this.state = 'idle';
    this.move = null;
    this.hitstun = 0;
    this.blockstun = 0;
    this.knockdown = 0;
    this.invuln = 0;
    this.flash = 0;
    this.airborne = false;
    this.airAttackUsed = false;
    this.buffer = null;
    this.blockHeld = false;
    this.crouching = false;
    this.controlVx = false;
    this.combo = 0;
    this.comboTimer = 0;
    this.lastHitAt = -10;
    this.walkPhase = 0;
    this.time = 0;
    this.koFreeze = 0;
  }

  get elevation() { return this.y; }

  canAct() {
    return (
      this.state !== 'ko' && this.state !== 'knockdown' && this.state !== 'win' &&
      !this.move && this.hitstun <= 0 && this.blockstun <= 0
    );
  }

  isBlocking() {
    if (this.hitstun > 0 || this.airborne) return false;
    if (!this.blockHeld) return false;
    return this.state !== 'ko' && this.state !== 'knockdown' && this.state !== 'win' && this.state !== 'attack';
  }

  control(ctrl, dt, game) {
    this.ctrlDir = ctrl.dir || 0;
    this.blockHeld = !this.airborne && ctrl.dir === -this.facing;
    if (ctrl.crouch) this.wantCrouch = true;
    else this.wantCrouch = false;

    if (ctrl.action) {
      this.buffer = { action: ctrl.action, t: 0.16 };
    }
    if (this.state === 'ko' || this.state === 'knockdown' || this.state === 'win') return;
    if (!this.canAct()) return;

    if (!this.airborne) {
      this.facing = ctrl.oppX >= this.x ? 1 : -1;
    }

    if (ctrl.jump && !this.airborne) {
      this.jump(ctrl.dir, game);
      return;
    }

    if (this.buffer) {
      const a = this.buffer.action;
      this.buffer = null;
      if (this.tryAttack(a, ctrl, game)) return;
    }

    if (!this.airborne) {
      if (ctrl.crouch) {
        this.crouching = true;
        this.state = 'crouch';
        this.vx = 0;
        this.controlVx = true;
      } else {
        this.crouching = false;
        if (ctrl.dir !== 0) {
          const fwd = ctrl.dir === this.facing;
          this.vx = ctrl.dir * (fwd ? WALK_FWD : WALK_BACK);
          this.state = 'walk';
        } else {
          this.vx = 0;
          this.state = 'idle';
        }
        this.controlVx = true;
      }
      if (this.state === 'walk') this.walkPhase += dt * 12.5;
    } else {
      this.crouching = false;
      if (ctrl.dir !== 0) this.vx = clamp(this.vx + ctrl.dir * 520 * dt, -280, 280);
    }
  }

  jump(dir, game) {
    this.state = 'jump';
    this.airborne = true;
    this.y = Math.max(this.y, 0.5);
    this.vy = 940;
    this.vx = dir * 230;
    this.airAttackUsed = false;
    this.crouching = false;
    game.fx.dust(this.x, 0, 0.6);
    game.sfx.jump();
  }

  tryAttack(a, ctrl, game) {
    if (this.airborne) {
      if (this.airAttackUsed) return false;
      this.airAttackUsed = true;
      return this.startMove(a === 'kick' ? 'airKick' : 'airPunch', game);
    }
    if (a === 'fire' || a === 'dp' || a === 'spin') return this.startMove(a, game);
    if (ctrl.crouch || this.crouching) {
      return this.startMove(a === 'kick' ? 'sweep' : 'crouchJab', game);
    }
    if (a === 'lp') return this.startMove('jab', game);
    if (a === 'hp') return this.startMove('heavy', game);
    if (a === 'kick') return this.startMove('kick', game);
    return false;
  }

  startMove(id, game) {
    const moveId = id === 'fire' ? 'fireball' : id === 'dp' ? 'dp' : id === 'spin' ? 'spin' : id;
    const def = MOVES[moveId];
    if (!def) return false;
    if (!this.canAct()) return false;
    if (def.special) {
      if (this.airborne) return false;
    }
    let ex = false;
    if (def.special && this.meter >= 100) {
      ex = true;
      this.meter = 0;
      game.onEx(this);
    }
    const real = def;
    const mm = {
      ...real, ex, time: 0, hits: 0, lastHitT: -1, spawned: false, lifted: false,
      damage: Math.round((real.damage || 0) * (ex ? 1.55 : 1)),
      chip: Math.round((real.chip || 0) * (ex ? 2 : 1)),
      kb: (real.kb || 0) * (ex ? 1.25 : 1),
      moveId,
    };
    if (real.projectile) {
      const p = real.projectile;
      mm.projectile = {
        ...p,
        speed: p.speed * (ex ? 1.28 : 1),
        radius: p.radius * (ex ? 1.5 : 1),
        damage: Math.round(p.damage * (ex ? 1.55 : 1)),
        chip: Math.round(p.chip * (ex ? 2 : 1)),
        kb: p.kb * (ex ? 1.2 : 1),
        ex,
        shake: p.shake + (ex ? 4 : 0),
      };
    }
    if (real.invuln) this.invuln = Math.max(this.invuln, real.invuln);
    this.move = mm;
    this.state = 'attack';
    this.crouching = false;
    this.controlVx = false;
    const s = real.sfx;
    if (s === 'light') game.sfx.whoosh(0.35);
    else if (s === 'heavy') game.sfx.whoosh(1);
    else if (s === 'fireball') game.sfx.whoosh(1.2);
    else if (s) game.sfx[s]?.();
    return true;
  }

  endMove(game) {
    const m = this.move;
    this.move = null;
    if (this.state !== 'ko' && this.state !== 'knockdown') {
      this.state = this.airborne ? 'jump' : 'idle';
    }
    if (m && m.moveId === 'spin' && this.airborne) {
      this.vy = Math.min(this.vy, -500);
    }
  }

  startKnockdown(game) {
    this.state = 'knockdown';
    this.knockdown = this.hp <= 0 ? 999 : 0.95;
    this.move = null;
    this.crouching = false;
    this.airborne = false;
    this.hitstun = 0;
    this.blockstun = 0;
    this.vx *= 0.4;
    if (this.hp > 0) {
      game.fx.dust(this.x, 0, 1.1);
      game.sfx.land();
    }
  }

  startKO(game) {
    this.state = 'ko';
    this.move = null;
    this.hp = 0;
    this.knockdown = 999;
    this.crouching = false;
    this.blockstun = 0;
    this.hitstun = 0;
    this.vx = -this.facing * 210;
    this.vy = 380;
    this.airborne = true;
    this.y = Math.max(this.y, 2);
    game.sfx.ko();
  }

  update(dt, game) {
    this.time += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.buffer) {
      this.buffer.t -= dt;
      if (this.buffer.t <= 0) this.buffer = null;
    }
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    if (this.state === 'ko') {
      this.vx *= Math.pow(0.03, dt);
      this.x = clamp(this.x + this.vx * dt, STAGE_MIN, STAGE_MAX);
      if (this.airborne) {
        this.vy -= GRAVITY * dt;
        this.y += this.vy * dt;
        if (this.y <= 0) {
          this.y = 0;
          this.vy = 0;
          this.airborne = false;
          game.fx.dust(this.x, 0, 1.4, '#ffd9a0');
          game.shake = Math.max(game.shake, 9);
        }
      }
      return;
    }

    if (this.state === 'knockdown') {
      this.knockdown -= dt;
      this.vx *= Math.pow(0.0005, dt);
      this.x = clamp(this.x + this.vx * dt, STAGE_MIN, STAGE_MAX);
      if (this.knockdown <= 0 && this.hp > 0) {
        this.state = 'idle';
        this.invuln = 0.32;
        this.knockdown = 0;
        this.combo = 0;
      }
      return;
    }

    if (this.move) {
      const m = this.move;
      m.time += dt;
      if (m.projectile && !m.spawned && m.time >= m.startup) {
        m.spawned = true;
        game.spawnProjectile(this, m);
      }
      if (m.liftY && !m.lifted && m.time >= m.startup) {
        m.lifted = true;
        this.vy = m.liftY;
        this.airborne = true;
        this.y = Math.max(this.y, 2);
        this.vx = this.facing * (m.vx || 0);
        this.airAttackUsed = true;
        game.fx.dust(this.x, 0, 0.9);
      }
      if (m.vx && !m.projectile && m.time > m.startup &&
          m.time < m.startup + m.active + 0.08) {
        this.vx = this.facing * m.vx;
      }
      if (m.time >= m.total) this.endMove(game);
    }

    if (this.hitstun > 0) {
      this.hitstun -= dt;
      if (this.hitstun <= 0 && !this.airborne) {
        this.state = 'idle';
        this.hitstun = 0;
      }
    } else if (this.blockstun > 0) {
      this.blockstun -= dt;
    }

    this.physics(dt, game);
    if (this.controlVx) this.controlVx = false;
  }

  physics(dt, game) {
    if (this.airborne || this.y > 0 || this.vy > 0) {
      this.vy -= GRAVITY * dt;
      this.y += this.vy * dt;
      this.x = clamp(this.x + this.vx * dt, STAGE_MIN, STAGE_MAX);
      if (this.y <= 0) {
        const hard = this.vy < -420;
        this.y = 0;
        this.vy = 0;
        this.airborne = false;
        this.airAttackUsed = false;
        game.fx.dust(this.x, 0, hard ? 1 : 0.5);
        if (hard) game.sfx.land();
        if (this.hitstun > 0 && this.hp > 0) {
          this.hitstun = 0;
          this.startKnockdown(game);
        } else if (this.move && this.move.time > this.move.startup + this.move.active) {
          this.endMove(game);
        } else if (!this.move) {
          this.state = 'idle';
        }
        this.vx *= 0.35;
      }
    } else {
      if (!this.controlVx) this.vx *= Math.pow(0.002, dt);
      this.x = clamp(this.x + this.vx * dt, STAGE_MIN, STAGE_MAX);
    }
  }

  getHurtbox() {
    if (this.state === 'ko' || this.state === 'knockdown') {
      return { x: this.x - 68, y: 0, w: 136, h: 56 };
    }
    const h = (this.crouching ? 122 : 158) * FIGHTER_SCALE;
    const w = 50 * FIGHTER_SCALE;
    return { x: this.x - w / 2, y: this.y, w, h };
  }

  getHitbox(m) {
    const hb = m.hitbox;
    if (!hb) return null;
    const s = FIGHTER_SCALE;
    const x = this.facing === 1
      ? this.x + hb.x * s
      : this.x - (hb.x + hb.w) * s;
    return { x, y: this.y + hb.y * s, w: hb.w * s, h: hb.h * s };
  }

  getPose() {
    if (this.state === 'ko') return KO_POSE;
    if (this.state === 'knockdown') return KNOCK_POSE;
    if (this.state === 'win') return winPose(this.time);
    if (this.move) return poseForMove(this.move, this.move.time);
    if (this.hitstun > 0) return hitPose(this.hitstun);
    if (this.airborne) return airPose(this.time, this.vy);
    if (this.blockHeld && this.canAct()) {
      return this.crouching ? CROUCH_GUARD : GUARD;
    }
    if (this.crouching) return CROUCH;
    if (this.state === 'walk') return walkPose(this.walkPhase, this.ctrlDir === this.facing);
    return idlePose(this.time);
  }
}

export const PALETTES = {
  kaze: {
    skin: '#f2c49c', skinDark: '#d69a74',
    gi: '#f3ecdc', giDark: '#cfc3ab', giShade: '#ded2ba',
    trim: '#e3314f', trimDark: '#a61c37',
    hair: '#1b1424', hairShine: '#3b2f4d',
    glove: '#d92c4a', gloveDark: '#8f142c',
    belt: '#2b2436', boot: '#262234',
    energy: '#ff5d4d', energy2: '#ffca6a',
    band: '#e3314f', bandDark: '#a61c37',
    accent: '#ffb45c',
  },
  ren: {
    skin: '#e8bb9a', skinDark: '#c48f70',
    gi: '#27304d', giDark: '#171d32', giShade: '#323c5e',
    trim: '#39dcec', trimDark: '#1b7e8c',
    hair: '#d9e7f5', hairShine: '#ffffff',
    glove: '#2fb8cf', gloveDark: '#146675',
    belt: '#101521', boot: '#161b28',
    energy: '#39dcff', energy2: '#9a7bff',
    band: '#39dcec', bandDark: '#147480',
    accent: '#7ee8ff',
  },
};
