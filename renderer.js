/**
 * renderer.js
 * 职责边界：纯渲染层。从 ParticleSystem 读取状态并绘制到 canvas。
 * 不持有物理状态，不计算粒子位移。所有绘制策略（颜色、混合模式）集中于此。
 */

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // 离屏 canvas 缓存星云，避免每帧重绘昂贵的径向渐变
    this._nebulaCanvas = document.createElement('canvas');
    this._nebulaCtx = this._nebulaCanvas.getContext('2d');
    this._nebulaReady = false;

    // 星星颜色按层：远层冷白，近层暖白/蓝白
    this._layerColors = {
      1: '200,210,255',  // 远：冷蓝白
      2: '220,225,255',  // 中：中性白
      3: '255,245,230',  // 近：暖白
    };

    // 近层星星开启 shadowBlur（限量使用以控制性能）
    this._glowLayer = 3;
  }

  /** 调整尺寸时重置星云缓存 */
  resize(width, height) {
    this._nebulaCanvas.width = width;
    this._nebulaCanvas.height = height;
    this._nebulaReady = false;
  }

  /** 主渲染入口，每帧调用 */
  render(ps) {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. 深空背景
    this._drawBackground();

    // 2. 星云光雾（离屏缓存 + screen 混合）
    this._drawNebula(ps.width, ps.height);

    // 3. 星星（按层从远到近）
    this._drawStars(ps.stars);

    // 4. 流星尾迹
    this._drawMeteors(ps.meteors);
  }

  // ── 私有：背景 ────────────────────────────────

  _drawBackground() {
    const { ctx, canvas } = this;
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#03010a');
    grad.addColorStop(0.5, '#060318');
    grad.addColorStop(1, '#02010d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // ── 私有：星云 ────────────────────────────────

  _drawNebula(w, h) {
    // 懒初始化：尺寸变化时重绘离屏层
    if (!this._nebulaReady) {
      this._renderNebulaOffscreen(w, h);
      this._nebulaReady = true;
    }

    const { ctx } = this;
    // screen 混合让星云与背景叠加产生发光感，不遮挡星星
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.55;
    ctx.drawImage(this._nebulaCanvas, 0, 0);
    ctx.restore();
  }

  _renderNebulaOffscreen(w, h) {
    const nCtx = this._nebulaCtx;
    const nCvs = this._nebulaCanvas;
    nCvs.width = w;
    nCvs.height = h;
    nCtx.clearRect(0, 0, w, h);

    // 若干大型径向渐变色块，模拟星云
    const blobs = [
      { cx: w * 0.25, cy: h * 0.35, r: w * 0.30, color: '40,10,80' },
      { cx: w * 0.70, cy: h * 0.55, r: w * 0.28, color: '0,30,90' },
      { cx: w * 0.50, cy: h * 0.15, r: w * 0.22, color: '80,10,60' },
      { cx: w * 0.15, cy: h * 0.80, r: w * 0.20, color: '10,50,80' },
      { cx: w * 0.85, cy: h * 0.25, r: w * 0.18, color: '60,20,50' },
    ];

    for (const b of blobs) {
      const grad = nCtx.createRadialGradient(b.cx, b.cy, 0, b.cx, b.cy, b.r);
      grad.addColorStop(0, `rgba(${b.color},0.22)`);
      grad.addColorStop(0.5, `rgba(${b.color},0.08)`);
      grad.addColorStop(1, `rgba(${b.color},0)`);
      nCtx.fillStyle = grad;
      nCtx.fillRect(0, 0, w, h);
    }
  }

  // ── 私有：星星 ────────────────────────────────

  _drawStars(stars) {
    const { ctx } = this;

    // 按层分组：远→近顺序绘制（layer 1 最先，3 最后在顶部）
    const byLayer = { 1: [], 2: [], 3: [] };
    for (const s of stars) byLayer[s.layer].push(s);

    for (const layer of [1, 2, 3]) {
      const colorRgb = this._layerColors[layer];
      const useGlow = layer === this._glowLayer;

      // save/restore 每层只调一次（而非每颗星），性能提升约 N 倍
      ctx.save();
      if (useGlow) {
        // 近层：轻度光晕，shadowBlur 限制在小值避免性能损耗
        ctx.shadowColor = `rgba(${colorRgb},0.6)`;
        ctx.shadowBlur = 4;
      }

      for (const s of byLayer[layer]) {
        // 闪烁：在基础亮度上叠加正弦波动
        const twinkle = 0.85 + 0.15 * Math.sin(s.phase);
        const alpha = Math.min(1, s.brightness * twinkle);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${colorRgb},${alpha})`;
        ctx.fill();
      }

      ctx.restore();
    }
  }

  // ── 私有：流星 ────────────────────────────────

  _drawMeteors(meteors) {
    const { ctx } = this;

    for (const m of meteors) {
      // 生命周期进度 0→1
      const progress = 1 - m.life / m.maxLife;
      // 整体 alpha：出现时淡入，消逝时淡出
      const globalAlpha = progress < 0.1
        ? progress / 0.1
        : m.life / m.maxLife < 0.15
          ? (m.life / m.maxLife) / 0.15
          : 1;

      // 尾迹：从当前头部位置向后延伸 tailLength
      const speed = Math.hypot(m.vx, m.vy);
      const tailX = m.x - (m.vx / speed) * m.tailLength;
      const tailY = m.y - (m.vy / speed) * m.tailLength;

      // 线性渐变：头部白亮 → 尾部透明
      const grad = ctx.createLinearGradient(tailX, tailY, m.x, m.y);
      grad.addColorStop(0, `rgba(200,220,255,0)`);
      grad.addColorStop(0.6, `rgba(200,220,255,0.15)`);
      grad.addColorStop(1, `rgba(255,255,255,${(globalAlpha * 0.9).toFixed(3)})`);

      ctx.save();
      ctx.globalAlpha = globalAlpha;
      ctx.strokeStyle = grad;
      ctx.lineWidth = m.width;
      ctx.lineCap = 'round';
      // 轻微光晕增强流星感
      ctx.shadowColor = 'rgba(180,210,255,0.8)';
      ctx.shadowBlur = 6;

      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(m.x, m.y);
      ctx.stroke();

      ctx.restore();
    }
  }
}
