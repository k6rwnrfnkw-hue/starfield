(function () {
  function init(canvas) {
    const ctx = canvas.getContext('2d');
    const state = { canvas, ctx, width: 0, height: 0, dpr: 1 };

    function resize() {
      state.dpr = Math.min(window.devicePixelRatio || 1, 2);
      state.width = window.innerWidth;
      state.height = window.innerHeight;
      canvas.width = Math.floor(state.width * state.dpr);
      canvas.height = Math.floor(state.height * state.dpr);
      canvas.style.width = state.width + 'px';
      canvas.style.height = state.height + 'px';
      ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    }

    resize();
    window.addEventListener('resize', resize);

    return {
      ctx,
      clear() {
        ctx.clearRect(0, 0, state.width, state.height);
      },
      drawStars(stars) {
        for (const star of stars) {
          const x = star.renderX ?? star.x;
          const y = star.renderY ?? star.y;
          const pulse = 0.65 + Math.sin(star.phase) * 0.35;

          ctx.beginPath();
          ctx.fillStyle = `rgba(220,235,255,${star.alpha * pulse})`;
          ctx.arc(x, y, star.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };
  }

  window.Renderer = { init };
})();
