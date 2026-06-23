/**
 * particle-system.js
 * 职责边界：纯数据与物理层。管理星星、流星的状态与运动计算。
 * 不持有 canvas 引用，不执行任何绘制操作。
 */

export class ParticleSystem {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.stars = [];
    this.meteors = [];
    this._meteorTimer = 0;
    // 流星平均间隔 3~8 秒（毫秒）
    this._nextMeteorDelay = this._randBetween(3000, 8000);
  }

  /** 初始化星星，按视差层分布 */
  init(starCount = 300) {
    this.stars = [];
    // 层分布：近层(3)少但显眼，远层(1)多但细小
    const layerDist = { 1: 0.5, 2: 0.35, 3: 0.15 };

    for (const [layer, ratio] of Object.entries(layerDist)) {
      const count = Math.round(starCount * ratio);
      const l = Number(layer);
      for (let i = 0; i < count; i++) {
        this.stars.push(this._createStar(l));
      }
    }
  }

  /** 每帧更新，dt 单位毫秒 */
  update(dt) {
    this._updateStars(dt);
    this._updateMeteors(dt);
    this._trySpawnMeteor(dt);
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
  }

  // ── 私有：星星 ────────────────────────────────

  _createStar(layer) {
    // 视差速度：近层快，远层慢（px/ms）
    const speedTable = { 1: 0.003, 2: 0.008, 3: 0.020 };
    const baseSpeed = speedTable[layer];
    return {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      // 缓慢向右下漂移，模拟宇宙微运动
      vx: baseSpeed * this._randBetween(0.5, 1.5),
      vy: baseSpeed * this._randBetween(0.2, 0.8),
      layer,
      // 基础半径：近层大，远层小
      radius: this._starRadius(layer),
      // 亮度 0~1：近层亮，远层暗
      brightness: this._starBrightness(layer),
      // 闪烁相位（秒）
      phase: Math.random() * Math.PI * 2,
      // 闪烁速度（rad/ms）
      twinkleSpeed: this._randBetween(0.0008, 0.003),
    };
  }

  _starRadius(layer) {
    const base = { 1: 0.5, 2: 1.0, 3: 1.8 };
    return base[layer] + Math.random() * base[layer] * 0.5;
  }

  _starBrightness(layer) {
    const base = { 1: 0.35, 2: 0.60, 3: 0.90 };
    return base[layer] + Math.random() * 0.1;
  }

  _updateStars(dt) {
    for (const s of this.stars) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.phase += s.twinkleSpeed * dt;

      // 循环出屏边界
      if (s.x > this.width + 2) s.x = -2;
      if (s.y > this.height + 2) s.y = -2;
    }
  }

  // ── 私有：流星 ────────────────────────────────

  _createMeteor() {
    // 从顶部随机位置出发，斜向右下
    const x = this._randBetween(0, this.width * 0.8);
    const y = this._randBetween(-20, this.height * 0.2);
    const angle = this._randBetween(0.3, 0.7); // rad，斜向右下
    const speed = this._randBetween(0.35, 0.65); // px/ms

    const lifeMs = this._randBetween(800, 1800);
    return {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: lifeMs,
      maxLife: lifeMs,
      // 尾迹长度（像素）
      tailLength: this._randBetween(80, 200),
      width: this._randBetween(1, 2.5),
    };
  }

  _trySpawnMeteor(dt) {
    this._meteorTimer += dt;
    if (this._meteorTimer >= this._nextMeteorDelay) {
      this._meteorTimer = 0;
      this._nextMeteorDelay = this._randBetween(3000, 8000);
      this.meteors.push(this._createMeteor());
    }
  }

  _updateMeteors(dt) {
    for (const m of this.meteors) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.life -= dt;
    }
    // 移除已消逝的流星
    this.meteors = this.meteors.filter(m => m.life > 0);
  }

  // ── 工具 ──────────────────────────────────────

  _randBetween(a, b) {
    return a + Math.random() * (b - a);
  }
}
