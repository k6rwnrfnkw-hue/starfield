const STAR_COUNT_MIN = 300;
const STAR_COUNT_MAX = 500;
const METEOR_SPAWN_PROBABILITY = 0.003;

const LAYER_CONFIG = [
  { zMin: 2.6, zMax: 3.4, sizeMin: 0.7, sizeMax: 1.4, speedMin: 0.03, speedMax: 0.08, brightnessMin: 0.35, brightnessMax: 0.65 },
  { zMin: 1.5, zMax: 2.4, sizeMin: 1.1, sizeMax: 2.2, speedMin: 0.08, speedMax: 0.16, brightnessMin: 0.5, brightnessMax: 0.85 },
  { zMin: 0.75, zMax: 1.25, sizeMin: 2.0, sizeMax: 4.0, speedMin: 0.18, speedMax: 0.34, brightnessMin: 0.7, brightnessMax: 1.0 },
];

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function randomInt(min, max) {
  return Math.floor(randomBetween(min, max + 1));
}

export class Star {
  constructor(width, height, layer = 0) {
    const config = LAYER_CONFIG[layer] || LAYER_CONFIG[0];

    this.x = Math.random() * width;
    this.y = Math.random() * height;
    this.z = randomBetween(config.zMin, config.zMax);
    this.size = randomBetween(config.sizeMin, config.sizeMax);
    this.brightness = randomBetween(config.brightnessMin, config.brightnessMax);
    this._baseBrightness = this.brightness;
    this.velocity = randomBetween(config.speedMin, config.speedMax);
    this.layer = layer;

    // 随机闪烁状态
    this._twinklePhase = Math.random() * Math.PI * 2;
    this._twinkleSpeed = 0.01 + Math.random() * 0.025;
    this._twinkleAmp   = 0.08 + Math.random() * 0.12;

    // 超新星状态
    this._novaLife = 0;
  }

  triggerNova() {
    this._novaLife = 1.0; // 1 = peak, counts down to 0
  }

  update(width, height, delta = 1) {
    const parallaxSpeed = (this.velocity / this.z) * delta;

    this.x -= parallaxSpeed;
    this.y += parallaxSpeed * 0.18;

    if (this.x < -this.size) {
      this.x = width + this.size;
      this.y = Math.random() * height;
    }
    if (this.y > height + this.size) {
      this.y = -this.size;
      this.x = Math.random() * width;
    }

    // 常规闪烁
    this._twinklePhase += this._twinkleSpeed * delta;
    this.brightness = this._baseBrightness + Math.sin(this._twinklePhase) * this._twinkleAmp;

    // 超新星衰减
    if (this._novaLife > 0) {
      this._novaLife -= 0.008 * delta;
      if (this._novaLife < 0) this._novaLife = 0;
      this.brightness = Math.max(this.brightness, this._novaLife * 3.5);
    }
  }
}

export class Meteor {
  constructor(width, height) {
    const startX = randomBetween(width * 0.25, width * 1.05);
    const startY = randomBetween(-height * 0.15, height * 0.35);
    const length = randomBetween(220, 420);
    const angle = randomBetween(Math.PI * 0.67, Math.PI * 0.78);

    this.start = { x: startX, y: startY };
    this.end = {
      x: startX + Math.cos(angle) * length,
      y: startY + Math.sin(angle) * length,
    };
    this.trailParticles = [];
    this.life = 0;
    this.maxLife = randomBetween(45, 80);
    this.velocity = randomBetween(10, 17);
    this.active = true;

    this.dx = this.end.x - this.start.x;
    this.dy = this.end.y - this.start.y;
    this.distance = Math.hypot(this.dx, this.dy) || 1;
  }

  static shouldSpawn(probability = METEOR_SPAWN_PROBABILITY) {
    return Math.random() < probability;
  }

  update(delta = 1) {
    if (!this.active) {
      this.trailParticles = this.trailParticles
        .map((particle) => ({ ...particle, age: particle.age + delta }))
        .filter((particle) => particle.age < 22);
      return;
    }

    this.life += delta;
    const progress = Math.min(1, (this.life * this.velocity) / this.distance);
    const head = {
      x: this.start.x + this.dx * progress,
      y: this.start.y + this.dy * progress,
    };

    // 记录尾迹点，渲染时按年龄淡出，避免每帧重算整条尾巴。
    this.trailParticles.unshift({ x: head.x, y: head.y, age: 0 });
    this.trailParticles = this.trailParticles
      .map((particle) => ({ ...particle, age: particle.age + delta }))
      .filter((particle) => particle.age < 22)
      .slice(0, 28);

    if (progress >= 1 || this.life >= this.maxLife)
      this.active = false;
  }
}

export class ParticleSystem {
  constructor(width, height, starCount = randomInt(STAR_COUNT_MIN, STAR_COUNT_MAX)) {
    this.width = width;
    this.height = height;
    this.stars = [];
    this.starsByLayer = [[], [], []];
    this.meteors = [];

    this.initStars(starCount);
  }

  initStars(starCount) {
    for (let index = 0; index < starCount; index += 1) {
      const layer = index % LAYER_CONFIG.length;
      const star = new Star(this.width, this.height, layer);

      this.stars.push(star);
      this.starsByLayer[layer].push(star);
    }
  }

  resize(width, height) {
    const scaleX = this.width > 0 ? width / this.width : 1;
    const scaleY = this.height > 0 ? height / this.height : 1;

    this.width = width;
    this.height = height;

    for (const star of this.stars) {
      star.x *= scaleX;
      star.y *= scaleY;
    }
  }

  update(delta = 1) {
    for (const star of this.stars)
      star.update(this.width, this.height, delta);

    // 随机超新星：约每 4 秒触发一颗
    if (Math.random() < 0.0004 * delta) {
      const layer2 = this.starsByLayer[2];
      if (layer2.length > 0)
        layer2[Math.floor(Math.random() * layer2.length)].triggerNova();
    }

    if (Meteor.shouldSpawn())
      this.meteors.push(new Meteor(this.width, this.height));

    for (const meteor of this.meteors)
      meteor.update(delta);

    this.meteors = this.meteors.filter((meteor) => meteor.active || meteor.trailParticles.length > 0);
  }
}

export { LAYER_CONFIG, METEOR_SPAWN_PROBABILITY };
