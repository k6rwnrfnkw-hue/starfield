/**
 * interaction.js  —  鼠标视差 + 星星连线 + 点击爆炸特效
 */

const CONNECT_DIST = 80;
const MAX_OFFSET   = 28;
const LERP         = 0.06;

// 爆炸粒子颜色表（按星云主色 + 白光）
const BURST_COLORS = [
  [200, 180, 255], // 紫
  [120, 180, 255], // 蓝
  [255, 160, 220], // 玫红
  [255, 240, 180], // 金黄
  [255, 255, 255], // 白
];

export class Interaction {
  constructor() {
    this.mx = window.innerWidth  / 2;
    this.my = window.innerHeight / 2;
    this._nx = 0;
    this._ny = 0;
    this.explosions  = [];
    this.gravityWell = null; // { x, y, strength, life, maxLife }

    window.addEventListener('mousemove', e => {
      this.mx = e.clientX;
      this.my = e.clientY;
    }, { passive: true });
  }

  /** 在 (x, y) 创建引力井 */
  createGravityWell(x, y) {
    this.gravityWell = { x, y, strength: 0.25, life: 3000, maxLife: 3000 };
  }

  /** 更新引力井，把附近星星向中心拉 */
  updateGravityWell(stars, dt) {
    const gw = this.gravityWell;
    if (!gw) return;
    gw.life -= dt;
    if (gw.life <= 0) { this.gravityWell = null; return; }

    const maxR = 280, str = gw.strength;
    for (const s of stars) {
      const dx = gw.x - (s.x + (s.offsetX ?? 0));
      const dy = gw.y - (s.y + (s.offsetY ?? 0));
      const d  = Math.sqrt(dx * dx + dy * dy);
      if (d < maxR && d > 2) {
        const f = (str * (1 - d / maxR) * dt) / d;
        s.offsetX = (s.offsetX ?? 0) + dx * f;
        s.offsetY = (s.offsetY ?? 0) + dy * f;
      }
    }
  }

  /** 绘制引力井光环 */
  drawGravityWell(ctx) {
    const gw = this.gravityWell;
    if (!gw) return;
    const t  = gw.life / gw.maxLife;
    const pulse = Date.now() * 0.003;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let ring = 0; ring < 3; ring++) {
      const r = (30 + ring * 50) * (1 + 0.06 * Math.sin(pulse + ring));
      const a = t * (0.3 - ring * 0.08);
      ctx.beginPath();
      ctx.arc(gw.x, gw.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(180,140,255,${a.toFixed(3)})`;
      ctx.lineWidth   = 1.5;
      ctx.shadowColor = 'rgba(180,140,255,0.7)';
      ctx.shadowBlur  = 12;
      ctx.stroke();
    }
    // 中心暗核
    const core = ctx.createRadialGradient(gw.x, gw.y, 0, gw.x, gw.y, 28);
    core.addColorStop(0, `rgba(0,0,0,${(t * 0.6).toFixed(3)})`);
    core.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(gw.x, gw.y, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** 在 (x, y) 触发一次爆炸 */
  explode(x, y) {
    const count = 55 + Math.floor(Math.random() * 25);
    const particles = [];

    for (let i = 0; i < count; i++) {
      const angle  = Math.random() * Math.PI * 2;
      const speed  = 1.5 + Math.random() * 4.5;
      const life   = 600 + Math.random() * 700;
      const color  = BURST_COLORS[Math.floor(Math.random() * BURST_COLORS.length)];
      const size   = 1.2 + Math.random() * 2.8;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life, maxLife: life,
        color, size,
        trail: [],        // 拖尾历史坐标
      });
    }

    // 冲击波圆环
    this.explosions.push({
      x, y,
      particles,
      shockwave: { r: 0, maxR: 180, life: 400, maxLife: 400 },
      flashLife: 120, flashMaxLife: 120, // 白光闪烁
    });
  }

  /** 每帧更新所有爆炸 */
  updateExplosions(dt) {
    for (const exp of this.explosions) {
      // 更新粒子
      for (const p of exp.particles) {
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 6) p.trail.shift();

        p.x  += p.vx * dt * 0.06;
        p.y  += p.vy * dt * 0.06;
        p.vy += 0.012 * dt;       // 微重力下坠
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.life -= dt;
      }
      exp.particles = exp.particles.filter(p => p.life > 0);

      // 更新冲击波
      const sw = exp.shockwave;
      const swProgress = 1 - sw.life / sw.maxLife;
      sw.r  = sw.maxR * swProgress;
      sw.life -= dt;

      // 白光
      if (exp.flashLife > 0) exp.flashLife -= dt;
    }
    this.explosions = this.explosions.filter(e => e.particles.length > 0 || e.shockwave.life > 0);
  }

  /** 绘制所有爆炸 */
  drawExplosions(ctx) {
    for (const exp of this.explosions) {
      // 白光闪烁（爆炸瞬间）
      if (exp.flashLife > 0) {
        const fa = (exp.flashLife / exp.flashMaxLife) * 0.35;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const fg = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, 120);
        fg.addColorStop(0, `rgba(255,255,255,${fa.toFixed(3)})`);
        fg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(exp.x, exp.y, 120, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 冲击波圆环
      const sw = exp.shockwave;
      if (sw.life > 0) {
        const sa = (sw.life / sw.maxLife) * 0.6;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.beginPath();
        ctx.arc(exp.x, exp.y, sw.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(180,210,255,${sa.toFixed(3)})`;
        ctx.lineWidth = 2.5 * (sw.life / sw.maxLife);
        ctx.shadowColor = 'rgba(140,190,255,0.8)';
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.restore();
      }

      // 爆炸粒子 + 拖尾
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (const p of exp.particles) {
        const t = p.life / p.maxLife;
        const [r, g, b] = p.color;

        // 拖尾
        if (p.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(p.trail[0].x, p.trail[0].y);
          for (let i = 1; i < p.trail.length; i++) ctx.lineTo(p.trail[i].x, p.trail[i].y);
          ctx.lineTo(p.x, p.y);
          ctx.strokeStyle = `rgba(${r},${g},${b},${(t * 0.4).toFixed(3)})`;
          ctx.lineWidth = p.size * t * 0.6;
          ctx.lineCap = 'round';
          ctx.stroke();
        }

        // 粒子本体
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * t, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${(t * 0.9).toFixed(3)})`;
        ctx.shadowColor = `rgba(${r},${g},${b},0.8)`;
        ctx.shadowBlur = 8 * t;
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /** 每帧更新：平滑跟随鼠标，写入 star.offsetX/Y */
  update(stars) {
    this._nx += ((this.mx / window.innerWidth  - 0.5) * 2 - this._nx) * LERP;
    this._ny += ((this.my / window.innerHeight - 0.5) * 2 - this._ny) * LERP;

    const maxLayer = 3;
    for (const s of stars) {
      const depth = (s.layer + 1) / maxLayer;
      s.offsetX = (s.offsetX ?? 0) + (this._nx * MAX_OFFSET * depth - (s.offsetX ?? 0)) * LERP;
      s.offsetY = (s.offsetY ?? 0) + (this._ny * MAX_OFFSET * depth - (s.offsetY ?? 0)) * LERP;
    }
  }

  /** 绘制附近星星之间的细连线 */
  drawConnections(ctx, stars) {
    const D2 = CONNECT_DIST * CONNECT_DIST;

    // 空间网格加速（只检查相邻格子）
    const grid = new Map();
    for (const s of stars) {
      const rx = s.x + (s.offsetX ?? 0);
      const ry = s.y + (s.offsetY ?? 0);
      s._rx = rx; s._ry = ry;
      const key = `${s.layer}:${Math.floor(rx / CONNECT_DIST)}:${Math.floor(ry / CONNECT_DIST)}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(s);
    }

    ctx.save();
    ctx.lineCap = 'round';
    let checks = 0;

    for (const s of stars) {
      if (checks > 10000) break;
      const cx = Math.floor(s._rx / CONNECT_DIST);
      const cy = Math.floor(s._ry / CONNECT_DIST);

      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          const bucket = grid.get(`${s.layer}:${gx}:${gy}`);
          if (!bucket) continue;
          for (const o of bucket) {
            if (o._id <= s._id) continue;
            checks++;
            const dx = o._rx - s._rx, dy = o._ry - s._ry;
            const d2 = dx * dx + dy * dy;
            if (d2 >= D2) continue;
            const a = (1 - Math.sqrt(d2) / CONNECT_DIST) * 0.45;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(180,210,255,${a.toFixed(3)})`;
            ctx.lineWidth = 0.4 + a * 0.6;
            ctx.moveTo(s._rx, s._ry);
            ctx.lineTo(o._rx, o._ry);
            ctx.stroke();
          }
        }
      }
    }
    ctx.restore();
  }
}
