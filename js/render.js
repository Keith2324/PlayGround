import { clamp, lerp, rot, ik, TAU, rgba, easeOut, mix } from './util.js';
import { FLOOR_Y, FIGHTER_SCALE } from './fighter.js';

const W = 1280;
const H = 720;
const FONT_DISPLAY = '"Bebas Neue", "Arial Narrow", "DejaVu Sans", sans-serif';
const FONT_UI = '"Rajdhani", "DejaVu Sans", sans-serif';

function starPath(ctx, x, y, r, points, inner) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * TAU - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * inner;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scale = 1;
    this.ox = 0;
    this.oy = 0;
    this.time = 0;
    this.stars = [];
    this.clouds = [];
    this.buildings = [];
    this.petalT = 0;
    for (let i = 0; i < 70; i++) {
      this.stars.push({
        x: Math.random() * W, y: Math.random() * 380,
        r: Math.random() * 1.7 + 0.4, p: Math.random() * TAU,
      });
    }
    for (let i = 0; i < 7; i++) {
      this.clouds.push({
        x: Math.random() * 1500, y: 150 + Math.random() * 210,
        w: 150 + Math.random() * 280, h: 16 + Math.random() * 26,
        a: 0.1 + Math.random() * 0.16, speed: 5 + Math.random() * 11,
      });
    }
    let bx = -20;
    while (bx < W + 40) {
      const w = 32 + Math.random() * 75;
      const h = 40 + Math.random() * 150;
      this.buildings.push({
        x: bx, w, h, top: 552 - h,
        windows: Math.random() < 0.85,
        hue: Math.random() < 0.35 ? '#3a2144' : '#2a1937',
      });
      bx += w + 6 + Math.random() * 20;
    }
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.max(320, Math.round(rect.width * dpr));
    const ch = Math.max(180, Math.round(rect.height * dpr));
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
    }
    this.scale = Math.min(cw / W, ch / H);
    this.ox = (cw - W * this.scale) / 2;
    this.oy = (ch - H * this.scale) / 2;
  }

  render(game, dt) {
    this.time += dt;
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#06030c';
    ctx.fillRect(0, 0, cw, ch);
    ctx.setTransform(this.scale, 0, 0, this.scale, this.ox, this.oy);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();

    const t = this.time;
    const shake = game.shake || 0;
    const sx = shake > 0 ? (Math.random() - 0.5) * shake * 1.4 : 0;
    const sy = shake > 0 ? (Math.random() - 0.5) * shake : 0;

    ctx.save();
    ctx.translate(sx, sy);
    this.drawBackground(game, t);
    game.fx.drawDust(ctx);
    game.fx.drawPetals(ctx);
    this.drawProjectiles(game, t);
    this.drawFighter(game.cpu, game, t);
    this.drawFighter(game.player, game, t);
    game.fx.draw(ctx);
    this.drawForeground(t);
    ctx.restore();

    if (game.showHUD && game.state !== 'title') this.drawHUD(game, t);
    this.drawAnnounce(game, t);

    if (game.flash > 0) {
      ctx.globalAlpha = clamp(game.flash, 0, 0.85);
      ctx.fillStyle = game.flashColor || '#fff6e6';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    this.drawVignette();
    ctx.restore();
  }

  /* ============================================================
     BACKGROUND
     ============================================================ */
  drawBackground(game, t) {
    const ctx = this.ctx;
    const sky = ctx.createLinearGradient(0, 0, 0, 620);
    sky.addColorStop(0, '#0b0620');
    sky.addColorStop(0.22, '#22103e');
    sky.addColorStop(0.42, '#552055');
    sky.addColorStop(0.6, '#a83259');
    sky.addColorStop(0.75, '#e05a4b');
    sky.addColorStop(0.88, '#ff9256');
    sky.addColorStop(1, '#ffc879');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, 620);

    // stars
    for (const s of this.stars) {
      const a = 0.25 + 0.6 * (0.5 + 0.5 * Math.sin(t * 1.3 + s.p));
      ctx.fillStyle = `rgba(255,235,215,${a * (1 - s.y / 500)})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
    }

    // sun halo
    const sunX = 930;
    const sunY = 322;
    const halo = ctx.createRadialGradient(sunX, sunY, 20, sunX, sunY, 360);
    halo.addColorStop(0, 'rgba(255,196,110,0.55)');
    halo.addColorStop(0.35, 'rgba(255,120,90,0.22)');
    halo.addColorStop(1, 'rgba(255,90,90,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(sunX - 380, sunY - 380, 760, 760);

    // sun disc with slice stripes
    ctx.save();
    ctx.beginPath();
    ctx.arc(sunX, sunY + t * 0.4, 146, 0, TAU);
    ctx.clip();
    const sunG = ctx.createLinearGradient(0, sunY - 150, 0, sunY + 150);
    sunG.addColorStop(0, '#fff8d8');
    sunG.addColorStop(0.35, '#ffd57a');
    sunG.addColorStop(0.7, '#ff8b62');
    sunG.addColorStop(1, '#ff4f6e');
    ctx.fillStyle = sunG;
    ctx.fillRect(sunX - 160, sunY - 160, 320, 320);
    ctx.fillStyle = 'rgba(48,16,45,0.5)';
    for (let i = 0; i < 9; i++) {
      const yy = sunY + 18 + i * 17;
      const hh = 3 + i * 0.9;
      ctx.fillRect(sunX - 160, yy, 320, hh);
    }
    ctx.restore();

    // clouds
    for (const c of this.clouds) {
      const x = ((c.x + t * c.speed) % 1560) - 140;
      const g = ctx.createLinearGradient(0, c.y - c.h, 0, c.y + c.h);
      g.addColorStop(0, `rgba(60,28,72,${c.a})`);
      g.addColorStop(0.55, `rgba(255,140,120,${c.a * 0.5})`);
      g.addColorStop(1, `rgba(40,16,50,${c.a * 0.6})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, c.y, c.w * 0.5, c.h, 0, 0, TAU);
      ctx.ellipse(x + c.w * 0.26, c.y - c.h * 0.5, c.w * 0.3, c.h * 0.7, 0, 0, TAU);
      ctx.ellipse(x - c.w * 0.24, c.y + c.h * 0.2, c.w * 0.28, c.h * 0.6, 0, 0, TAU);
      ctx.fill();
    }

    // distant mountains
    ctx.fillStyle = '#4a2352';
    ctx.beginPath();
    ctx.moveTo(-20, 560);
    ctx.lineTo(120, 430);
    ctx.lineTo(250, 520);
    ctx.lineTo(390, 400);
    ctx.lineTo(540, 535);
    ctx.lineTo(700, 440);
    ctx.lineTo(850, 532);
    ctx.lineTo(1010, 415);
    ctx.lineTo(1170, 520);
    ctx.lineTo(1300, 455);
    ctx.lineTo(1300, 600);
    ctx.lineTo(-20, 600);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,150,120,0.12)';
    ctx.fill();

    ctx.fillStyle = '#371c46';
    ctx.beginPath();
    ctx.moveTo(-20, 600);
    ctx.lineTo(90, 470);
    ctx.lineTo(215, 550);
    ctx.lineTo(360, 460);
    ctx.lineTo(500, 560);
    ctx.lineTo(660, 490);
    ctx.lineTo(800, 566);
    ctx.lineTo(940, 470);
    ctx.lineTo(1090, 552);
    ctx.lineTo(1240, 480);
    ctx.lineTo(1300, 520);
    ctx.lineTo(1300, 620);
    ctx.lineTo(-20, 620);
    ctx.closePath();
    ctx.fill();

    // city skyline
    for (const b of this.buildings) {
      ctx.fillStyle = b.hue;
      ctx.fillRect(b.x, b.top, b.w, 560 - b.top);
      if (b.windows) {
        ctx.fillStyle = 'rgba(255,196,110,0.38)';
        for (let wy = b.top + 10; wy < 548; wy += 13) {
          for (let wx = b.x + 6; wx < b.x + b.w - 5; wx += 11) {
            if ((wx * 3 + wy * 7) % 11 < 4) ctx.fillRect(wx, wy, 3, 5);
          }
        }
      }
    }

    // torii gate silhouette (left) and pagoda (right)
    this.drawTorii(150, 470, 1.05);
    this.drawPagoda(1160, 440, 0.9);

    // haze over the city
    const haze = ctx.createLinearGradient(0, 400, 0, 590);
    haze.addColorStop(0, 'rgba(255,120,100,0)');
    haze.addColorStop(0.7, 'rgba(255,120,100,0.16)');
    haze.addColorStop(1, 'rgba(255,170,120,0.05)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 380, W, 220);

    this.drawArena(t);
    this.drawLanterns(t);
  }

  drawTorii(x, y, s) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = '#1c1022';
    ctx.fillRect(-70, -120, 14, 130);
    ctx.fillRect(56, -120, 14, 130);
    ctx.beginPath();
    ctx.moveTo(-104, -106);
    ctx.quadraticCurveTo(0, -96, 104, -106);
    ctx.lineTo(106, -120);
    ctx.quadraticCurveTo(0, -110, -106, -120);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(-88, -88, 176, 12);
    ctx.fillStyle = 'rgba(255,120,90,0.16)';
    ctx.fillRect(-70, -120, 14, 130);
    ctx.fillRect(56, -120, 14, 130);
    ctx.restore();
  }

  drawPagoda(x, y, s) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = '#1a0f22';
    ctx.fillRect(-24, -16, 48, 16);
    for (let i = 0; i < 4; i++) {
      const w = 42 - i * 8;
      const yy = -16 - i * 30;
      ctx.fillRect(-w / 2, yy - 22, w, 22);
      ctx.beginPath();
      ctx.moveTo(-w * 1.5, yy + 3);
      ctx.quadraticCurveTo(-w * 0.55, yy - 16, 0, yy - 20);
      ctx.quadraticCurveTo(w * 0.55, yy - 16, w * 1.5, yy + 3);
      ctx.lineTo(w * 0.9, yy + 6);
      ctx.lineTo(-w * 0.9, yy + 6);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillRect(-2, -152, 4, 34);
    ctx.fillStyle = 'rgba(255,180,110,0.35)';
    ctx.fillRect(-4, -60, 3, 8);
    ctx.fillRect(5, -92, 3, 8);
    ctx.restore();
  }

  drawArena(t) {
    const ctx = this.ctx;
    // back railing
    ctx.fillStyle = '#241225';
    ctx.fillRect(0, 508, W, 8);
    ctx.fillRect(0, 540, W, 6);
    for (let x = 0; x <= W; x += 104) {
      ctx.fillStyle = '#1b0e1e';
      ctx.fillRect(x + 12, 500, 10, 40);
      ctx.fillStyle = 'rgba(255,170,110,0.1)';
      ctx.fillRect(x + 12, 500, 3, 40);
    }
    // paper lanterns along the rail
    for (let x = 52; x <= W; x += 208) {
      const sway = Math.sin(t * 1.2 + x * 0.01) * 1.5;
      this.drawLantern(x + sway, 492, 0.38, t + x);
    }

    // deck
    const floor = ctx.createLinearGradient(0, 552, 0, 720);
    floor.addColorStop(0, '#4b2c40');
    floor.addColorStop(0.18, '#3a2335');
    floor.addColorStop(0.6, '#2a182c');
    floor.addColorStop(1, '#180d1b');
    ctx.fillStyle = floor;
    ctx.fillRect(0, 552, W, 168);

    // plank perspective
    ctx.save();
    ctx.strokeStyle = 'rgba(10,4,12,0.5)';
    ctx.lineWidth = 2;
    for (let x = -200; x <= W + 200; x += 96) {
      ctx.beginPath();
      ctx.moveTo(640 + (x - 640) * 0.18, 558);
      ctx.lineTo(x, 720);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,180,130,0.07)';
    ctx.lineWidth = 1;
    for (const y of [578, 600, 628, 665, 706]) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.restore();

    // warm pool of light
    const pool = ctx.createRadialGradient(640, 618, 20, 640, 618, 430);
    pool.addColorStop(0, 'rgba(255,170,110,0.16)');
    pool.addColorStop(0.6, 'rgba(255,120,80,0.05)');
    pool.addColorStop(1, 'rgba(255,90,60,0)');
    ctx.fillStyle = pool;
    ctx.fillRect(180, 552, 920, 168);

    // front lip
    ctx.fillStyle = '#120814';
    ctx.fillRect(0, 668, W, 52);
    const lip = ctx.createLinearGradient(0, 664, 0, 676);
    lip.addColorStop(0, '#c98c54');
    lip.addColorStop(0.5, '#6f3f2c');
    lip.addColorStop(1, '#2a1520');
    ctx.fillStyle = lip;
    ctx.fillRect(0, 662, W, 8);
    ctx.fillStyle = 'rgba(255,200,120,0.16)';
    ctx.fillRect(0, 662, W, 2);

    // side pillars (foreground framing)
    for (const px of [-14, 1258]) {
      const g = ctx.createLinearGradient(px, 0, px + 36, 0);
      g.addColorStop(0, '#08040c');
      g.addColorStop(0.5, '#1c0e1e');
      g.addColorStop(1, '#08040c');
      ctx.fillStyle = g;
      ctx.fillRect(px, 0, 36, 720);
      ctx.fillStyle = 'rgba(255,150,100,0.1)';
      ctx.fillRect(px === -14 ? 34 : px, 0, 2, 720);
    }
  }

  drawLanterns(t) {
    const ctx = this.ctx;
    // string lights
    ctx.strokeStyle = 'rgba(20,8,16,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 128);
    ctx.quadraticCurveTo(640, 190, 1280, 128);
    ctx.stroke();
    for (let i = 1; i < 11; i++) {
      const u = i / 11;
      const x = u * 1280;
      const y = 128 + Math.sin(u * Math.PI) * 54;
      const sway = Math.sin(t * 1.4 + i) * 2;
      this.drawLantern(x + sway, y + 8, 0.62, t + i * 0.7);
    }
    // hanging banners
    for (const [x, hue] of [[64, '#7c1c31'], [1216, '#18384f']]) {
      ctx.save();
      ctx.fillStyle = 'rgba(12,5,14,0.7)';
      ctx.fillRect(x - 22, 108, 44, 250);
      const bg = ctx.createLinearGradient(x - 20, 108, x + 20, 360);
      bg.addColorStop(0, hue);
      bg.addColorStop(1, '#160b18');
      ctx.fillStyle = bg;
      ctx.fillRect(x - 20, 112, 40, 240);
      ctx.strokeStyle = 'rgba(255,205,140,0.35)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - 14, 120, 28, 224);
      ctx.fillStyle = 'rgba(255,220,170,0.7)';
      ctx.save();
      ctx.translate(x, 190);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-8, -8, 16, 16);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(x, 250, 12, 0, TAU);
      ctx.strokeStyle = 'rgba(255,220,170,0.55)';
      ctx.stroke();
      ctx.restore();
    }
  }

  drawLantern(x, y, s, t) {
    const ctx = this.ctx;
    const glow = ctx.createRadialGradient(x, y, 2, x, y, 60 * s);
    glow.addColorStop(0, 'rgba(255,196,120,0.55)');
    glow.addColorStop(0.4, 'rgba(255,120,80,0.16)');
    glow.addColorStop(1, 'rgba(255,90,60,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 70 * s, y - 70 * s, 140 * s, 140 * s);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = '#241018';
    ctx.fillRect(-12, -30, 24, 5);
    ctx.fillStyle = '#e8543f';
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 20, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,214,140,0.55)';
    ctx.beginPath();
    ctx.ellipse(-3, -3, 7, 12, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,18,24,0.7)';
    ctx.lineWidth = 1.5;
    for (const yy of [-12, -2, 8]) {
      ctx.beginPath();
      ctx.ellipse(0, yy, 14 - Math.abs(yy) * 0.18, 3, 0, 0, Math.PI);
      ctx.stroke();
    }
    ctx.fillStyle = '#241018';
    ctx.fillRect(-8, 18, 16, 4);
    ctx.restore();
  }

  drawForeground(t) {
    const ctx = this.ctx;
    // drifting embers in front
    for (let i = 0; i < 12; i++) {
      const x = ((i * 173 + t * (10 + i * 2.4)) % 1340) - 30;
      const y = 640 - ((t * (18 + i * 3) + i * 57) % 210);
      const a = 0.12 + 0.18 * (0.5 + 0.5 * Math.sin(t * 2 + i));
      ctx.fillStyle = `rgba(255,190,120,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.6 + (i % 3) * 0.8, 0, TAU);
      ctx.fill();
    }
    // foreground petals near the camera
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 7; i++) {
      const x = ((i * 211 + t * (26 + i * 9)) % 1380) - 50;
      const y = ((t * (32 + i * 11) + i * 97) % 780) - 30;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * 1.5 + i);
      ctx.fillStyle = 'rgba(255,180,190,0.5)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 3.4, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  /* ============================================================
     FIGHTERS
     ============================================================ */
  drawProjectiles(game, t) {
    const ctx = this.ctx;
    for (const p of game.projectiles) {
      if (p.dead) continue;
      const pal = p.owner.pal;
      const x = p.x;
      const y = FLOOR_Y - p.y;
      const r = p.radius;
      const ex = p.ex;
      const auraR = r * (ex ? 3.4 : 2.7);
      const g = ctx.createRadialGradient(x, y, 2, x, y, auraR);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.25, rgba(pal.energy2, 0.95));
      g.addColorStop(0.55, rgba(pal.energy, 0.55));
      g.addColorStop(1, rgba(pal.energy, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, auraR, 0, TAU);
      ctx.fill();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(x, y);
      ctx.rotate(t * 6);
      ctx.strokeStyle = rgba(pal.energy2, 0.9);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.05, 0.2, 2.4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.35, 3.1, 5.4);
      ctx.stroke();
      ctx.rotate(-t * 10);
      ctx.fillStyle = rgba('#ffffff', 0.9);
      ctx.beginPath();
      ctx.arc(r * 0.15, -r * 0.1, r * 0.34, 0, TAU);
      ctx.fill();
      ctx.restore();
      if (ex) {
        ctx.strokeStyle = rgba(pal.energy, 0.4);
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(x, y, r * (1.7 + i * 0.4) + Math.sin(t * 5 + i) * 4, 0, TAU);
          ctx.stroke();
        }
      }
      // ground glow
      const gg = ctx.createRadialGradient(x, FLOOR_Y + 4, 2, x, FLOOR_Y + 4, r * 2.2);
      gg.addColorStop(0, rgba(pal.energy, 0.18));
      gg.addColorStop(1, rgba(pal.energy, 0));
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.ellipse(x, FLOOR_Y + 4, r * 2.2, r * 0.5, 0, 0, TAU);
      ctx.fill();
    }
  }

  drawFighter(f, game, t) {
    if (!f) return;
    const ctx = this.ctx;
    const pose = f.getPose();
    const elev = f.y;
    const rise = f.airborne ? elev : 0;
    const flash = f.flash > 0;
    const pal = f.pal;

    // shadow
    const shScale = 1 - clamp(rise / 480, 0, 0.6);
    ctx.save();
    ctx.globalAlpha = 0.34 * (1 - clamp(rise / 600, 0, 0.75));
    ctx.fillStyle = '#0a040c';
    ctx.beginPath();
    ctx.ellipse(f.x, FLOOR_Y + 6, 62 * shScale + 8, 11 * shScale + 2, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    // super ready aura
    if (f.meter >= 100 && f.state !== 'ko' && f.state !== 'win') {
      const pulse = 0.5 + 0.5 * Math.sin(t * 7);
      const aura = ctx.createRadialGradient(f.x, FLOOR_Y - elev - 80, 10, f.x, FLOOR_Y - elev - 80, 110);
      aura.addColorStop(0, rgba(pal.energy, 0.13 + pulse * 0.07));
      aura.addColorStop(1, rgba(pal.energy, 0));
      ctx.fillStyle = aura;
      ctx.fillRect(f.x - 120, FLOOR_Y - elev - 200, 240, 240);
      if (Math.random() < 0.25) game.fx.aura(f.x, FLOOR_Y - elev - 30, pal.energy2);
    }

    const pelvisY = FLOOR_Y - rise - pose.hipY + (pose.offY || 0);
    ctx.save();
    ctx.translate(f.x, FLOOR_Y - rise);
    ctx.scale(f.facing * FIGHTER_SCALE, FIGHTER_SCALE);
    ctx.translate(0, -pose.hipY);
    if (pose.rot) ctx.rotate(pose.rot);
    this.drawSkeleton(f, pose, pal, flash, game, t);
    ctx.restore();

    // move-specific energy
    this.drawMoveFx(f, game, t);
  }

  drawSkeleton(f, pose, pal, flash, game, t) {
    const ctx = this.ctx;
    const C = (key) => (flash ? mix(pal[key], '#ffffff', 0.72) : pal[key]);
    const outline = '#180f1d';
    const lean = pose.lean || 0;

    const torsoPoint = (x, y) => rot(x, y, lean);
    const chest = torsoPoint(0, -56);
    const shoulderF = torsoPoint(10, -58);
    const shoulderB = torsoPoint(-10, -58);

    const elbowF = ik(shoulderF, pose.handF, 28, 28, 1);
    const elbowB = ik(shoulderB, pose.handB, 28, 28, 1);
    const hipF = { x: 10, y: 1 };
    const hipB = { x: -10, y: 1 };
    const kneeF = ik(hipF, pose.footF, 39, 36, -1);
    const kneeB = ik(hipB, pose.footB, 39, 36, -1);
    const footF = pose.footF;
    const footB = pose.footB;

    // back arm
    this.drawArm(shoulderB, elbowB, pose.handB, C('giDark'), C('skinDark'), C('gloveDark'), outline, true);

    // back leg
    this.drawLeg(hipB, kneeB, footB, C('giDark'), C('giDark'), C('boot'), outline, true);

    // torso group
    ctx.save();
    ctx.rotate(lean);
    this.drawTorso(C, outline, f, flash, t);
    // head
    const headTilt = (pose.tilt || 0);
    ctx.save();
    ctx.translate(4, -54);
    ctx.rotate(headTilt * 0.6);
    this.drawHead(f, C, outline, flash, t, game);
    ctx.restore();
    ctx.restore();

    // front leg
    this.drawLeg(hipF, kneeF, footF, C('gi'), C('giShade'), C('boot'), outline, false);

    // front arm
    this.drawArm(shoulderF, elbowF, pose.handF, C('gi'), C('skin'), C('glove'), outline, false);

    // fists over everything
    this.drawGlove(pose.handF, C('glove'), C('gloveDark'), outline, 1);
    this.drawGlove(pose.handB, C('gloveDark'), C('gloveDark'), outline, 0.9);

    // foot tips
    this.drawFoot(footF, C('boot'), outline, 1);
    this.drawFoot(footB, C('boot'), outline, 0.92);
  }

  drawArm(shoulder, elbow, hand, sleeve, skin, glove, outline, back) {
    const ctx = this.ctx;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(shoulder.x, shoulder.y);
    ctx.lineTo(elbow.x, elbow.y);
    ctx.lineTo(hand.x, hand.y);
    ctx.strokeStyle = outline;
    ctx.lineWidth = back ? 19 : 20;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(shoulder.x, shoulder.y);
    ctx.lineTo(elbow.x, elbow.y);
    ctx.strokeStyle = sleeve;
    ctx.lineWidth = back ? 14 : 15;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(elbow.x, elbow.y);
    ctx.lineTo(hand.x, hand.y);
    ctx.strokeStyle = skin;
    ctx.lineWidth = back ? 10 : 11;
    ctx.stroke();
    // wrist wrap
    const wr = 0.82;
    const wx = lerp(elbow.x, hand.x, wr);
    const wy = lerp(elbow.y, hand.y, wr);
    ctx.strokeStyle = sleeve;
    ctx.lineWidth = back ? 11 : 12;
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.lineTo(lerp(elbow.x, hand.x, 0.93), lerp(elbow.y, hand.y, 0.93));
    ctx.stroke();
  }

  drawLeg(hip, knee, foot, pant, skin, boot, outline, back) {
    const ctx = this.ctx;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(hip.x, hip.y);
    ctx.lineTo(knee.x, knee.y);
    ctx.lineTo(foot.x, foot.y);
    ctx.strokeStyle = outline;
    ctx.lineWidth = back ? 25 : 26;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hip.x, hip.y);
    ctx.lineTo(knee.x, knee.y);
    ctx.strokeStyle = pant;
    ctx.lineWidth = back ? 20 : 21;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(knee.x, knee.y);
    ctx.lineTo(foot.x, foot.y);
    ctx.strokeStyle = back ? skin : skin;
    ctx.lineWidth = back ? 15 : 16;
    ctx.stroke();
    // ankle cuff
    const u = 0.86;
    const ax = lerp(knee.x, foot.x, u);
    const ay = lerp(knee.y, foot.y, u);
    ctx.strokeStyle = boot;
    ctx.lineWidth = back ? 13 : 14;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(foot.x, foot.y);
    ctx.stroke();
  }

  drawTorso(C, outline, f, flash, t) {
    const ctx = this.ctx;
    // back skirt
    ctx.beginPath();
    ctx.moveTo(-14, -4);
    ctx.lineTo(-26, 24);
    ctx.quadraticCurveTo(-14, 30, -2, 26);
    ctx.lineTo(-2, -2);
    ctx.closePath();
    ctx.fillStyle = C('giShade') || C('gi');
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    ctx.fill();
    ctx.stroke();

    // jacket
    ctx.beginPath();
    ctx.moveTo(-17, -58);
    ctx.quadraticCurveTo(0, -64, 17, -58);
    ctx.lineTo(15, -6);
    ctx.quadraticCurveTo(12, 2, 0, 2);
    ctx.quadraticCurveTo(-12, 2, -15, -6);
    ctx.closePath();
    const g = ctx.createLinearGradient(-18, -60, 18, 0);
    g.addColorStop(0, C('giShade'));
    g.addColorStop(0.55, C('gi'));
    g.addColorStop(1, C('giDark'));
    ctx.fillStyle = g;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3.5;
    ctx.fill();
    ctx.stroke();

    // front skirt flap
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(26, 26);
    ctx.quadraticCurveTo(14, 32, 0, 26);
    ctx.lineTo(-2, 0);
    ctx.closePath();
    ctx.fillStyle = C('gi');
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    ctx.fill();
    ctx.stroke();

    // V neck (skin)
    ctx.beginPath();
    ctx.moveTo(-7, -57);
    ctx.lineTo(7, -57);
    ctx.lineTo(2, -34);
    ctx.closePath();
    ctx.fillStyle = C('skin');
    ctx.fill();

    // lapels
    ctx.strokeStyle = C('trim');
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-8, -57);
    ctx.lineTo(2, -33);
    ctx.lineTo(11, -50);
    ctx.stroke();

    // belt
    ctx.fillStyle = C('belt');
    ctx.beginPath();
    ctx.roundRect(-16, -6, 32, 11, 2);
    ctx.fill();
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = C('trim');
    ctx.fillRect(-4, -6, 8, 11);

    // gi fold lines
    ctx.strokeStyle = rgba(flash ? '#ffffff' : '#000000', 0.15);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-11, -40);
    ctx.lineTo(-6, -12);
    ctx.moveTo(-14, -26);
    ctx.lineTo(-9, -20);
    ctx.stroke();

    // headband tails
    if (f.pal.band) {
      ctx.save();
      const sway = Math.sin(t * 6 + f.time * 2) * 4;
      ctx.strokeStyle = C('bandDark');
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-12, -38);
      ctx.quadraticCurveTo(-28, -34 + sway, -40, -24 + sway * 1.4);
      ctx.stroke();
      ctx.strokeStyle = C('band');
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-13, -41);
      ctx.quadraticCurveTo(-30, -38 + sway, -46, -30 + sway * 1.3);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawHead(f, C, outline, flash, t, game) {
    const ctx = this.ctx;
    // neck
    ctx.strokeStyle = outline;
    ctx.lineWidth = 13;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.lineTo(2, -8);
    ctx.stroke();
    ctx.strokeStyle = C('skinDark');
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.lineTo(2, -8);
    ctx.stroke();

    // head base
    const hx = 3;
    const hy = -26;
    ctx.beginPath();
    ctx.ellipse(hx, hy, 14.5, 17, 0.06, 0, TAU);
    ctx.fillStyle = C('skin');
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    ctx.fill();
    ctx.stroke();
    // jaw shade
    ctx.fillStyle = rgba(C('skinDark'), 0.55);
    ctx.beginPath();
    ctx.ellipse(hx - 1, hy + 9, 10, 6, 0.1, 0, Math.PI);
    ctx.fill();
    // ear
    ctx.fillStyle = C('skin');
    ctx.beginPath();
    ctx.ellipse(hx - 12, hy + 1, 3.4, 5, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2;
    ctx.stroke();

    // hair cap
    ctx.fillStyle = C('hair');
    ctx.beginPath();
    ctx.ellipse(hx - 2, hy - 7, 15.5, 13.5, -0.1, Math.PI * 0.92, Math.PI * 2.12);
    ctx.lineTo(hx + 13, hy - 4);
    ctx.quadraticCurveTo(hx + 2, hy - 16, hx - 13, hy - 6);
    ctx.fill();
    // hair spikes / swept shape
    ctx.beginPath();
    if (f.name === 'REN') {
      ctx.moveTo(hx - 10, hy - 12);
      ctx.quadraticCurveTo(hx - 32, hy - 26, hx - 44, hy - 6 + Math.sin(t * 4) * 2);
      ctx.quadraticCurveTo(hx - 30, hy - 12, hx - 14, hy - 2);
    } else {
      ctx.moveTo(hx - 12, hy - 10);
      ctx.lineTo(hx - 22, hy - 22);
      ctx.lineTo(hx - 18, hy - 6);
      ctx.lineTo(hx - 27, hy - 10);
      ctx.lineTo(hx - 20, hy + 2);
    }
    ctx.closePath();
    ctx.fillStyle = C('hair');
    ctx.fill();
    // hair shine
    ctx.strokeStyle = C('hairShine');
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hx, hy - 2, 12, Math.PI * 1.15, Math.PI * 1.55);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // headband
    ctx.strokeStyle = C('band');
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(hx - 14, hy - 8);
    ctx.quadraticCurveTo(hx + 1, hy - 12, hx + 15, hy - 7);
    ctx.stroke();
    ctx.strokeStyle = rgba('#000000', 0.2);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(hx - 13, hy - 5.5);
    ctx.quadraticCurveTo(hx + 1, hy - 9.5, hx + 14, hy - 4.5);
    ctx.stroke();

    // face
    const faceFlash = flash;
    // brow
    ctx.strokeStyle = faceFlash ? '#ffb0a0' : '#241325';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hx + 5, hy - 7);
    ctx.lineTo(hx + 12, hy - 5);
    ctx.stroke();
    // eye
    ctx.fillStyle = '#fff8ec';
    ctx.beginPath();
    ctx.ellipse(hx + 9, hy - 1, 3.4, 2.4, -0.12, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#251426';
    ctx.beginPath();
    ctx.arc(hx + 10, hy - 1, 1.5, 0, TAU);
    ctx.fill();
    // nose
    ctx.strokeStyle = rgba(C('skinDark'), 0.9);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(hx + 14, hy + 2);
    ctx.lineTo(hx + 11, hy + 5);
    ctx.stroke();
    // mouth
    ctx.strokeStyle = '#4a2028';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(hx + 7, hy + 9);
    ctx.lineTo(hx + 12, hy + 8.6);
    ctx.stroke();
    // cheek mark
    ctx.strokeStyle = rgba(C('trim'), 0.5);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(hx + 4, hy + 3);
    ctx.lineTo(hx + 8, hy + 4);
    ctx.stroke();
  }

  drawGlove(p, color, dark, outline, scale) {
    const ctx = this.ctx;
    const r = 8.6 * scale;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, TAU);
    ctx.fillStyle = color;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = rgba('#ffffff', 0.22);
    ctx.beginPath();
    ctx.arc(p.x - r * 0.25, p.y - r * 0.3, r * 0.4, 0, TAU);
    ctx.fill();
  }

  drawFoot(p, color, outline, scale) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = color;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(3, 2, 13 * scale, 7 * scale, 0.06, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = rgba('#ffffff', 0.12);
    ctx.beginPath();
    ctx.ellipse(5, -1, 7, 2.4, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  drawMoveFx(f, game, t) {
    const m = f.move;
    if (!m) return;
    const ctx = this.ctx;
    const pal = f.pal;
    const x = f.x;
    const y0 = FLOOR_Y - f.y;
    if (m.moveId === 'fireball') {
      const k = clamp(m.time / m.startup, 0, 1);
      const rel = m.time > m.startup && m.time < m.startup + m.active + 0.1;
      if (rel || k > 0.55) {
        const hx = x + f.facing * (rel ? 66 : 40);
        const hy = y0 - (rel ? 100 : 85);
        const r = (rel ? 30 : 16) * (m.ex ? 1.4 : 1) + Math.sin(t * 24) * 3;
        const g = ctx.createRadialGradient(hx, hy, 2, hx, hy, r);
        g.addColorStop(0, 'rgba(255,255,255,0.95)');
        g.addColorStop(0.4, rgba(pal.energy2, 0.85));
        g.addColorStop(1, rgba(pal.energy, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(hx, hy, r, 0, TAU);
        ctx.fill();
      }
    } else if (m.moveId === 'dp') {
      if (m.time > m.startup * 0.7 && m.time < m.total * 0.7) {
        const hx = x + f.facing * 28;
        const hy = y0 - 150;
        const r = 30 + Math.sin(t * 30) * 4 + (m.ex ? 16 : 0);
        const g = ctx.createRadialGradient(hx, hy, 2, hx, hy, r * 2);
        g.addColorStop(0, rgba('#ffffff', 0.8));
        g.addColorStop(0.35, rgba(pal.energy2, 0.6));
        g.addColorStop(1, rgba(pal.energy, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(hx, hy, r, r * 1.5, 0, 0, TAU);
        ctx.fill();
        // rising streaks
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 4; i++) {
          const oy = (t * 480 + i * 47) % 150;
          ctx.strokeStyle = rgba(pal.energy2, 0.5 * (1 - oy / 150));
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(x - 20 + i * 11, y0 - 20 - oy);
          ctx.lineTo(x - 24 + i * 11, y0 - 46 - oy);
          ctx.stroke();
        }
        ctx.restore();
      }
    } else if (m.moveId === 'spin') {
      if (m.time > m.startup && m.time < m.startup + m.active) {
        ctx.save();
        ctx.translate(x, y0 - 80);
        ctx.rotate(t * 9);
        ctx.strokeStyle = rgba(pal.energy, 0.35);
        ctx.lineWidth = 5;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(0, 0, 52 + i * 12, i * 2.1, i * 2.1 + 1.7);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    if (m.ex) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(pal.energy2, 0.25);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y0 - 80, 74 + Math.sin(t * 12) * 6, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ============================================================
     HUD
     ============================================================ */
  drawHUD(game, t) {
    const ctx = this.ctx;
    const p = game.player;
    const c = game.cpu;
    const gold = '#ffc857';

    // health bars
    this.drawHealthBar(86, 46, 470, 30, p.hp / p.maxHp, p.trailHp / p.maxHp, 1, p.pal);
    this.drawHealthBar(1194, 46, 470, 30, c.hp / c.maxHp, c.trailHp / c.maxHp, -1, c.pal);

    // portraits
    this.drawPortrait(54, 61, p, '#ff5c72');
    this.drawPortrait(1226, 61, c, '#3fe6ff');

    // names
    ctx.textBaseline = 'alphabetic';
    ctx.font = `26px ${FONT_DISPLAY}`;
    ctx.letterSpacing = '2px';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffe9cf';
    this.strokeText('KAZE', 88, 36, 4, '#1a0d18');
    ctx.font = `700 10px ${FONT_UI}`;
    ctx.letterSpacing = '2.5px';
    ctx.fillStyle = '#ffb45c';
    ctx.fillText('PLAYER 01', 88, 24);
    ctx.textAlign = 'right';
    ctx.font = `26px ${FONT_DISPLAY}`;
    ctx.letterSpacing = '2px';
    ctx.fillStyle = '#dff8ff';
    this.strokeText('REN', 1192, 36, 4, '#0a1620');
    ctx.font = `700 10px ${FONT_UI}`;
    ctx.letterSpacing = '2.5px';
    ctx.fillStyle = '#6fe4ff';
    ctx.fillText('CPU', 1192, 24);
    ctx.letterSpacing = '0px';

    // timer panel
    this.drawTimer(game, t);

    // round pips
    for (let i = 0; i < 2; i++) {
      this.drawPip(600 - i * 18, 112, i < p.wins, '#ff5c72');
      this.drawPip(680 + i * 18, 112, i < c.wins, '#3fe6ff');
    }

    // super meters
    this.drawMeter(86, 674, 330, 14, p.meter / 100, 1, p.pal, t);
    this.drawMeter(1194, 674, 330, 14, c.meter / 100, -1, c.pal, t);

    // combo counters
    if (p.combo >= 2 && game.state === 'fight') this.drawCombo(300, 150, p.combo, 1, p.pal);
    if (c.combo >= 2 && game.state === 'fight') this.drawCombo(980, 150, c.combo, -1, c.pal);

    // special-move hints
    ctx.textAlign = 'center';
    ctx.font = `600 10px ${FONT_UI}`;
    ctx.letterSpacing = '2px';
    ctx.fillStyle = 'rgba(255,225,190,0.34)';
    ctx.fillText('A / D  MOVE   ·   W  JUMP   ·   HOLD BACK TO GUARD   ·   J JAB   K HEAVY   L KICK   ·   U / I / O SPECIALS', 640, 706);
    ctx.letterSpacing = '0px';
    ctx.textAlign = 'left';
  }

  strokeText(text, x, y, w, color) {
    const ctx = this.ctx;
    ctx.lineWidth = w;
    ctx.strokeStyle = color;
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  }

  drawHealthBar(x, y, w, h, ratio, trail, dir, pal) {
    const ctx = this.ctx;
    const skew = 9;
    const path = () => {
      ctx.beginPath();
      if (dir === 1) {
        ctx.moveTo(x + skew, y);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x + w - skew, y + h);
        ctx.lineTo(x, y + h);
      } else {
        ctx.moveTo(x, y);
        ctx.lineTo(x - w, y);
        ctx.lineTo(x - w + skew, y + h);
        ctx.lineTo(x + skew, y + h);
      }
      ctx.closePath();
    };
    const bx = dir === 1 ? x : x - w;
    ctx.save();
    // frame
    path();
    ctx.fillStyle = '#140a15';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,208,150,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // inner
    ctx.save();
    path();
    ctx.clip();
    ctx.fillStyle = '#3a1620';
    ctx.fillRect(bx, y, w, h);
    // trail
    const tw = w * clamp(trail, 0, 1);
    ctx.fillStyle = 'rgba(255,75,95,0.75)';
    if (dir === 1) ctx.fillRect(bx, y + 3, tw, h - 6);
    else ctx.fillRect(bx + w - tw, y + 3, tw, h - 6);
    // hp fill
    const fw = w * clamp(ratio, 0, 1);
    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, '#fff2b0');
    grad.addColorStop(0.35, '#ffd457');
    grad.addColorStop(0.75, '#ff9f3d');
    grad.addColorStop(1, '#e8692c');
    ctx.fillStyle = grad;
    if (dir === 1) {
      ctx.fillRect(bx, y + 3, fw, h - 6);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(bx, y + 3, fw, 3);
    } else {
      ctx.fillRect(bx + w - fw, y + 3, fw, h - 6);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(bx + w - fw, y + 3, fw, 3);
    }
    // segment ticks
    ctx.fillStyle = 'rgba(20,8,18,0.5)';
    for (let i = 1; i < 5; i++) {
      const tx = bx + (w * i) / 5;
      ctx.fillRect(tx - 1, y, 2, h);
    }
    ctx.restore();
    ctx.restore();

    // outer glow if low
    if (ratio < 0.25) {
      ctx.save();
      path();
      ctx.strokeStyle = `rgba(255,70,90,${0.35 + 0.3 * Math.sin(this.time * 9)})`;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
    // small end caps
    ctx.fillStyle = 'rgba(255,210,150,0.6)';
    if (dir === 1) ctx.fillRect(x + w - 2, y + 2, 2, h - 4);
    else ctx.fillRect(x - w, y + 2, 2, h - 4);
  }

  drawTimer(game, t) {
    const ctx = this.ctx;
    const cx = 640;
    const w = 104;
    const h = 64;
    const y = 30;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 + 10, y);
    ctx.lineTo(cx + w / 2 + 10, y);
    ctx.lineTo(cx + w / 2 - 10, y + h);
    ctx.lineTo(cx - w / 2 - 10, y + h);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(30,16,32,0.95)');
    g.addColorStop(1, 'rgba(12,6,16,0.95)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,200,120,0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const secs = Math.ceil(game.timer);
    const danger = secs <= 10 && game.state === 'fight';
    ctx.font = `54px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = danger ? `rgba(255,${90 + Math.sin(t * 14) * 40},100,1)` : '#ffeecb';
    ctx.fillText(String(Math.max(0, secs)).padStart(2, '0'), cx, y + h / 2 + 4);
    ctx.font = `700 8px ${FONT_UI}`;
    ctx.letterSpacing = '3px';
    ctx.fillStyle = 'rgba(255,210,160,0.6)';
    ctx.fillText('TIME', cx, y + h + 12);
    ctx.letterSpacing = '0px';
    ctx.restore();
  }

  drawPip(x, y, filled, color) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = filled ? color : 'rgba(255,255,255,0.12)';
    ctx.fillRect(-5, -5, 10, 10);
    if (filled) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fillRect(-5, -5, 10, 10);
    }
    ctx.restore();
  }

  drawPortrait(x, y, f, color) {
    const ctx = this.ctx;
    const r = 25;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = '#170c19';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r - 3, 0, TAU);
    ctx.clip();
    const g = ctx.createLinearGradient(x, y - r, x, y + r);
    g.addColorStop(0, f.pal.giShade);
    g.addColorStop(1, f.pal.giDark);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    // mini head
    ctx.fillStyle = f.pal.skin;
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 5, 12, 14, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = f.pal.hair;
    ctx.beginPath();
    ctx.ellipse(x, y - 4, 14, 11, -0.1, Math.PI * 0.9, Math.PI * 2.1);
    ctx.fill();
    ctx.strokeStyle = f.pal.band;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x - 12, y - 1);
    ctx.lineTo(x + 14, y - 1);
    ctx.stroke();
    ctx.fillStyle = '#1a0c18';
    ctx.beginPath();
    ctx.ellipse(x + 8, y + 5, 2.6, 1.9, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#3a1a22';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 11);
    ctx.lineTo(x + 10, y + 11);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, r - 5, 0, TAU);
    ctx.stroke();
  }

  drawMeter(x, y, w, h, ratio, dir, pal, t) {
    const ctx = this.ctx;
    const bx = dir === 1 ? x : x - w;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(bx + 6, y);
    ctx.lineTo(bx + w, y);
    ctx.lineTo(bx + w - 6, y + h);
    ctx.lineTo(bx, y + h);
    ctx.closePath();
    ctx.fillStyle = 'rgba(10,5,14,0.75)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,180,0.22)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.save();
    ctx.clip();
    const fw = (w - 4) * clamp(ratio, 0, 1);
    const g = ctx.createLinearGradient(bx, 0, bx + w, 0);
    const full = ratio >= 1;
    if (full) {
      g.addColorStop(0, rgba(pal.energy2, 1));
      g.addColorStop(0.5, '#ffffff');
      g.addColorStop(1, rgba(pal.energy, 1));
    } else {
      g.addColorStop(0, rgba(pal.energy, 0.55));
      g.addColorStop(1, rgba(pal.energy2, 0.8));
    }
    ctx.fillStyle = g;
    if (dir === 1) ctx.fillRect(bx + 2, y + 2, fw, h - 4);
    else ctx.fillRect(bx + w - 2 - fw, y + 2, fw, h - 4);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(bx + 2, y + 2, w - 4, 2);
    ctx.restore();
    // segments
    ctx.fillStyle = 'rgba(10,5,14,0.6)';
    for (let i = 1; i < 4; i++) ctx.fillRect(bx + (w * i) / 4 - 1, y, 2, h);
    ctx.restore();

    ctx.font = `700 9px ${FONT_UI}`;
    ctx.letterSpacing = '2px';
    ctx.fillStyle = full ? `rgba(255,240,190,${0.75 + 0.25 * Math.sin(t * 10)})` : 'rgba(255,220,180,0.5)';
    ctx.textAlign = dir === 1 ? 'left' : 'right';
    ctx.fillText(full ? 'SUPER READY' : 'SUPER', dir === 1 ? bx + 2 : bx + w - 2, y - 5);

    if (full) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,240,190,${0.25 + 0.2 * Math.sin(t * 8)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (dir === 1) ctx.roundRect(bx - 2, y - 2, w + 4, h + 4, 3);
      else ctx.roundRect(bx - 2, y - 2, w + 4, h + 4, 3);
      ctx.stroke();
      ctx.restore();
    }
    ctx.letterSpacing = '0px';
  }

  drawCombo(x, y, count, dir, pal) {
    const ctx = this.ctx;
    const pop = Math.min(1, count / 6);
    ctx.save();
    ctx.textAlign = dir === 1 ? 'left' : 'right';
    ctx.font = `${48 + pop * 14}px ${FONT_DISPLAY}`;
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#180c18';
    ctx.fillStyle = '#ffe0a0';
    ctx.strokeText(`${count}`, x, y);
    ctx.fillText(`${count}`, x, y);
    ctx.font = `700 14px ${FONT_UI}`;
    ctx.letterSpacing = '3px';
    ctx.fillStyle = rgba(pal.energy, 1);
    ctx.strokeStyle = '#180c18';
    ctx.lineWidth = 4;
    const label = count >= 5 ? 'SAVAGE HITS' : 'HIT COMBO';
    const lx = dir === 1 ? x + 34 + pop * 8 : x - 34 - pop * 8;
    ctx.strokeText(label, lx, y - 8);
    ctx.fillText(label, lx, y - 8);
    ctx.letterSpacing = '0px';
    ctx.restore();
  }

  drawAnnounce(game, t) {
    const a = game.announce;
    if (!a || a.life <= 0) return;
    const ctx = this.ctx;
    const inT = a.dur - a.life;
    const k = clamp(inT / 0.24, 0, 1);
    const out = clamp(a.life / 0.28, 0, 1);
    const scale = 1 + (1 - easeOut(k)) * 0.55;
    let alpha = Math.min(k * 1.5, 1) * out;
    if (a.text === 'K.O.') alpha = Math.max(alpha, a.life > 0.4 ? 1 : a.life / 0.4);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(640, a.y || 300);
    ctx.scale(scale, scale);
    ctx.rotate(-0.03);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${a.size || 118}px ${FONT_DISPLAY}`;
    ctx.letterSpacing = '4px';

    // glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = a.glow || 'rgba(255,120,70,0.18)';
    ctx.filter = 'blur(12px)';
    ctx.fillText(a.text, 0, 0);
    ctx.restore();

    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#160a16';
    ctx.lineWidth = 14;
    ctx.strokeText(a.text, 0, 0);
    const g = ctx.createLinearGradient(0, -70, 0, 70);
    if (a.style === 'red') {
      g.addColorStop(0, '#fff2e2');
      g.addColorStop(0.4, '#ff8d7a');
      g.addColorStop(1, '#d0153e');
    } else if (a.style === 'cyan') {
      g.addColorStop(0, '#eafcff');
      g.addColorStop(0.5, '#7fe6ff');
      g.addColorStop(1, '#1e74c8');
    } else {
      g.addColorStop(0, '#fffbe8');
      g.addColorStop(0.45, '#ffd477');
      g.addColorStop(1, '#f07a2c');
    }
    ctx.fillStyle = g;
    ctx.fillText(a.text, 0, 0);
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 1.6;
    ctx.strokeText(a.text, 0, 0);

    if (a.sub) {
      ctx.font = `700 ${Math.max(12, (a.size || 118) * 0.13)}px ${FONT_UI}`;
      ctx.letterSpacing = '6px';
      ctx.fillStyle = 'rgba(255,238,215,0.92)';
      ctx.strokeStyle = '#160a16';
      ctx.lineWidth = 5;
      const sy = (a.size || 118) * 0.52;
      ctx.strokeText(a.sub, 0, sy);
      ctx.fillText(a.sub, 0, sy);
    }
    ctx.letterSpacing = '0px';
    ctx.restore();
  }

  drawVignette() {
    const ctx = this.ctx;
    const g = ctx.createRadialGradient(640, 360, 250, 640, 380, 780);
    g.addColorStop(0, 'rgba(4,2,8,0)');
    g.addColorStop(0.62, 'rgba(4,2,8,0.26)');
    g.addColorStop(1, 'rgba(4,2,8,0.82)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(12,5,16,0.16)';
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  }
}
