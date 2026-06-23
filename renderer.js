import { ParticleSystem } from './particle-system.js';

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
    this.particles = new ParticleSystem(this.width, this.height);
    this.nebulas = this.createNebulas();

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
    return [
      { x: 0.22, y: 0.28, rx: 0.38, ry: 0.22, color: NEBULA_COLORS[0], opacity: 0.38 },
      { x: 0.75, y: 0.22, rx: 0.32, ry: 0.20, color: NEBULA_COLORS[1], opacity: 0.35 },
      { x: 0.55, y: 0.70, rx: 0.40, ry: 0.22, color: NEBULA_COLORS[2], opacity: 0.40 },
      { x: 0.15, y: 0.75, rx: 0.28, ry: 0.18, color: NEBULA_COLORS[3], opacity: 0.32 },
    ].map((nebula) => ({
      ...nebula,
      x: nebula.x * this.width,
      y: nebula.y * this.height,
      rx: nebula.rx * this.width,
      ry: nebula.ry * this.height,
    }));
  }

  drawBackground() {
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  drawNebulas() {
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'screen';
    for (const nebula of this.nebulas) {
      this.ctx.save();
      this.ctx.translate(nebula.x, nebula.y);
      this.ctx.scale(nebula.rx, nebula.ry);

      const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      gradient.addColorStop(0,    rgba(nebula.color, nebula.opacity));
      gradient.addColorStop(0.45, rgba(nebula.color, nebula.opacity * 0.5));
      gradient.addColorStop(1,    rgba(nebula.color, 0));

      this.ctx.fillStyle = gradient;
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
    const delta = this.lastTime ? Math.min(2.5, (time - this.lastTime) / 16.67) : 1;
    this.lastTime = time;

    this.particles.update(delta);
    this.drawBackground();
    this.drawNebulas();
    this.drawStars();
    this.drawMeteors();

    this.animationId = window.requestAnimationFrame((nextTime) => this.render(nextTime));
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
