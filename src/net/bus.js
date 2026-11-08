/* Transporte de datos y salas */

import { readJSON, writeJSON, roomCode } from '../core/utils.js';
import { supabase } from './supabase.js';

const snapshotKey = (code) => `tyg:room:${code}`;
const meKey = (code) => `tyg:me:${code}`;
const hostKey = (code) => `tyg:host:${code}`;

export { roomCode };

const shared = new Map();
const IDLE_MS = 15000;

function pushMessage(entry, msg) {
  entry.channel.send({ type: 'broadcast', event: 'msg', payload: msg }).catch(() => {});
}

function acquire(topic) {
  let entry = shared.get(topic);
  if (!entry) {
    entry = { refs: 0, handlers: new Set(), queue: [], waiters: [], ready: false, timer: null, channel: null };
    entry.channel = supabase.channel(topic);
    entry.channel.on('broadcast', { event: 'msg' }, ({ payload }) => {
      entry.handlers.forEach((handler) => handler(payload));
    });
    entry.channel.subscribe((status, error) => {
      if (status === 'SUBSCRIBED') {
        entry.ready = true;
        entry.queue.splice(0).forEach((msg) => pushMessage(entry, msg));
        entry.waiters.splice(0).forEach((fn) => fn());
        return;
      }
      entry.ready = false;
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('Realtime:', status, error);
      }
    });
    shared.set(topic, entry);
  }
  clearTimeout(entry.timer);
  entry.refs += 1;
  return entry;
}

function release(topic) {
  const entry = shared.get(topic);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs > 0) return;
  entry.timer = setTimeout(() => {
    if (entry.refs > 0) return;
    shared.delete(topic);
    supabase.removeChannel(entry.channel);
  }, IDLE_MS);
}

function sendUp(topic, msg) {
  supabase
    .channel(topic)
    .httpSend('msg', msg)
    .catch((error) => console.warn('Realtime up:', error.message));
}

export class Channel {
  constructor(code, role = 'player') {
    this.code = code;
    this.role = role;
    this.own = new Set();
    this.closed = false;
    this.downTopic = `tyg:${code}`;
    this.upTopic = `tyg:${code}:up`;
    this.down = acquire(this.downTopic);
    this.up = role === 'host' ? acquire(this.upTopic) : null;
    this.listen = role === 'host' ? this.up : this.down;
  }

  send(msg) {
    if (this.closed) return;

    if (this.role !== 'host') {
      const go = () => {
        if (!this.closed) sendUp(this.upTopic, msg);
      };
      if (this.down.ready) {
        go();
        return;
      }
      this.down.waiters.push(go);
      if (this.down.waiters.length > 20) this.down.waiters.shift();
      return;
    }

    if (this.down.ready) {
      pushMessage(this.down, msg);
      return;
    }
    this.down.queue.push(msg);
    if (this.down.queue.length > 20) this.down.queue.shift();
  }

  on(handler) {
    this.own.add(handler);
    this.listen.handlers.add(handler);
    return () => {
      this.own.delete(handler);
      this.listen.handlers.delete(handler);
    };
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.own.forEach((handler) => this.listen.handlers.delete(handler));
    this.own.clear();
    release(this.downTopic);
    if (this.up) release(this.upTopic);
  }
}

let pendingState = null;
let lastSave = 0;
let saveTimer = null;

async function upsertRoom(state) {
  const { error } = await supabase.from('rooms').upsert({ code: state.code, state }, { onConflict: 'code' });
  if (error) console.warn('rooms upsert:', error.message);
}

function flushRoom() {
  saveTimer = null;
  if (!pendingState) return;
  const state = pendingState;
  pendingState = null;
  lastSave = Date.now();
  upsertRoom(state);
}

function queueRoomSave(state) {
  pendingState = state;
  if (saveTimer) return;
  const wait = Math.max(0, 2500 - (Date.now() - lastSave));
  saveTimer = setTimeout(flushRoom, wait);
}

export function saveSnapshot(state) {
  queueRoomSave(state);
  return writeJSON(snapshotKey(state.code), state);
}

export async function fetchSnapshot(code) {
  const { data, error } = await supabase.from('rooms').select('state').eq('code', code).maybeSingle();
  if (error) {
    console.warn('rooms select:', error.message);
    return null;
  }
  return data?.state || null;
}

export function loadSnapshot(code) {
  return readJSON(snapshotKey(code), null);
}

export function saveMe(code, me) {
  return writeJSON(meKey(code), me);
}

export function loadMe(code) {
  return readJSON(meKey(code), null);
}

export function clearMe(code) {
  try {
    localStorage.removeItem(meKey(code));
  } catch {
    /* noop */
  }
}

export function roomExists(code) {
  const snapshot = loadSnapshot(code);
  return Boolean(snapshot && snapshot.code === code);
}

export function touchHost(code) {
  writeJSON(hostKey(code), Date.now());
}

export function hostAlive(code) {
  const stamp = readJSON(hostKey(code), 0);
  return Date.now() - Number(stamp || 0) < 8000;
}