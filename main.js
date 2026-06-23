/**
 * main.js
 * 职责边界：入口与协调层。
 * 初始化 canvas、连接 ParticleSystem（物理）与 Renderer（渲染），驱动动画循环。
 * 不包含物理计算，不直接操作 canvas 2D 上下文。
 */

import { ParticleSystem } from './particle-system.js';
import { Renderer } from './renderer.js';

function main() {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);

  const ps = new ParticleSystem(window.innerWidth, window.innerHeight);
  const renderer = new Renderer(canvas);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;
    ps.resize(w, h);
    renderer.resize(w, h);
  }

  resize();
  ps.init(300);

  // 性能监控：当连续帧率低于 40fps 时，自动减少星星数量
  let fpsWarningCount = 0;
  let starCount = 300;

  let lastTime = 0;
  function loop(ts) {
    const dt = lastTime ? Math.min(ts - lastTime, 50) : 16; // 上限 50ms 防跳帧
    lastTime = ts;

    ps.update(dt);
    renderer.render(ps);

    // 简单 FPS 保护：dt > 25ms（< 40fps）连续 3 帧则精简粒子
    if (dt > 25) {
      fpsWarningCount++;
      if (fpsWarningCount >= 3 && starCount > 150) {
        starCount = Math.max(150, starCount - 50);
        ps.init(starCount);
        fpsWarningCount = 0;
      }
    } else {
      fpsWarningCount = 0;
    }

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

  window.addEventListener('resize', resize);
}

main();
