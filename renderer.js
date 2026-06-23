import { ParticleSystem } from './particle-system.js';
import { Interaction }    from './interaction.js';

const NEBULA_COLORS = ['#5a1aaa', '#0a2a7a', '#8a1a5a', '#1a3aaa'];

function hexToRgb(hex) {
  const value = Number.parseInt(hex.replace('#', ''), 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export class Renderer {
  constructor(canvas = null) {
    this.canvas = canvas || document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    this.lastTime = 0;
    this.animationId = 0;

    if (!canvas) {
      document.body.style.margin = '0';
      document.body.style.overflow = 'hidden';
      document.body.appendChild(this.canvas);
    }

    this.canvas.style.display = 'block';
    this.canvas.style.width = '100vw';
    this.canvas.style.height = '100vh';

    this.resize();
    this.particles  = new ParticleSystem(this.width, this.height);
    this.nebulas    = this.createNebulas();
    this.interaction = new Interaction();

    // 初始化星星 ID（连线去重用）
    this.particles.stars.forEach((s, i) => s._id = i);

    // 点击触发爆炸
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.interaction.explode(e.clientX - rect.left, e.clientY - rect.top);
    });

    window.addEventListener('resize', () => this.resize(), { passive: true });
  }

  resize() {
    this.dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    this.width = Math.max(1, window.innerWidth);
    this.height = Math.max(1, window.innerHeight);
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    if (this.particles)
      this.particles.resize(this.width, this.height);

    this.nebulas = this.createNebulas();
  }

  createNebulas() {
    const defs = [
      { nx: 0.22, ny: 0.28, rx: 0.38, ry: 0.22, color: NEBULA_COLORS[0], baseOpacity: 0.38 },
      { nx: 0.75, ny: 0.22, rx: 0.32, ry: 0.20, color: NEBULA_COLORS[1], baseOpacity: 0.35 },
      { nx: 0.55, ny: 0.70, rx: 0.40, ry: 0.22, color: NEBULA_COLORS[2], baseOpacity: 0.40 },
      { nx: 0.15, ny: 0.75, rx: 0.28, ry: 0.18, color: NEBULA_COLORS[3], baseOpacity: 0.32 },
    ];
    return defs.map((d, i) => ({
      // 当前位置（像素）
      x:  d.nx * this.width,
      y:  d.ny * this.height,
      // 原始位置（用于归位漂移边界）
      ox: d.nx * this.width,
      oy: d.ny * this.height,
      rx: d.rx * this.width,
      ry: d.ry * this.height,
      color: d.color,
      baseOpacity: d.baseOpacity,
      opacity: d.baseOpacity,
      // 漂移速度（px/ms），每个星云方向不同
      vx: (Math.random() - 0.5) * 0.015,
      vy: (Math.random() - 0.5) * 0.010,
      // 呼吸相位（秒），错开让各星云不同步
      phase: (Math.PI * 2 / defs.length) * i + Math.random(),
      // 呼吸速度（rad/ms）
      breathSpeed: 0.0004 + Math.random() * 0.0003,
      // 当前缩放（呼吸时微膨胀）
      scale: 1,
    }));
  }

  updateNebulas(dt) {
    for (const n of this.nebulas) {
      // 缓慢漂移
      n.x += n.vx * dt;
      n.y += n.vy * dt;
      // 边界弹回：离原点太远时反向
      const dx = n.x - n.ox, dy = n.y - n.oy;
      const limit = Math.min(this.width, this.height) * 0.12;
      if (Math.abs(dx) > limit) n.vx *= -1;
      if (Math.abs(dy) > limit) n.vy *= -1;

      // 呼吸：opacity + scale 一起振荡
      n.phase += n.breathSpeed * dt;
      const breath = Math.sin(n.phase);
      n.opacity = n.baseOpacity * (0.75 + 0.25 * breath);
      n.scale   = 1 + 0.08 * breath;
    }
  }

  drawBackground() {
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  drawNebulas() {
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'screen';
    for (const n of this.nebulas) {
      this.ctx.save();
      this.ctx.translate(n.x, n.y);
      this.ctx.scale(n.rx * n.scale, n.ry * n.scale);

      const g = this.ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0,    rgba(n.color, n.opacity));
      g.addColorStop(0.45, rgba(n.color, n.opacity * 0.5));
      g.addColorStop(1,    rgba(n.color, 0));

      this.ctx.fillStyle = g;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 1, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
    this.ctx.restore();
  }

  drawStars() {
    for (const [layer, stars] of this.particles.starsByLayer.entries()) {
      for (const star of stars) {
        const alpha = Math.max(0.2, Math.min(1, star.brightness));
        const radius = layer === 0 ? Math.min(2, star.size) : star.size;

        this.ctx.save();
        this.ctx.globalAlpha = alpha;
        this.ctx.fillStyle = '#fff';

        if (layer === 2) {
          this.ctx.shadowColor = 'rgba(190, 220, 255, 0.9)';
          this.ctx.shadowBlur = 8 + star.size * 2;
        }

        this.ctx.beginPath();
        this.ctx.arc(star.x, star.y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      }
    }
  }

  drawMeteors() {
    for (const meteor of this.particles.meteors) {
      if (meteor.trailParticles.length < 2)
        continue;

      const head = meteor.trailParticles[0];
      const tail = meteor.trailParticles[meteor.trailParticles.length - 1];
      const gradient = this.ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);

      gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
      gradient.addColorStop(0.55, 'rgba(160, 205, 255, 0.35)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0.95)');

      this.ctx.save();
      this.ctx.strokeStyle = gradient;
      this.ctx.lineWidth = 2.4;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.shadowColor = 'rgba(150, 205, 255, 0.7)';
      this.ctx.shadowBlur = 12;
      this.ctx.beginPath();
      this.ctx.moveTo(tail.x, tail.y);

      for (let index = meteor.trailParticles.length - 2; index >= 0; index -= 1) {
        const point = meteor.trailParticles[index];
        this.ctx.lineTo(point.x, point.y);
      }

      this.ctx.stroke();
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      this.ctx.beginPath();
      this.ctx.arc(head.x, head.y, 2.8, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
  }

  render(time = 0) {
    const delta  = this.lastTime ? Math.min(2.5, (time - this.lastTime) / 16.67) : 1;
    const deltaMs = this.lastTime ? Math.min(time - this.lastTime, 50) : 16;
    this.lastTime = time;

    this.particles.update(delta);
    this.updateNebulas(delta);
    this.interaction.update(this.particles.stars);

    this.drawBackground();
    this.drawNebulas();
    this._drawStarsWithParallax();
    this.drawMeteors();
    this.interaction.updateExplosions(deltaMs);
    this.interaction.drawConnections(this.ctx, this.particles.stars);
    this.interaction.drawExplosions(this.ctx);

    this.animationId = window.requestAnimationFrame((nextTime) => this.render(nextTime));
  }

  _drawStarsWithParallax() {
    const stars = this.particles.stars;
    // 临时应用视差偏移
    for (const s of stars) {
      s._ox = s.x; s._oy = s.y;
      s.x += s.offsetX ?? 0;
      s.y += s.offsetY ?? 0;
    }
    this.drawStars();
    for (const s of stars) { s.x = s._ox; s.y = s._oy; }
  }

  start() {
    if (!this.animationId)
      this.animationId = window.requestAnimationFrame((time) => this.render(time));
  }

  stop() {
    window.cancelAnimationFrame(this.animationId);
    this.animationId = 0;
    this.lastTime = 0;
  }
}

if (typeof window !== 'undefined') {
  window.StarfieldRenderer = Renderer;

  window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.querySelector('canvas[data-starfield]');

    if (canvas)
      new Renderer(canvas).start();
  });
}
