/* Audio y efectos de sonido */
import { readJSON, writeJSON } from './utils.js';

const KEY = 'tyg.muted';

const SFX = {
  select: { src: 'assets/audio/sfx_select.wav', volume: 0.85, reverb: 0.16, duck: 0.8 },
  correct: { src: 'assets/audio/sfx_coin.wav', volume: 0.9, reverb: 0.2, duck: 0.72 },
  wrong: { src: 'assets/audio/sfx_hurt.wav', volume: 0.98, reverb: 0.2, duck: 0.72 },
  pull: { src: 'assets/audio/sfx_jump.wav', volume: 0.6, reverb: 0.16, duck: 0.85 },
  win: { src: 'assets/audio/sfx_win.wav', volume: 0.6, reverb: 0.24, duck: 0.7 },
  tick: {
    src: ['assets/audio/sfx_clock1.wav', 'assets/audio/sfx_clock2.wav'],
    volume: 0.9,
    reverb: 0.05,
    duck: 1,
    trim: 0.14,
    peak: 0.9,
  },
};

const STREAK_MS = 900;
const STREAK_STEP = 0.06;
const STREAK_MAX = 4;
const STREAKED = new Set(['correct', 'wrong']);

const MUSIC_VOLUME = 0.35;
const MUSIC_DUCK_VOLUME = 0.1;
const DUCK_RELEASE = 0.22;
const REVERB_SECONDS = 1.3;
const REVERB_DECAY = 3.2;

let muted = Boolean(readJSON(KEY, false));
let ctx = null;
let nodes = null;
let music = null;
let musicGain = null;
let musicLevel = MUSIC_VOLUME;
let fadeTimer = null;
const buffers = {};
const rotation = {};
const streak = { name: '', at: 0, count: 0 };

function buildImpulse(context) {
  const rate = context.sampleRate;
  const length = Math.floor(rate * REVERB_SECONDS);
  const impulse = context.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      const t = i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, REVERB_DECAY);
    }
  }
  return impulse;
}

function ensureContext() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor({ latencyHint: 'interactive' });
  } catch {
    ctx = null;
    return null;
  }

  const master = ctx.createGain();
  master.gain.value = muted ? 0 : 1;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -10;
  limiter.knee.value = 12;
  limiter.ratio.value = 6;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.2;
  master.connect(limiter);
  limiter.connect(ctx.destination);

  const duck = ctx.createGain();
  duck.connect(master);

  const sfx = ctx.createGain();
  sfx.connect(master);

  const convolver = ctx.createConvolver();
  convolver.buffer = buildImpulse(ctx);
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 5200;
  tone.connect(convolver);
  convolver.connect(master);

  nodes = { master, duck, sfx, send: tone };
  loadBuffers();
  return ctx;
}

function prepare(buffer, item) {
  if (!item.trim) return buffer;
  const rate = buffer.sampleRate;
  const length = Math.min(buffer.length, Math.floor(item.trim * rate));
  const out = ctx.createBuffer(buffer.numberOfChannels, length, rate);
  let peak = 0;
  for (let c = 0; c < buffer.numberOfChannels; c += 1) {
    const src = buffer.getChannelData(c).subarray(0, length);
    const dst = out.getChannelData(c);
    dst.set(src);
    for (let i = 0; i < length; i += 1) peak = Math.max(peak, Math.abs(dst[i]));
  }
  const gain = peak > 0 ? (item.peak || 0.9) / peak : 1;
  const fade = Math.floor(length * 0.35);
  for (let c = 0; c < out.numberOfChannels; c += 1) {
    const dst = out.getChannelData(c);
    for (let i = 0; i < length; i += 1) {
      const tail = i >= length - fade ? (length - i) / fade : 1;
      dst[i] *= gain * tail;
    }
  }
  return out;
}

async function loadOne(src, item) {
  if (buffers[src]) return;
  try {
    const response = await fetch(src);
    const data = await response.arrayBuffer();
    const decoded = await ctx.decodeAudioData(data);
    buffers[src] = prepare(decoded, item);
  } catch {
    /* noop */
  }
}

function loadBuffers() {
  for (const item of Object.values(SFX)) {
    const sources = Array.isArray(item.src) ? item.src : [item.src];
    sources.forEach((src) => loadOne(src, item));
  }
}

function resumeContext() {
  if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = Boolean(value);
  writeJSON(KEY, muted);
  if (nodes) nodes.master.gain.value = muted ? 0 : 1;
  if (music) {
    if (muted) music.pause();
    else {
      resumeContext();
      music.play().catch(() => {});
    }
  }
  return muted;
}

export function toggleMuted() {
  return setMuted(!muted);
}

export function unlockAudio() {
  ensureContext();
  resumeContext();
}

function cancelFade() {
  clearInterval(fadeTimer);
  fadeTimer = null;
}

function applyLevel(value) {
  musicLevel = Math.min(1, Math.max(0, value));
  if (musicGain) musicGain.gain.value = musicLevel;
}

function fadeMusicTo(target, ms, done) {
  cancelFade();
  if (!music) return;
  const from = musicLevel;
  if (ms <= 0 || from === target) {
    applyLevel(target);
    done?.();
    return;
  }
  const t0 = Date.now();
  fadeTimer = setInterval(() => {
    const p = Math.min(1, (Date.now() - t0) / ms);
    const eased = 1 - (1 - p) * (1 - p);
    applyLevel(from + (target - from) * eased);
    if (p >= 1) {
      cancelFade();
      done?.();
    }
  }, 40);
}

function attachMusic(el) {
  if (!ensureContext()) {
    el.volume = musicLevel;
    return;
  }
  musicGain = ctx.createGain();
  musicGain.gain.value = musicLevel;
  const source = ctx.createMediaElementSource(el);
  source.connect(musicGain);
  musicGain.connect(nodes.duck);
}

export function startMusic(src = 'assets/audio/game_bg_music.ogg', volume = MUSIC_VOLUME) {
  if (!music) {
    music = new Audio(src);
    music.loop = true;
    musicLevel = volume;
    attachMusic(music);
  } else {
    fadeMusicTo(volume, 1200);
  }
  if (!muted) {
    resumeContext();
    music.play().catch(() => {});
  }
}

export function resumeMusic() {
  if (!music || muted) return;
  resumeContext();
  if (music.paused) music.play().catch(() => {});
}

export function duckMusic(volume = MUSIC_DUCK_VOLUME, ms = 1800) {
  fadeMusicTo(volume, ms);
}

export function stopMusic({ fade = 0 } = {}) {
  if (!music) return;
  const el = music;
  const gain = musicGain;
  const end = () => {
    el.pause();
    if (music === el) {
      music = null;
      musicGain = null;
    }
    try {
      gain?.disconnect();
    } catch {
      /* noop */
    }
  };
  if (fade > 0) {
    fadeMusicTo(0, fade, end);
    return;
  }
  cancelFade();
  end();
}

function streakRate(name) {
  if (!STREAKED.has(name)) return 1;
  const now = Date.now();
  if (streak.name === name && now - streak.at < STREAK_MS) streak.count += 1;
  else streak.count = 0;
  streak.name = name;
  streak.at = now;
  return 1 + Math.min(streak.count, STREAK_MAX) * STREAK_STEP;
}

function duckForEffect(amount, seconds) {
  if (!nodes || amount >= 1) return;
  const param = nodes.duck.gain;
  const now = ctx.currentTime;
  param.setTargetAtTime(amount, now, 0.025);
  param.setTargetAtTime(1, now + Math.max(0.15, seconds), DUCK_RELEASE / 3);
}

export function play(name, options = {}) {
  if (muted) return;
  const item = SFX[name];
  if (!item) return;
  const context = ensureContext();
  if (!context) return;
  resumeContext();

  const sources = Array.isArray(item.src) ? item.src : [item.src];
  const index = rotation[name] || 0;
  rotation[name] = (index + 1) % sources.length;
  const buffer = buffers[sources[index]];
  if (!buffer) return;

  let rate = options.pitch ?? streakRate(name);
  if (item.trim) rate = Math.min(1.08, Math.max(0.95, rate));

  const source = context.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = rate;

  const dry = context.createGain();
  dry.gain.value = item.volume;
  source.connect(dry);
  dry.connect(nodes.sfx);

  if (item.reverb > 0) {
    const wet = context.createGain();
    wet.gain.value = item.reverb * item.volume;
    source.connect(wet);
    wet.connect(nodes.send);
  }

  source.onended = () => {
    try {
      source.disconnect();
      dry.disconnect();
    } catch {
      /* noop */
    }
  };
  source.start();

  const activeSeconds = Math.min(buffer.duration, 0.9) / rate;
  duckForEffect(item.duck, activeSeconds);
}

if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', unlockAudio, { once: true, passive: true });
  document.addEventListener('keydown', unlockAudio, { once: true });
}

export const SFX_LIST = Object.keys(SFX);