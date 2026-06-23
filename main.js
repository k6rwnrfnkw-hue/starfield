/**
 * main.js  —  入口，协调 Renderer（Codex）+ Interaction（Codex + Claude）
 */
import { Renderer }     from './renderer.js';
import { Interaction }  from './interaction.js';

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const renderer    = new Renderer(canvas);
const interaction = new Interaction();

// 给每颗星分配唯一 ID（连线去重用）
renderer.particles.stars.forEach((s, i) => s._id = i);

// 劫持 Renderer.drawStars，加入视差偏移
const _origDrawStars = renderer.drawStars.bind(renderer);
renderer.drawStars = function () {
  // 先更新鼠标偏移
  interaction.update(this.particles.stars);

  // 用 offsetX/Y 临时移位绘制
  const stars = this.particles.stars;
  for (const s of stars) { s._ox = s.x; s._oy = s.y; s.x += s.offsetX ?? 0; s.y += s.offsetY ?? 0; }
  _origDrawStars();
  for (const s of stars) { s.x = s._ox; s.y = s._oy; }
};

// 劫持 render，在每帧末尾叠加连线
const _origRender = renderer.render.bind(renderer);
renderer.render = function (time) {
  _origRender(time);
  // 连线画在 stars 之上（已含视差偏移坐标 _rx/_ry）
  interaction.drawConnections(this.ctx, this.particles.stars);
};

renderer.start();
