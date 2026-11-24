import { Fighter, PALETTES, FLOOR_Y, STAGE_MIN, STAGE_MAX } from './fighter.js';
import { CPU } from './ai.js';
import { FX } from './fx.js';
import { clamp, rectsOverlap } from './util.js';

const ROUND_TIME = 60;
const ROUNDS_TO_WIN = 2;

export class Game {
  constructor({ sfx, input }) {
    this.sfx = sfx;
    this.input = input;
    this.fx = new FX();
    this.player = new Fighter({
      name: 'KAZE', tag: 'P1', palette: PALETTES.kaze, isPlayer: true, side: -1,
    });
    this.cpu = new Fighter({
      name: 'REN', tag: 'CPU', palette: PALETTES.ren, isPlayer: false, side: 1,
    });
    this.cpuAI = new CPU(this.cpu, 'normal');
    this.difficulty = 'normal';
    this.state = 'title';
    this.projectiles = [];
    this.timer = ROUND_TIME;
    this.round = 1;
    this.roundWinner = null;
    this.matchWinner = null;
    this.roundEndT = 0;
    this.winPoseT = 0;
    this.introT = 0;
    this.shake = 0;
    this.flash = 0;
    this.flashColor = '#fff4de';
    this.hitstop = 0;
    this.paused = false;
    this.clock = 0;
    this.announce = null;
    this.dirHistory = [];
    this.lastDirToken = 'n';
    this.onMatchEnd = null;
    this.showHUD = false;
    this.toTitle();
  }

  toTitle() {
    this.state = 'title';
    this.paused = false;
    this.showHUD = false;
    this.projectiles.length = 0;
    this.announce = null;
    this.player.resetRound(430, 1);
    this.cpu.resetRound(850, -1);
    this.player.trailHp = this.player.maxHp;
    this.cpu.trailHp = this.cpu.maxHp;
    this.player.wins = 0;
    this.cpu.wins = 0;
    this.player.meter = 0;
    this.cpu.meter = 0;
    this.player.stats = { damageDealt: 0, maxCombo: 0 };
    this.cpu.stats = { damageDealt: 0, maxCombo: 0 };
    this.round = 1;
    this.matchWinner = null;
    this.fx.reset();
  }

  startMatch(difficulty = this.difficulty) {
    this.difficulty = difficulty;
    this.cpuAI.setLevel(difficulty);
    this.player.wins = 0;
    this.cpu.wins = 0;
    this.player.meter = 0;
    this.cpu.meter = 0;
    this.player.stats = { damageDealt: 0, maxCombo: 0 };
    this.cpu.stats = { damageDealt: 0, maxCombo: 0 };
    this.round = 1;
    this.matchWinner = null;
    this.showHUD = true;
    this.startRound();
  }

  startRound() {
    this.player.resetRound(420, 1);
    this.cpu.resetRound(860, -1);
    this.player.trailHp = this.player.maxHp;
    this.cpu.trailHp = this.cpu.maxHp;
    this.projectiles.length = 0;
    this.timer = ROUND_TIME;
    this.introT = 1.75;
    this.state = 'intro';
    this.showHUD = true;
    this.paused = false;
    this.roundEndT = 0;
    this.roundWinner = null;
    this.announceNow(`ROUND ${this.round}`, {
      dur: 1.25, size: 104, style: 'gold',
      sub: this.round === 3 ? 'FINAL ROUND' : '',
    });
    this.fx.reset();
    this.dirHistory = [];
    this.sfx.roundStart();
  }

  announceNow(text, opts = {}) {
    this.announce = {
      text,
      sub: opts.sub || '',
      style: opts.style || 'gold',
      size: opts.size || 110,
      life: opts.dur || 1.2,
      dur: opts.dur || 1.2,
      y: opts.y || 300,
      glow: opts.glow,
    };
  }

  pause() {
    if (this.paused) return false;
    if (this.state !== 'fight' && this.state !== 'intro') return false;
    this.paused = true;
    return true;
  }

  resume() {
    this.paused = false;
  }

  togglePause() {
    if (this.paused) { this.resume(); return false; }
    return this.pause();
  }

  /* ============================================================
     MAIN STEP
     ============================================================ */
  step(dt, input) {
    if (this.paused) return;
    this.clock += dt;

    if (this.announce) {
      this.announce.life -= dt;
      if (this.announce.life <= 0) this.announce = null;
    }
    this.shake = Math.max(0, this.shake - (this.shake * 9 + 0.4) * dt);
    this.flash = Math.max(0, this.flash - dt * 2.6);
    for (const f of [this.player, this.cpu]) {
      if (f.trailHp > f.hp) {
        f.trailDelay = Math.max(0, (f.trailDelay || 0) - dt);
        if (f.trailDelay <= 0) f.trailHp = Math.max(f.hp, f.trailHp - 480 * dt);
      } else {
        f.trailHp = f.hp;
      }
    }
    this.fx.update(dt);

    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return;
    }

    if (this.state === 'title') {
      this.player.update(dt, this);
      this.cpu.update(dt, this);
      return;
    }

    if (this.state === 'intro') {
      this.introT -= dt;
      this.neutralControl(this.player, this.cpu, dt);
      this.neutralControl(this.cpu, this.player, dt);
      this.player.update(dt, this);
      this.cpu.update(dt, this);
      if (this.introT <= 0) {
        this.state = 'fight';
        this.announceNow('FIGHT!', { dur: 0.9, size: 122, style: 'gold', y: 300 });
        this.sfx.fight();
      }
      return;
    }

    if (this.state === 'fight') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 0;
        this.endRound('timeout');
        return;
      }
      this.applyPlayerControl(input, dt);
      this.cpuAI.update(dt, this);
      this.player.update(dt, this);
      this.cpu.update(dt, this);
      this.resolveBodies();
      this.checkAttack(this.player, this.cpu);
      this.checkAttack(this.cpu, this.player);
      this.updateProjectiles(dt);
      return;
    }

    if (this.state === 'roundEnd' || this.state === 'matchEnd') {
      this.neutralControl(this.player, this.cpu, dt);
      this.neutralControl(this.cpu, this.player, dt);
      this.player.update(dt, this);
      this.cpu.update(dt, this);
      this.updateProjectiles(dt);
      if (this.state === 'roundEnd') {
        this.winPoseT -= dt;
        if (this.winPoseT <= 0 && this.roundWinner && this.roundWinner.state !== 'ko') {
          this.roundWinner.state = 'win';
          this.roundWinner.move = null;
          this.roundWinner.crouching = false;
        }
        this.roundEndT -= dt;
        if (this.roundEndT <= 0) this.afterRound();
      }
      return;
    }
  }

  neutralControl(f, opp, dt) {
    f.control({ dir: 0, jump: false, crouch: false, action: null, oppX: opp.x }, dt, this);
  }

  applyPlayerControl(input, dt) {
    const p = this.player;
    const c = this.cpu;
    if (p.state === 'ko' || p.state === 'win') return;
    const dir = (input.held('right') ? 1 : 0) - (input.held('left') ? 1 : 0);
    const crouch = input.held('down');
    const jump = input.pressed('up');
    let action = null;
    if (input.pressed('fire')) action = 'fire';
    else if (input.pressed('dp')) action = 'dp';
    else if (input.pressed('spin')) action = 'spin';
    else if (input.pressed('lp')) action = 'lp';
    else if (input.pressed('hp')) action = 'hp';
    else if (input.pressed('kick')) action = 'kick';

    this.trackDirection(dir, crouch, p);
    if (action && (action === 'lp' || action === 'hp' || action === 'kick')) {
      const motion = this.detectMotion(action, p);
      if (motion) action = motion;
    }
    p.control({ dir, jump, crouch, action, oppX: c.x }, dt, this);
  }

  trackDirection(dir, crouch, p) {
    const rel = dir === 0 ? 0 : dir === p.facing ? 1 : -1;
    let tok = 'n';
    if (crouch && rel === 1) tok = 'df';
    else if (crouch && rel === -1) tok = 'db';
    else if (crouch) tok = 'd';
    else if (rel === 1) tok = 'f';
    else if (rel === -1) tok = 'b';
    if (tok !== this.lastDirToken) {
      this.lastDirToken = tok;
      this.dirHistory.push({ tok, t: this.clock });
      if (this.dirHistory.length > 24) this.dirHistory.shift();
    }
  }

  detectMotion(action, p) {
    const recent = this.dirHistory.filter((h) => this.clock - h.t < 0.42);
    const toks = recent.map((h) => h.tok);
    if (toks.length < 2) return null;
    const last = toks[toks.length - 1];
    if ((action === 'lp' || action === 'hp')) {
      if (last === 'f') {
        const fi = toks.lastIndexOf('f');
        if (toks.slice(0, fi).some((t) => t === 'd' || t === 'df')) return 'fire';
      }
      // dragon punch: forward, down, down-forward
      const s = toks.join(' ');
      if (/(^| )f( |$).*d.*df/.test(s)) return 'dp';
      if (last === 'df' && toks.slice(0, -1).some((t) => t === 'f' || t === 'd')) return 'dp';
    }
    if (action === 'kick' && last === 'b') {
      const bi = toks.lastIndexOf('b');
      if (toks.slice(0, bi).some((t) => t === 'd' || t === 'db')) return 'spin';
    }
    return null;
  }

  resolveBodies() {
    const a = this.player;
    const b = this.cpu;
    if (a.state === 'ko' || b.state === 'ko') return;
    if (a.state === 'knockdown' || b.state === 'knockdown') return;
    const dx = b.x - a.x;
    const dist = Math.abs(dx);
    const min = 62;
    if (dist < min) {
      const push = (min - dist) / 2;
      const s = dx >= 0 ? 1 : -1;
      a.x = clamp(a.x - s * push, STAGE_MIN, STAGE_MAX);
      b.x = clamp(b.x + s * push, STAGE_MIN, STAGE_MAX);
    }
    a.x = clamp(a.x, STAGE_MIN, STAGE_MAX);
    b.x = clamp(b.x, STAGE_MIN, STAGE_MAX);
  }

  /* ============================================================
     ATTACKS
     ============================================================ */
  checkAttack(att, def) {
    if (this.state !== 'fight') return;
    const m = att.move;
    if (!m || !m.hitbox) return;
    if (m.hits >= m.maxHits) return;
    const activeStart = m.startup;
    const activeEnd = m.startup + m.active;
    if (m.time < activeStart || m.time > activeEnd) return;
    if (m.lastHitT >= 0 && m.time - m.lastHitT < m.hitInterval) return;
    if (def.state === 'ko' || def.state === 'knockdown' || def.invuln > 0) return;
    const hb = att.getHitbox(m);
    const hurt = def.getHurtbox();
    if (!rectsOverlap(hb, hurt)) return;
    m.hits++;
    m.lastHitT = m.time;
    const hx = clamp((hb.x + hb.w * 0.5 + def.x) * 0.5, def.x - 50, def.x + 50);
    const hy = FLOOR_Y - (hb.y + hb.h * 0.55 + def.y * 0.5);
    this.applyStrike(att, def, m, hx, hy);
  }

  applyStrike(att, def, data, hx, hy) {
    if (this.state !== 'fight') return;
    if (def.state === 'ko' || def.state === 'knockdown') return;
    if (def.invuln > 0) return;

    const facing = data.facingDir || att.facing;
    const blocked =
      def.isBlocking() &&
      !(data.low && !def.crouching) &&
      !(data.overhead && def.crouching);

    const meterGain = data.meterGain || 6;

    if (blocked) {
      const chip = data.chip || 0;
      def.hp = Math.max(0, def.hp - chip);
      def.blockstun = Math.max(def.blockstun, data.blockstun || 0.16);
      def.vx = facing * (data.kb || 140) * 0.4;
      att.vx = -facing * 40;
      att.meter = clamp(att.meter + meterGain * 0.55, 0, 100);
      def.meter = clamp(def.meter + meterGain * 0.8, 0, 100);
      def.flash = 0.05;
      this.fx.blockSpark(hx, hy);
      this.sfx.block();
      this.hitstop = Math.max(this.hitstop, 0.045);
      this.shake = Math.max(this.shake, 2.4);
      if (chip > 0) {
        def.trailDelay = 0.32;
        if (def.hp <= 0) this.ko(def, att);
      }
      this.watchMeter();
      return;
    }

    const dmg = Math.max(1, Math.round(data.damage || 0));
    def.hp = Math.max(0, def.hp - dmg);
    def.trailDelay = 0.36;
    def.flash = 0.14;
    def.move = null;
    def.blockstun = 0;
    def.crouching = false;
    def.state = 'hitstun';
    def.hitstun = data.hitstun || 0.26;
    def.vx = facing * (data.kb || 150);
    if (data.launch) {
      def.airborne = true;
      def.vy = 660;
      def.y = Math.max(def.y, 3);
      def.hitstun = 1.4;
    }
    const finalKnock = data.knockdown && (!data.maxHits || data.hits >= data.maxHits);
    if (finalKnock && !data.launch) {
      def.state = 'knockdown';
      def.knockdown = def.hp <= 0 ? 999 : 0.95;
      def.hitstun = 0;
      def.vx = facing * (data.kb || 150) * 0.85;
      this.fx.dust(def.x, 0, 1);
    }

    att.meter = clamp(att.meter + meterGain, 0, 100);
    def.meter = clamp(def.meter + meterGain * 0.75, 0, 100);
    att.combo++;
    att.comboTimer = 1.15;
    att.stats.damageDealt += dmg;
    att.stats.maxCombo = Math.max(att.stats.maxCombo, att.combo);
    def.combo = 0;
    def.comboTimer = 0;

    const power = clamp(dmg / 130, 0.25, 2.2);
    this.fx.hitSpark(hx, hy, power, att.pal.energy2, att.pal.energy);
    if (data.launch) this.fx.shock(hx, hy, 1.2, att.pal.energy2);
    this.shake = Math.max(this.shake, (data.shake || 5) * 1.1);
    this.hitstop = Math.max(this.hitstop, data.hitstop || 0.06);
    this.sfx.hit(power);
    this.watchMeter();

    if (def.hp <= 0) this.ko(def, att);
  }

  ko(def, att) {
    if (def.state === 'ko') return;
    this.hitstop = 0.32;
    this.flash = 0.72;
    this.flashColor = '#fff3dc';
    this.shake = Math.max(this.shake, 22);
    this.fx.koBurst(def.x, FLOOR_Y - def.y - 92);
    def.startKO(this);
    this.sfx.ko();
    this.endRound('ko', att);
  }

  watchMeter() {
    for (const f of [this.player, this.cpu]) {
      if (f.meter >= 100 && !f._wasFull) {
        f._wasFull = true;
        this.sfx.superReady();
      } else if (f.meter < 100) {
        f._wasFull = false;
      }
    }
  }

  onEx(f) {
    this.flash = Math.max(this.flash, 0.22);
    this.flashColor = f.pal.energy;
    this.shake = Math.max(this.shake, 8);
    this.hitstop = Math.max(this.hitstop, 0.09);
    this.fx.shock(f.x, FLOOR_Y - f.y - 90, 1.4, f.pal.energy2);
    this.sfx.superReady();
  }

  /* ============================================================
     PROJECTILES
     ============================================================ */
  spawnProjectile(f, m) {
    if (this.projectiles.some((p) => p.owner === f && !p.dead)) return;
    const pd = m.projectile;
    this.projectiles.push({
      owner: f,
      x: f.x + f.facing * 62,
      y: pd.height,
      vx: f.facing * pd.speed,
      radius: pd.radius,
      damage: pd.damage,
      chip: pd.chip,
      hitstun: pd.hitstun,
      blockstun: pd.blockstun,
      kb: pd.kb,
      shake: pd.shake,
      ex: m.ex,
      pal: f.pal,
      facingDir: f.facing,
      life: 2.6,
      trailT: 0,
      dead: false,
    });
    this.sfx.fireball();
    this.shake = Math.max(this.shake, 3);
  }

  updateProjectiles(dt) {
    const ps = this.projectiles;
    for (const p of ps) {
      if (p.dead) continue;
      p.x += p.vx * dt;
      p.life -= dt;
      p.trailT -= dt;
      if (p.trailT <= 0) {
        p.trailT = 0.018;
        this.fx.projectileTrail(
          p.x - Math.sign(p.vx) * p.radius * 0.5,
          FLOOR_Y - p.y,
          p.pal.energy,
          (p.radius / 23) * 1,
          p.ex
        );
      }
      if (p.x < -80 || p.x > 1360 || p.life <= 0) p.dead = true;
    }
    // projectile vs projectile
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i];
        const b = ps[j];
        if (a.dead || b.dead || a.owner === b.owner) continue;
        if (Math.abs(a.x - b.x) < (a.radius + b.radius) * 0.9 && Math.abs(a.y - b.y) < a.radius + b.radius) {
          a.dead = true;
          b.dead = true;
          const mx = (a.x + b.x) / 2;
          this.fx.hitSpark(mx, FLOOR_Y - (a.y + b.y) / 2, 1.4, '#fff4d0', '#ffcf7a');
          this.fx.shock(mx, FLOOR_Y - (a.y + b.y) / 2, 1.2);
          this.sfx.block();
          this.shake = Math.max(this.shake, 6);
        }
      }
    }
    // projectile vs fighters
    for (const p of ps) {
      if (p.dead || this.state !== 'fight') continue;
      const target = p.owner === this.player ? this.cpu : this.player;
      if (!target || target.state === 'ko' || target.state === 'knockdown') continue;
      if (target.invuln > 0) continue;
      const hurt = target.getHurtbox();
      const nx = clamp(p.x, hurt.x, hurt.x + hurt.w);
      const ny = clamp(p.y, hurt.y, hurt.y + hurt.h);
      const ddx = p.x - nx;
      const ddy = p.y - ny;
      if (ddx * ddx + ddy * ddy > p.radius * p.radius) continue;
      const blocked = target.isBlocking() && !target.airborne;
      p.dead = true;
      if (blocked) {
        target.hp = Math.max(0, target.hp - p.chip);
        target.trailDelay = 0.3;
        target.blockstun = Math.max(target.blockstun, p.blockstun);
        target.vx = p.facingDir * p.kb * 0.5;
        p.owner.meter = clamp(p.owner.meter + 4, 0, 100);
        target.meter = clamp(target.meter + 6, 0, 100);
        this.fx.blockSpark(p.x, FLOOR_Y - p.y);
        this.sfx.block();
        this.shake = Math.max(this.shake, 3);
        if (target.hp <= 0) this.ko(target, p.owner);
        this.watchMeter();
      } else {
        const data = {
          damage: p.damage,
          chip: p.chip,
          hitstun: p.hitstun,
          blockstun: p.blockstun,
          kb: p.kb,
          shake: p.shake,
          hitstop: 0.08,
          knockdown: p.ex,
          maxHits: 1,
          hits: 1,
          launch: false,
          meterGain: 8,
          facingDir: p.facingDir,
        };
        this.applyStrike(p.owner, target, data, p.x, FLOOR_Y - p.y);
      }
    }
    this.projectiles = ps.filter((p) => !p.dead);
  }

  /* ============================================================
     ROUND FLOW
     ============================================================ */
  endRound(reason, winner = null) {
    if (this.state !== 'fight') return;
    this.state = 'roundEnd';
    this.roundEndT = 3.0;
    this.winPoseT = 0.9;
    const p = this.player;
    const c = this.cpu;
    let w = winner;
    if (!w && reason === 'timeout') {
      if (p.hp > c.hp) w = p;
      else if (c.hp > p.hp) w = c;
    }
    this.roundWinner = w;
    if (w) w.wins += 1;

    if (reason === 'ko') {
      this.announceNow('K.O.', {
        dur: 2.0, size: 178, style: 'red', y: 296,
        sub: w ? `${w.name} WINS THE ROUND` : 'DOUBLE K.O.',
      });
      this.flash = Math.max(this.flash, 0.5);
      this.shake = Math.max(this.shake, 12);
    } else {
      const perfect = w && w.hp >= w.maxHp;
      this.announceNow(w ? 'TIME UP' : 'DRAW', {
        dur: 1.8, size: 118, style: 'cyan', y: 296,
        sub: w ? (perfect ? 'PERFECT!' : `${w.name} WINS THE ROUND`) : 'NO POINTS AWARDED',
      });
      this.sfx.roundStart();
    }
  }

  afterRound() {
    if (this.roundWinner && this.roundWinner.wins >= ROUNDS_TO_WIN) {
      this.state = 'matchEnd';
      this.matchWinner = this.roundWinner;
      const loser = this.roundWinner === this.player ? this.cpu : this.player;
      this.roundWinner.state = 'win';
      this.roundWinner.move = null;
      this.roundWinner.hp = Math.max(this.roundWinner.hp, 1);
      if (loser.state !== 'ko') {
        loser.state = 'knockdown';
        loser.knockdown = 999;
        loser.hitstun = 0;
      }
      this.announce = null;
      this.sfx.win();
      if (this.onMatchEnd) this.onMatchEnd(this.matchWinner === this.player);
      return;
    }
    this.round += 1;
    this.startRound();
  }
}
