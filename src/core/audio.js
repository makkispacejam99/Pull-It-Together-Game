/* Audio y efectos de sonido */

import { readJSON, writeJSON } from './utils.js';

const KEY = 'tyg.muted';

const SFX = {
  select: { src: 'assets/audio/sfx_select.wav', volume: 0.85 },
  correct: { src: 'assets/audio/sfx_coin.wav', volume: 0.90 },
  wrong: { src: 'assets/audio/sfx_hurt.wav', volume: 0.98 },
  pull: { src: 'assets/audio/sfx_jump.wav', volume: 0.60 },
  win: { src: 'assets/audio/sfx_win.wav', volume: 0.60 },
  tick: { src: ['assets/audio/sfx_clock1.wav', 'assets/audio/sfx_clock2.wav'], volume: 0.80 },
};

const STREAK_MS = 900;
const STREAK_STEP = 0.06;
const STREAK_MAX = 4;
const STREAKED = new Set(['correct', 'wrong']);

let muted = Boolean(readJSON(KEY, false));
let unlocked = false;
let music = null;
const rotation = {};
const streak = { name: '', at: 0, count: 0 };

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = Boolean(value);
  writeJSON(KEY, muted);
  if (music) {
    if (muted) music.pause();
    else music.play().catch(() => {});
  }
  return muted;
}

export function toggleMuted() {
  return setMuted(!muted);
}

export function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  try {
    const audio = new Audio(SFX.select.src);
    audio.volume = 0;
    audio.play().catch(() => {});
  } catch {
    /* noop */
  }
}

/* Musica de Fondo */
const MUSIC_VOLUME = 0.35;
const MUSIC_DUCK_VOLUME = 0.1;
let fadeTimer = null;

function cancelFade() {
  clearInterval(fadeTimer);
  fadeTimer = null;
}

function fadeMusicTo(target, ms, done) {
  cancelFade();
  const el = music;
  if (!el) return;
  const from = el.volume;
  if (ms <= 0 || from === target) {
    el.volume = target;
    done?.();
    return;
  }
  const t0 = Date.now();
  fadeTimer = setInterval(() => {
    const p = Math.min(1, (Date.now() - t0) / ms);
    const eased = 1 - (1 - p) * (1 - p);
    el.volume = Math.min(1, Math.max(0, from + (target - from) * eased));
    if (p >= 1) {
      cancelFade();
      done?.();
    }
  }, 40);
}

export function startMusic(src = 'assets/audio/game_bg_music.ogg', volume = MUSIC_VOLUME) {
  if (!music) {
    music = new Audio(src);
    music.loop = true;
    music.volume = volume;
  } else {
    fadeMusicTo(volume, 1200);
  }
  if (!muted) music.play().catch(() => {});
}

export function duckMusic(volume = MUSIC_DUCK_VOLUME, ms = 1800) {
  fadeMusicTo(volume, ms);
}

export function stopMusic({ fade = 0 } = {}) {
  if (!music) return;
  const el = music;
  const end = () => {
    el.pause();
    if (music === el) music = null;
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

export function play(name, options = {}) {
  if (muted) return;
  const item = SFX[name];
  if (!item) return;
  const sources = Array.isArray(item.src) ? item.src : [item.src];
  const index = rotation[name] || 0;
  rotation[name] = (index + 1) % sources.length;
  const rate = options.pitch ?? streakRate(name);
  try {
    const audio = new Audio(sources[index]);
    audio.volume = item.volume;
    if (rate !== 1) {
      audio.preservesPitch = false;
      audio.playbackRate = rate;
    }
    audio.play().catch(() => {});
  } catch {
    /* noop */
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', unlockAudio, { once: true, passive: true });
  document.addEventListener('keydown', unlockAudio, { once: true });
}

export const SFX_LIST = Object.keys(SFX);
