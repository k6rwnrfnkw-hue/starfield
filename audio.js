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
