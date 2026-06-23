(function () {
  const STAR_COUNT = 180;
  const LAYERS = 4;

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function create(canvas) {
    const stars = [];

    for (let i = 0; i < STAR_COUNT; i += 1) {
      const layer = 1 + Math.floor(Math.random() * LAYERS);
      const depth = layer / LAYERS;

      const x = Math.random() * window.innerWidth;
      const y = Math.random() * window.innerHeight;
      stars.push({
        x,
        y,
        renderX: x,
        renderY: y,
        radius: randomBetween(0.6, 1.8) * (0.75 + depth * 0.45),
        alpha: randomBetween(0.35, 0.95),
        phase: randomBetween(0, Math.PI * 2),
        speed: randomBetween(0.008, 0.025),
        layer,
        offsetX: 0,
        offsetY: 0
      });
    }

    window.addEventListener('resize', () => wrapStars(stars, canvas));
    return stars;
  }

  function update(stars) {
    for (const star of stars) {
      star.phase += star.speed;
    }
  }

  function wrapStars(stars) {
    const width = window.innerWidth;
    const height = window.innerHeight;

    for (const star of stars) {
      // 窗口缩小时避免星星长期停留在不可见区域。
      star.x = ((star.x % width) + width) % width;
      star.y = ((star.y % height) + height) % height;
    }
  }

  window.ParticleSystem = { create, update };
})();
