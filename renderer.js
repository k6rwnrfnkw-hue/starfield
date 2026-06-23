import { ParticleSystem, Meteor, Comet } from './particle-system.js';
import { Interaction }            from './interaction.js';
import { playExplosion, playWarp, playGravityWell, playMeteor, playNova } from './audio.js';

// 星云主题：[nebula colors × 4, aurora hue × 3]
const THEMES = [
  { nebulas: ['#5a1aaa','#0a2a7a','#8a1a5a','#1a3aaa'], auroras: [160,270,130] }, // 默认紫蓝
  { nebulas: ['#aa3a00','#8a2a00','#aa6000','#7a1a30'], auroras: [20, 40, 350] }, // 日落橙红
  { nebulas: ['#005a6a','#004a8a','#006a5a','#0a2a5a'], auroras: [180,200,160] }, // 深海青
  { nebulas: ['#1a6a1a','#2a5a00','#006a3a','#1a5a4a'], auroras: [120,150,100] }, // 极光森林
];
let currentTheme = 0;

const NEBULA_COLORS = THEMES[0].nebulas;

// 极光带颜色
const AURORA_BANDS = [
  { hue: 160, sat: 80, lig: 60 },
  { hue: 270, sat: 70, lig: 65 },
  { hue: 130, sat: 85, lig: 55 },
];

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
    this.particles   = new ParticleSystem(this.width, this.height);
    this.nebulas     = this.createNebulas();
    this.interaction = new Interaction();
    this.auroras     = this._createAuroras();

    // 超空间飞行状态
    this.warp = { active: false, progress: 0, streaks: [] };

    // 扫描光束状态
    this._scan = { active: false, x: 0, progress: 0, nextIn: 8000 + Math.random() * 8000 };

    // FPS 自适应
    this._fpsHistory = [];
    this._qualityLevel = 1; // 1=full, 0.7=medium, 0.4=low

    // 连击彩虹模式
    this._comboCount  = 0;
    this._comboTimer  = null;

    // 主题切换（T 键）
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyT') {
        currentTheme = (currentTheme + 1) % THEMES.length;
        this._applyTheme();
      }
    });

    // 初始化星星 ID（连线去重用）
    this.particles.stars.forEach((s, i) => s._id = i);

    // 单击：爆炸 + 震动 + 星云脉冲 + 音效 + 连击检测
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;

      this._comboCount++;
      clearTimeout(this._comboTimer);
      this._comboTimer = setTimeout(() => { this._comboCount = 0; }, 600);

      if (this._comboCount >= 5) {
        // 彩虹连击：5连爆炸弧形排列
        this._comboCount = 0;
        clearTimeout(this._comboTimer);
        for (let i = 0; i < 7; i++) {
          const angle = (i / 7) * Math.PI * 2;
          const r = 80;
          setTimeout(() => {
            const ex = x + Math.cos(angle) * r;
            const ey = y + Math.sin(angle) * r;
            this.interaction.explode(ex, ey);
            this.pulseNebulaAt(ex, ey);
            playExplosion(0.5);
          }, i * 60);
        }
        // 中心再来一个大的
        setTimeout(() => {
          this.interaction.explode(x, y);
          this.interaction.shakeStarsAt(x, y, this.particles.stars);
          playExplosion(1.2);
        }, 450);
        return;
      }

      this.interaction.explode(x, y);
      this.interaction.shakeStarsAt(x, y, this.particles.stars);
      this.pulseNebulaAt(x, y);
      playExplosion(0.8);
    });

    // 双击：超空间飞行 + 音效
    this.canvas.addEventListener('dblclick', () => { this._startWarp(); playWarp(); });

    // 右键：引力井 + 音效
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      this.interaction.createGravityWell(e.clientX - rect.left, e.clientY - rect.top);
      playGravityWell();
    });

    // ── 触摸支持 ──────────────────────────────────────────────────────────
    let _touchTimer = null;
    let _lastTouchX = 0, _lastTouchY = 0;

    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const t = e.touches[0];
      _lastTouchX = t.clientX - rect.left;
      _lastTouchY = t.clientY - rect.top;
      // 长按500ms → 引力井
      _touchTimer = setTimeout(() => {
        this.interaction.createGravityWell(_lastTouchX, _lastTouchY);
        playGravityWell();
        _touchTimer = null;
      }, 500);
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      if (_touchTimer) {
        // 短触 → 爆炸
        clearTimeout(_touchTimer);
        _touchTimer = null;
        const x = _lastTouchX, y = _lastTouchY;
        this.interaction.explode(x, y);
        this.interaction.shakeStarsAt(x, y, this.particles.stars);
        this.pulseNebulaAt(x, y);
        playExplosion(0.8);
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const t = e.touches[0];
      const nx = t.clientX - rect.left;
      const ny = t.clientY - rect.top;
      // 模拟 mousemove 供 Interaction 处理光粒子 + 视差
      window.dispatchEvent(new MouseEvent('mousemove', {
        clientX: t.clientX, clientY: t.clientY, bubbles: true
      }));
      _lastTouchX = nx; _lastTouchY = ny;
      if (_touchTimer) { clearTimeout(_touchTimer); _touchTimer = null; }
    }, { passive: false });

    // 空格：流星雨（8颗流星 + 1颗彗星）+ 音效
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        for (let i = 0; i < 8; i++)
          setTimeout(() => { this.particles.meteors.push(new Meteor(this.width, this.height)); playMeteor(); }, i * 90);
        setTimeout(() => this.particles.meteors.push(new Comet(this.width, this.height)), 200);
      }
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
    if (this.auroras) this.auroras = this._createAuroras();
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
    // 视差目标（鼠标偏离中心）
    const mx = this.interaction.mx ?? this.width  / 2;
    const my = this.interaction.my ?? this.height / 2;
    const nx = (mx / this.width  - 0.5) * 2;
    const ny = (my / this.height - 0.5) * 2;

    for (const n of this.nebulas) {
      n.x += n.vx * dt;
      n.y += n.vy * dt;
      const dx = n.x - n.ox, dy = n.y - n.oy;
      const limit = Math.min(this.width, this.height) * 0.12;
      if (Math.abs(dx) > limit) n.vx *= -1;
      if (Math.abs(dy) > limit) n.vy *= -1;

      // 视差偏移（星云比星星慢且方向相反，营造深度感）
      const pxTarget = -nx * 18;
      const pyTarget = -ny * 12;
      n._px = (n._px ?? 0) + (pxTarget - (n._px ?? 0)) * 0.012;
      n._py = (n._py ?? 0) + (pyTarget - (n._py ?? 0)) * 0.012;

      n.phase += n.breathSpeed * dt;
      const breath = Math.sin(n.phase);
      const pulse  = n._pulse ?? 0;
      n.opacity = n.baseOpacity * (0.75 + 0.25 * breath) * (1 + pulse * 1.8);
      n.scale   = (1 + 0.08 * breath) * (1 + pulse * 0.25);
      if (pulse > 0) n._pulse = Math.max(0, pulse - 0.003 * dt);
    }
  }

  /** 爆炸或引力井崩塌时让附近星云闪亮 */
  pulseNebulaAt(x, y) {
    for (const n of this.nebulas) {
      const dx = n.x - x, dy = n.y - y;
      const d  = Math.sqrt(dx*dx + dy*dy);
      const r  = Math.max(n.rx, n.ry);
      if (d < r * 1.5) n._pulse = Math.min(1, (n._pulse ?? 0) + (1 - d / (r * 1.5)) * 0.7);
    }
  }

  drawBackground() {
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.width, this.height);
    this._drawMilkyWay();
  }

  _drawMilkyWay() {
    const ctx = this.ctx, W = this.width, H = this.height;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    // 从左下到右上的倾斜光带
    const x0 = W * 0.05, y0 = H * 0.95;
    const x1 = W * 0.95, y1 = H * 0.05;
    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0,    'rgba(30,25,60,0)');
    grad.addColorStop(0.3,  'rgba(50,40,100,0.045)');
    grad.addColorStop(0.5,  'rgba(70,55,130,0.07)');
    grad.addColorStop(0.7,  'rgba(50,40,100,0.045)');
    grad.addColorStop(1,    'rgba(30,25,60,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  drawNebulas() {
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'screen';
    for (const n of this.nebulas) {
      this.ctx.save();
      this.ctx.translate(n.x + (n._px ?? 0), n.y + (n._py ?? 0));
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

        // 超新星光晕 + 十字光芒
        if (star._novaLife > 0) {
          const nl = star._novaLife;
          this.ctx.shadowColor = `rgba(255,${Math.floor(180 + 75 * nl)},${Math.floor(100 + 155 * nl)},0.95)`;
          this.ctx.shadowBlur  = 20 + nl * 60;
          this.ctx.globalAlpha = Math.min(1, alpha + nl * 0.6);
          this.ctx.fillStyle   = `rgb(255,${Math.floor(240 * nl + 255 * (1 - nl))},${Math.floor(200 * nl + 255 * (1 - nl))})`;

          // 4方向尖刺光芒
          if (nl > 0.05) {
            this.ctx.save();
            this.ctx.globalCompositeOperation = 'screen';
            const spikeLen = nl * 90 + 15;
            const sx = star.x + (star.offsetX ?? 0);
            const sy = star.y + (star.offsetY ?? 0);
            [[1,0],[-1,0],[0,1],[0,-1],[0.7,0.7],[-0.7,0.7],[0.7,-0.7],[-0.7,-0.7]].forEach(([dx, dy], idx) => {
              const isMain = idx < 4;
              const len = isMain ? spikeLen : spikeLen * 0.45;
              const grad = this.ctx.createLinearGradient(sx, sy, sx + dx * len, sy + dy * len);
              grad.addColorStop(0, `rgba(255,255,200,${(nl * 0.85).toFixed(3)})`);
              grad.addColorStop(1, 'rgba(255,230,100,0)');
              this.ctx.beginPath();
              this.ctx.moveTo(sx, sy);
              this.ctx.lineTo(sx + dx * len, sy + dy * len);
              this.ctx.strokeStyle = grad;
              this.ctx.lineWidth   = isMain ? (1.5 + nl * 1.5) : 0.8;
              this.ctx.shadowBlur  = 10 * nl;
              this.ctx.stroke();
            });
            this.ctx.restore();
          }
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
      if (meteor.trailParticles.length < 2) continue;

      const isComet = meteor.isComet;
      const head = meteor.trailParticles[0];
      const tail = meteor.trailParticles[meteor.trailParticles.length - 1];

      this.ctx.save();
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      if (isComet) {
        // 彗星：双层尾迹（宽发光层 + 细白核心）
        for (let pass = 0; pass < 2; pass++) {
          const gradient = this.ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
          if (pass === 0) {
            gradient.addColorStop(0, 'rgba(100,180,255,0)');
            gradient.addColorStop(0.5, 'rgba(140,210,255,0.25)');
            gradient.addColorStop(1, 'rgba(200,230,255,0.7)');
            this.ctx.lineWidth = 7;
            this.ctx.shadowColor = 'rgba(120,200,255,0.8)';
            this.ctx.shadowBlur = 20;
          } else {
            gradient.addColorStop(0, 'rgba(255,255,255,0)');
            gradient.addColorStop(0.6, 'rgba(220,240,255,0.6)');
            gradient.addColorStop(1, 'rgba(255,255,255,1)');
            this.ctx.lineWidth = 1.8;
            this.ctx.shadowBlur = 0;
          }
          this.ctx.strokeStyle = gradient;
          this.ctx.beginPath();
          this.ctx.moveTo(tail.x, tail.y);
          for (let i = meteor.trailParticles.length - 2; i >= 0; i--)
            this.ctx.lineTo(meteor.trailParticles[i].x, meteor.trailParticles[i].y);
          this.ctx.stroke();
        }
        // 彗头光晕
        this.ctx.shadowColor = 'rgba(180,220,255,0.9)';
        this.ctx.shadowBlur = 25;
        this.ctx.fillStyle = 'rgba(255,255,255,1)';
        this.ctx.beginPath();
        this.ctx.arc(head.x, head.y, 4.5, 0, Math.PI * 2);
        this.ctx.fill();
      } else {
        // 普通流星
        const gradient = this.ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
        gradient.addColorStop(0, 'rgba(255,255,255,0)');
        gradient.addColorStop(0.55, 'rgba(160,205,255,0.35)');
        gradient.addColorStop(1, 'rgba(255,255,255,0.95)');
        this.ctx.strokeStyle = gradient;
        this.ctx.lineWidth = 2.4;
        this.ctx.shadowColor = 'rgba(150,205,255,0.7)';
        this.ctx.shadowBlur = 12;
        this.ctx.beginPath();
        this.ctx.moveTo(tail.x, tail.y);
        for (let i = meteor.trailParticles.length - 2; i >= 0; i--)
          this.ctx.lineTo(meteor.trailParticles[i].x, meteor.trailParticles[i].y);
        this.ctx.stroke();
        this.ctx.fillStyle = 'rgba(255,255,255,0.95)';
        this.ctx.beginPath();
        this.ctx.arc(head.x, head.y, 2.8, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    }
  }

  // ─── 主题 ────────────────────────────────────────────────────────────────
  _applyTheme() {
    const t = THEMES[currentTheme];
    // 平滑过渡：把目标颜色存入星云，让下次 createNebulas 拾取
    this.nebulas.forEach((n, i) => {
      n.color = t.nebulas[i] ?? n.color;
    });
    this.auroras.forEach((a, i) => {
      a.hue = t.auroras[i % t.auroras.length];
    });
  }

  // ─── 扫描光束 ─────────────────────────────────────────────────────────────
  _updateScan(dt) {
    if (!this._scan.active) {
      this._scan.nextIn -= dt;
      if (this._scan.nextIn <= 0) {
        this._scan.active   = true;
        this._scan.progress = 0;
        this._scan.nextIn   = 12000 + Math.random() * 10000;
      }
      return;
    }
    this._scan.progress += dt * 0.0005; // 过屏约2秒
    if (this._scan.progress >= 1) this._scan.active = false;
  }

  _drawScan() {
    if (!this._scan.active) return;
    const W = this.width, H = this.height;
    const p = this._scan.progress;
    // 光束中心从左上→右下
    const cx = W * p;
    const cy = H * p * 0.5;
    const beamW = 60 + 40 * Math.sin(p * Math.PI); // 中段最宽

    this.ctx.save();
    this.ctx.globalCompositeOperation = 'screen';
    // 斜向光带（旋转45°）
    this.ctx.translate(cx, cy);
    this.ctx.rotate(-Math.PI / 5);
    const grad = this.ctx.createLinearGradient(-beamW, 0, beamW, 0);
    grad.addColorStop(0, 'rgba(180,230,255,0)');
    grad.addColorStop(0.5, `rgba(180,230,255,${(Math.sin(p * Math.PI) * 0.04).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(180,230,255,0)');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(-beamW, -H * 1.5, beamW * 2, H * 3);
    this.ctx.restore();
  }

  // ─── 极光 ────────────────────────────────────────────────────────────────
  _createAuroras() {
    return AURORA_BANDS.map((b, i) => {
      const targetOpacity = 0.18 + Math.random() * 0.10;
      return {
        ...b,
        baseY: this.height * (0.10 + i * 0.07),
        phase: Math.random() * Math.PI * 2,
        speed: 0.00015 + Math.random() * 0.00010,
        amp:   this.height * (0.035 + Math.random() * 0.03),
        opacity: targetOpacity,
        targetOpacity,
      };
    });
  }

  _updateAuroras(dt) {
    for (const a of this.auroras) {
      a.phase += a.speed * dt;
      // 用慢速 lerp 让 opacity 平滑出现/消隐
      a.opacity += (a.targetOpacity - a.opacity) * 0.001 * dt;
    }
  }

  _drawAuroras() {
    const ctx = this.ctx, W = this.width;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    for (const a of this.auroras) {
      const pts  = 120;
      const step = W / pts;

      // 用多层叠加模拟极光帘幕
      for (let layer = 0; layer < 3; layer++) {
        const layerPhase  = a.phase + layer * 0.8;
        const layerAmp    = a.amp * (1 - layer * 0.2);
        const layerOpacity = a.opacity * (1 - layer * 0.3);
        const blur = 18 - layer * 4;

        ctx.save();
        ctx.beginPath();
        for (let i = 0; i <= pts; i++) {
          const x = i * step;
          const wave = Math.sin(layerPhase + i * 0.18) * layerAmp
                     + Math.sin(layerPhase * 1.5 + i * 0.08) * layerAmp * 0.3;
          const y = a.baseY + wave;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }

        ctx.strokeStyle = `hsla(${a.hue},${a.sat}%,${a.lig}%,${layerOpacity.toFixed(3)})`;
        ctx.lineWidth   = 2 + layer * 1.5;
        ctx.shadowColor = `hsla(${a.hue},${a.sat}%,${a.lig}%,0.6)`;
        ctx.shadowBlur  = blur;
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  // ─── 超空间飞行 ────────────────────────────────────────────────────────────
  _startWarp() {
    if (this.warp.active) return;
    this.warp.active   = true;
    this.warp.progress = 0;
    // 生成从中心放射的光速线
    const cx = this.width / 2, cy = this.height / 2;
    this.warp.streaks = Array.from({ length: 220 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const dist  = 20 + Math.random() * 80;
      return {
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        vx: Math.cos(angle),
        vy: Math.sin(angle),
        speed: 0.8 + Math.random() * 1.4,
        len:   0.05 + Math.random() * 0.12,
        color: `hsl(${200 + Math.random() * 60},90%,${70 + Math.random() * 20}%)`,
      };
    });
  }

  _updateWarp(dt) {
    if (!this.warp.active) return;
    this.warp.progress += dt * 0.0008; // 0→1 over ~1250ms
    if (this.warp.progress >= 1) {
      this.warp.active   = false;
      this.warp.progress = 0;
    }
  }

  _drawWarp() {
    if (!this.warp.active && this.warp.progress === 0) return;
    const ctx = this.ctx;
    const p   = this.warp.progress;
    const cx  = this.width / 2, cy = this.height / 2;
    // 渐入渐出曲线
    const intensity = p < 0.5 ? p * 2 : (1 - p) * 2;
    const maxLen = Math.max(this.width, this.height) * 1.5;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = intensity;
    for (const s of this.warp.streaks) {
      const travelled = p * p * maxLen * s.speed;
      const x1 = cx + (s.x - cx) + s.vx * travelled;
      const y1 = cy + (s.y - cy) + s.vy * travelled;
      const x0 = x1 - s.vx * travelled * s.len;
      const y0 = y1 - s.vy * travelled * s.len;

      const grad = ctx.createLinearGradient(x0, y0, x1, y1);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(1, s.color);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5 + intensity * 1.5;
      ctx.stroke();
    }
    // 中心发光
    const flash = ctx.createRadialGradient(cx, cy, 0, cx, cy, 300 * intensity);
    flash.addColorStop(0, `rgba(200,230,255,${0.15 * intensity})`);
    flash.addColorStop(1, 'rgba(200,230,255,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = flash;
    ctx.beginPath();
    ctx.arc(cx, cy, 300 * intensity, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  render(time = 0) {
    const delta  = this.lastTime ? Math.min(2.5, (time - this.lastTime) / 16.67) : 1;
    const deltaMs = this.lastTime ? Math.min(time - this.lastTime, 50) : 16;
    this.lastTime = time;

    // FPS 监测（每60帧采样一次）
    if (this.lastTime > 0) {
      const fps = 1000 / (deltaMs || 16);
      this._fpsHistory.push(fps);
      if (this._fpsHistory.length > 60) {
        this._fpsHistory.shift();
        const avgFps = this._fpsHistory.reduce((a, b) => a + b) / this._fpsHistory.length;
        if (avgFps < 28 && this._qualityLevel > 0.4) {
          this._qualityLevel = Math.max(0.4, this._qualityLevel - 0.1);
          const target = Math.floor(this.particles.stars.length * 0.85);
          const remove = this.particles.stars.length - target;
          if (remove > 0) {
            const removed = this.particles.stars.splice(-remove);
            for (const s of removed)
              this.particles.starsByLayer[s.layer]?.splice(
                this.particles.starsByLayer[s.layer].indexOf(s), 1);
          }
        } else if (avgFps > 55 && this._qualityLevel < 1 && this.particles.stars.length < 400) {
          this._qualityLevel = Math.min(1, this._qualityLevel + 0.05);
        }
      }
    }

    const prevNovas = this.particles.stars.filter(s => s._novaLife > 0).length;
    this.particles.update(delta);
    const newNovas  = this.particles.stars.filter(s => s._novaLife > 0.98).length;
    if (newNovas > prevNovas) playNova();

    this.updateNebulas(delta);
    this._updateAuroras(deltaMs);
    this._updateWarp(deltaMs);
    this._updateScan(deltaMs);
    this.interaction.update(this.particles.stars);
    this.interaction.updateGravityWell(this.particles.stars, deltaMs);
    if (this.interaction._collapsePos) {
      const { x, y } = this.interaction._collapsePos;
      this.pulseNebulaAt(x, y);
      this.interaction.shakeStarsAt(x, y, this.particles.stars);
      playExplosion(1.2);
      this.interaction._collapsePos = null;
    }

    this.drawBackground();
    this.drawNebulas();
    this._drawAuroras();
    this._drawStarsWithParallax();
    this.drawMeteors();
    this._drawScan();
    this._drawWarp();
    this.interaction.updateExplosions(deltaMs);
    this.interaction.updateCursorSparks(deltaMs);
    this.interaction.drawConnections(this.ctx, this.particles.stars);
    this.interaction.drawExplosions(this.ctx);
    this.interaction.drawGravityWell(this.ctx);
    this.interaction.drawCursorSparks(this.ctx);

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
