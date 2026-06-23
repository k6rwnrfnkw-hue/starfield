/**
 * interaction.js  —  Codex 编写，Claude 整合
 * 鼠标视差偏移 + 附近星星连线
 */

const CONNECT_DIST = 80;
const MAX_OFFSET   = 28;
const LERP         = 0.06;

export class Interaction {
  constructor() {
    this.mx = window.innerWidth  / 2;
    this.my = window.innerHeight / 2;
    this._nx = 0; // 归一化 -1~1
    this._ny = 0;
    window.addEventListener('mousemove', e => {
      this.mx = e.clientX;
      this.my = e.clientY;
    }, { passive: true });
  }

  /** 每帧更新：平滑跟随鼠标，写入 star.offsetX/Y */
  update(stars) {
    this._nx += ((this.mx / window.innerWidth  - 0.5) * 2 - this._nx) * LERP;
    this._ny += ((this.my / window.innerHeight - 0.5) * 2 - this._ny) * LERP;

    const maxLayer = 3;
    for (const s of stars) {
      const depth = (s.layer + 1) / maxLayer;
      s.offsetX = (s.offsetX ?? 0) + (this._nx * MAX_OFFSET * depth - (s.offsetX ?? 0)) * LERP;
      s.offsetY = (s.offsetY ?? 0) + (this._ny * MAX_OFFSET * depth - (s.offsetY ?? 0)) * LERP;
    }
  }

  /** 绘制附近星星之间的细连线 */
  drawConnections(ctx, stars) {
    const D2 = CONNECT_DIST * CONNECT_DIST;

    // 空间网格加速（只检查相邻格子）
    const grid = new Map();
    for (const s of stars) {
      const rx = s.x + (s.offsetX ?? 0);
      const ry = s.y + (s.offsetY ?? 0);
      s._rx = rx; s._ry = ry;
      const key = `${s.layer}:${Math.floor(rx / CONNECT_DIST)}:${Math.floor(ry / CONNECT_DIST)}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(s);
    }

    ctx.save();
    ctx.lineCap = 'round';
    let checks = 0;

    for (const s of stars) {
      if (checks > 10000) break;
      const cx = Math.floor(s._rx / CONNECT_DIST);
      const cy = Math.floor(s._ry / CONNECT_DIST);

      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          const bucket = grid.get(`${s.layer}:${gx}:${gy}`);
          if (!bucket) continue;
          for (const o of bucket) {
            if (o._id <= s._id) continue;
            checks++;
            const dx = o._rx - s._rx, dy = o._ry - s._ry;
            const d2 = dx * dx + dy * dy;
            if (d2 >= D2) continue;
            const a = (1 - Math.sqrt(d2) / CONNECT_DIST) * 0.45;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(180,210,255,${a.toFixed(3)})`;
            ctx.lineWidth = 0.4 + a * 0.6;
            ctx.moveTo(s._rx, s._ry);
            ctx.lineTo(o._rx, o._ry);
            ctx.stroke();
          }
        }
      }
    }
    ctx.restore();
  }
}
