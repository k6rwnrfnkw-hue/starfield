/**
 * audio.js — Web Audio API 合成音效
 * 所有声音均通过程序生成，无需外部文件
 */

let ctx = null;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** 爆炸：短促噪声冲击 + 低频轰鸣 */
export function playExplosion(intensity = 1) {
  const ac = getCtx();
  const now = ac.currentTime;

  // 噪声层
  const bufLen = ac.sampleRate * 0.35;
  const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1);

  const noise = ac.createBufferSource();
  noise.buffer = buf;

  const noiseEnv = ac.createGain();
  noiseEnv.gain.setValueAtTime(0.18 * intensity, now);
  noiseEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 200 + Math.random() * 300;
  filter.Q.value = 0.8;

  noise.connect(filter);
  filter.connect(noiseEnv);
  noiseEnv.connect(ac.destination);
  noise.start(now);
  noise.stop(now + 0.35);

  // 低频轰鸣
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(80 + Math.random() * 40, now);
  osc.frequency.exponentialRampToValueAtTime(20, now + 0.4);

  const oscEnv = ac.createGain();
  oscEnv.gain.setValueAtTime(0.22 * intensity, now);
  oscEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

  osc.connect(oscEnv);
  oscEnv.connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.4);
}

/** 超空间：上扫频 + 电子嗡鸣 */
export function playWarp() {
  const ac = getCtx();
  const now = ac.currentTime;
  const dur  = 1.3;

  const osc1 = ac.createOscillator();
  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(80, now);
  osc1.frequency.exponentialRampToValueAtTime(2400, now + dur * 0.6);
  osc1.frequency.exponentialRampToValueAtTime(400, now + dur);

  const osc2 = ac.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(60, now);
  osc2.frequency.exponentialRampToValueAtTime(1800, now + dur * 0.6);
  osc2.frequency.exponentialRampToValueAtTime(200, now + dur);

  const env = ac.createGain();
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(0.14, now + 0.1);
  env.gain.setValueAtTime(0.14, now + dur * 0.5);
  env.gain.exponentialRampToValueAtTime(0.001, now + dur);

  const flange = ac.createDelay(0.05);
  flange.delayTime.setValueAtTime(0.02, now);
  flange.delayTime.linearRampToValueAtTime(0.04, now + dur);

  [osc1, osc2].forEach(o => { o.connect(flange); flange.connect(env); });
  env.connect(ac.destination);
  [osc1, osc2].forEach(o => { o.start(now); o.stop(now + dur + 0.1); });
}

/** 引力井创建：低沉嗡嗡声 */
export function playGravityWell() {
  const ac = getCtx();
  const now = ac.currentTime;

  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(55, now);
  osc.frequency.linearRampToValueAtTime(40, now + 3.0);

  const lfo = ac.createOscillator();
  lfo.frequency.value = 4;
  const lfoGain = ac.createGain();
  lfoGain.gain.value = 8;
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);

  const env = ac.createGain();
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(0.12, now + 0.3);
  env.gain.setValueAtTime(0.12, now + 2.5);
  env.gain.exponentialRampToValueAtTime(0.001, now + 3.0);

  osc.connect(env);
  env.connect(ac.destination);
  lfo.start(now);
  osc.start(now);
  lfo.stop(now + 3.1);
  osc.stop(now + 3.1);
}

/** 流星划过：高频下扫 */
export function playMeteor() {
  const ac = getCtx();
  const now = ac.currentTime;

  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1800 + Math.random() * 600, now);
  osc.frequency.exponentialRampToValueAtTime(300, now + 0.6);

  const env = ac.createGain();
  env.gain.setValueAtTime(0.06, now);
  env.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

  osc.connect(env);
  env.connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.65);
}

// ── 环境音乐 ──────────────────────────────────────────────────────────────
let _ambientNodes = null;

/** 启动/停止宇宙环境音乐 */
export function toggleAmbient() {
  if (_ambientNodes) {
    _ambientNodes.forEach(n => { try { n.stop?.(); n.disconnect?.(); } catch(e){} });
    _ambientNodes = null;
    return false; // 已停止
  }

  const ac = getCtx();
  const nodes = [];
  const masterGain = ac.createGain();
  masterGain.gain.value = 0;
  masterGain.connect(ac.destination);
  nodes.push(masterGain);

  // 渐入
  masterGain.gain.linearRampToValueAtTime(0.08, ac.currentTime + 3);

  // 主和弦（D小调氛围）
  const chordFreqs = [36.7, 55, 73.4, 110, 146.8]; // D1 A1 D2 A2 D3
  chordFreqs.forEach((freq, i) => {
    const osc = ac.createOscillator();
    osc.type = i % 2 === 0 ? 'sine' : 'triangle';
    osc.frequency.value = freq;

    // 慢速颤音 LFO
    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.05 + i * 0.03;
    const lfoGain = ac.createGain();
    lfoGain.gain.value = freq * 0.003;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const g = ac.createGain();
    g.gain.value = 0.12 / (i + 1);
    osc.connect(g);
    g.connect(masterGain);

    osc.start();
    lfo.start();
    nodes.push(osc, lfo, g, lfoGain);
  });

  // 高频闪光（偶发晶莹音）
  const sparkTimer = setInterval(() => {
    if (!_ambientNodes) { clearInterval(sparkTimer); return; }
    const ac2 = getCtx();
    const osc = ac2.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 880 * (1 + Math.floor(Math.random() * 4) * 0.5);
    const g = ac2.createGain();
    g.gain.setValueAtTime(0, ac2.currentTime);
    g.gain.linearRampToValueAtTime(0.03, ac2.currentTime + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, ac2.currentTime + 2.5);
    osc.connect(g);
    g.connect(ac2.destination);
    osc.start();
    osc.stop(ac2.currentTime + 2.6);
  }, 3000 + Math.random() * 4000);

  _ambientNodes = nodes;
  _ambientNodes._sparkTimer = sparkTimer;
  return true; // 已启动
}

/** 超新星：明亮叮鸣 */
export function playNova() {
  const ac = getCtx();
  const now = ac.currentTime;

  [1, 2, 3].forEach((h, i) => {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 880 * h;

    const env = ac.createGain();
    env.gain.setValueAtTime(0.08 / h, now + i * 0.02);
    env.gain.exponentialRampToValueAtTime(0.001, now + 1.2 - i * 0.1);

    osc.connect(env);
    env.connect(ac.destination);
    osc.start(now + i * 0.02);
    osc.stop(now + 1.3);
  });
}
