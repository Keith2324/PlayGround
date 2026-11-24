import { rand, TAU } from './util.js';

export class FX {
  constructor() {
    this.parts = [];
    this.rings = [];
    this.dusts = [];
    this.petals = [];
    for (let i = 0; i < 26; i++) this.petals.push(this.newPetal(true));
  }

  newPetal(initial = false) {
    return {
      x: rand(-40, 1320),
      y: initial ? rand(0, 720) : rand(-80, -10),
      vx: rand(-18, -46),
      vy: rand(18, 45),
      size: rand(3, 7),
      rot: rand(0, TAU),
      vr: rand(-2.4, 2.4),
      sway: rand(0, TAU),
      alpha: rand(0.25, 0.7),
      hue: Math.random() < 0.5 ? '255,170,190' : '255,215,170',
    };
  }

  reset() {
    this.parts.length = 0;
    this.rings.length = 0;
    this.dusts.length = 0;
  }

  update(dt) {
    for (const p of this.parts) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.gravity || 0) * dt;
      p.vx *= Math.pow(0.15, dt);
      p.rot += (p.vr || 0) * dt;
      if (p.type === 'ember') p.vy -= 40 * dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const r of this.rings) {
      r.life -= dt;
      r.r += r.speed * dt;
      r.speed *= Math.pow(0.08, dt);
    }
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const d of this.dusts) {
      d.life -= dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vy += 30 * dt;
      d.r += d.grow * dt;
    }
    this.dusts = this.dusts.filter((d) => d.life > 0);
    for (const p of this.petals) {
      p.sway += dt * 2.2;
      p.x += (p.vx + Math.sin(p.sway) * 18) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.y > 740 || p.x < -60) Object.assign(p, this.newPetal());
    }
  }

  hitSpark(x, y, power, color = '#ffd9a0', color2 = '#ff5d4d') {
    const n = Math.round(8 + power * 10);
    this.parts.push({
      type: 'star', x, y, life: 0.13, maxLife: 0.13, size: 26 + power * 30,
      rot: rand(0, TAU), color: '#fff8e8', vx: 0, vy: 0,
    });
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const sp = rand(180, 460 + power * 300);
      this.parts.push({
        type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
        life: rand(0.18, 0.4), maxLife: 0.4, size: rand(1.5, 3.6),
        len: rand(8, 22), rot: a, vr: rand(-6, 6),
        color: Math.random() < 0.5 ? color : color2, gravity: 620,
      });
    }
    this.rings.push({ x, y, r: 6, speed: 900 + power * 500, life: 0.22, maxLife: 0.22, color: '#fff3d6', w: 3 });
    for (let i = 0; i < 5; i++) {
      this.parts.push({
        type: 'ember', x: x + rand(-10, 10), y: y + rand(-12, 12),
        vx: rand(-60, 60), vy: rand(-150, -40), life: rand(0.3, 0.7), maxLife: 0.7,
        size: rand(2, 5), color, gravity: 0,
      });
    }
  }

  blockSpark(x, y) {
    this.parts.push({
      type: 'star', x, y, life: 0.1, maxLife: 0.1, size: 24, rot: rand(0, TAU),
      color: '#d8f6ff', vx: 0, vy: 0,
    });
    for (let i = 0; i < 8; i++) {
      const a = rand(-Math.PI, Math.PI);
      const sp = rand(120, 320);
      this.parts.push({
        type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rand(0.12, 0.3), maxLife: 0.3, size: rand(1, 2.4),
        len: rand(6, 16), rot: a, vr: rand(-4, 4), color: '#bdeaff', gravity: 500,
      });
    }
    this.rings.push({ x, y, r: 4, speed: 500, life: 0.18, maxLife: 0.18, color: '#bfefff', w: 2 });
  }

  dust(x, height = 0, power = 1, color = '#d9b98a') {
    const y = 596 - height;
    const n = Math.round(4 + power * 7);
    for (let i = 0; i < n; i++) {
      this.dusts.push({
        x: x + rand(-18, 18), y: y + rand(-4, 2),
        vx: rand(-90, 90) * power, vy: rand(-45, -8),
        r: rand(4, 10) * power, grow: rand(16, 40) * power,
        life: rand(0.28, 0.6) * power, maxLife: 0.7, color,
      });
    }
  }

  shock(x, y, power = 1, color = '#ffe6b0') {
    this.rings.push({ x, y, r: 8, speed: 700 * power, life: 0.4, maxLife: 0.4, color, w: 4 });
    this.rings.push({ x, y, r: 4, speed: 420 * power, life: 0.55, maxLife: 0.55, color: '#ff7d6a', w: 2 });
  }

  projectileTrail(x, y, color, size = 1, ex = false) {
    this.parts.push({
      type: 'ember', x: x + rand(-6, 6), y: y + rand(-6, 6),
      vx: rand(-40, 40), vy: rand(-60, 20),
      life: rand(0.16, 0.38), maxLife: 0.38, size: rand(3, 8) * size * (ex ? 1.4 : 1),
      color, gravity: 0,
    });
    if (Math.random() < 0.5) {
      const a = rand(0, TAU);
      this.parts.push({
        type: 'spark', x, y, vx: Math.cos(a) * rand(40, 150), vy: Math.sin(a) * rand(40, 150),
        life: 0.2, maxLife: 0.2, size: rand(1, 2.6), len: rand(5, 14), rot: a,
        vr: rand(-6, 6), color, gravity: 0,
      });
    }
  }

  aura(x, y, color) {
    this.parts.push({
      type: 'ember', x: x + rand(-26, 26), y: y + rand(-10, 10),
      vx: rand(-12, 12), vy: rand(-90, -30), life: rand(0.3, 0.8), maxLife: 0.8,
      size: rand(2, 5), color, gravity: 0,
    });
  }

  koBurst(x, y) {
    this.shock(x, y, 1.9, '#fff4d8');
    this.hitSpark(x, y, 2.2, '#fff0c8', '#ff5a5a');
    for (let i = 0; i < 26; i++) {
      const a = rand(-Math.PI, 0);
      this.parts.push({
        type: 'spark', x, y, vx: Math.cos(a) * rand(200, 700), vy: Math.sin(a) * rand(200, 700),
        life: rand(0.3, 0.8), maxLife: 0.8, size: rand(2, 4), len: rand(10, 30),
        rot: a, vr: rand(-8, 8), color: Math.random() < 0.5 ? '#ffcf74' : '#ff5b6e', gravity: 700,
      });
    }
  }

  drawPetals(ctx) {
    for (const p of this.petals) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = `rgba(${p.hue},${p.alpha})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.52, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  drawDust(ctx) {
    for (const d of this.dusts) {
      const a = Math.max(0, d.life / d.maxLife) * 0.3;
      ctx.fillStyle = d.color === '#ffd9a0' ? `rgba(255,210,150,${a})` : `rgba(210,180,140,${a})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, TAU);
      ctx.fill();
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const r of this.rings) {
      const a = Math.max(0, r.life / r.maxLife);
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = a * 0.75;
      ctx.lineWidth = r.w * a + 0.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, TAU);
      ctx.stroke();
    }
    for (const p of this.parts) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      if (p.type === 'star') {
        const s = p.size * (0.6 + (1 - a) * 0.5);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * TAU;
          const rad = i % 2 === 0 ? s : s * 0.28;
          const px = Math.cos(ang) * rad;
          const py = Math.sin(ang) * rad;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (p.type === 'spark') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - Math.cos(p.rot) * p.len, p.y - Math.sin(p.rot) * p.len);
        ctx.stroke();
      } else if (p.type === 'ember') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a + 0.5, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
