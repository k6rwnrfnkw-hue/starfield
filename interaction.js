(function () {
  const CONNECT_DISTANCE = 120;
  const GRID_SIZE = CONNECT_DISTANCE;
  const MAX_OFFSET = 30;
  const LERP_FACTOR = 0.05;
  const MAX_PAIR_CHECKS = 12000;

  function lerp(current, target, amount) {
    return current + (target - current) * amount;
  }

  function init(stars, canvas) {
    const ctx = canvas.getContext('2d');
    const maxLayer = Math.max(1, ...stars.map((star) => star.layer || 1));
    const mouse = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    };

    window.addEventListener('mousemove', (event) => {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
    });

    function applyParallax() {
      const width = window.innerWidth || 1;
      const height = window.innerHeight || 1;
      const mouseX = (mouse.x / width - 0.5) * 2;
      const mouseY = (mouse.y / height - 0.5) * 2;

      for (const star of stars) {
        const depth = (star.layer || 1) / maxLayer;
        const targetX = mouseX * MAX_OFFSET * depth;
        const targetY = mouseY * MAX_OFFSET * depth;

        star.offsetX = lerp(star.offsetX || 0, targetX, LERP_FACTOR);
        star.offsetY = lerp(star.offsetY || 0, targetY, LERP_FACTOR);
        star.renderX = star.x + star.offsetX;
        star.renderY = star.y + star.offsetY;
      }
    }

    function drawConnections(drawCtx) {
      const grid = new Map();
      let checks = 0;

      for (const star of stars) {
        const x = star.renderX ?? star.x;
        const y = star.renderY ?? star.y;
        const cellX = Math.floor(x / GRID_SIZE);
        const cellY = Math.floor(y / GRID_SIZE);
        const key = `${star.layer}:${cellX}:${cellY}`;

        if (!grid.has(key)) {
          grid.set(key, []);
        }
        grid.get(key).push(star);
      }

      drawCtx.save();
      drawCtx.lineCap = 'round';

      for (const star of stars) {
        if (checks >= MAX_PAIR_CHECKS) {
          break;
        }

        const x = star.renderX ?? star.x;
        const y = star.renderY ?? star.y;
        const cellX = Math.floor(x / GRID_SIZE);
        const cellY = Math.floor(y / GRID_SIZE);

        for (let gx = cellX - 1; gx <= cellX + 1; gx += 1) {
          for (let gy = cellY - 1; gy <= cellY + 1; gy += 1) {
            const bucket = grid.get(`${star.layer}:${gx}:${gy}`);
            if (!bucket) {
              continue;
            }

            for (const other of bucket) {
              if (checks >= MAX_PAIR_CHECKS) {
                break;
              }
              if (other === star || other._connectionId < star._connectionId) {
                continue;
              }

              checks += 1;
              const otherX = other.renderX ?? other.x;
              const otherY = other.renderY ?? other.y;
              const dx = otherX - x;
              const dy = otherY - y;
              const distSq = dx * dx + dy * dy;

              if (distSq >= CONNECT_DISTANCE * CONNECT_DISTANCE) {
                continue;
              }

              const dist = Math.sqrt(distSq);
              const alpha = 1 - dist / CONNECT_DISTANCE;
              drawCtx.beginPath();
              drawCtx.strokeStyle = `rgba(200,220,255,${alpha})`;
              drawCtx.lineWidth = 0.3 + alpha * 0.7;
              drawCtx.moveTo(x, y);
              drawCtx.lineTo(otherX, otherY);
              drawCtx.stroke();
            }
          }
        }
      }

      drawCtx.restore();
    }

    stars.forEach((star, index) => {
      star._connectionId = index;
    });

    return {
      update(drawCtx = ctx) {
        applyParallax();
        drawConnections(drawCtx);
      }
    };
  }

  window.Interaction = { init };
})();
