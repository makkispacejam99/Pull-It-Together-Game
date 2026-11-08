/* Conexión del jugador con la sala */

import { Channel, saveMe } from '../net/bus.js';

export class PlayerClient {
  constructor(code, me, handlers = {}) {
    this.code = code;
    this.me = me;
    this.handlers = handlers;
    this.state = null;
    this.offset = 0;
    this.lastMessageAt = 0;
    this.connected = false;
    this.destroyed = false;
    this.joinTimer = null;

    this.channel = new Channel(code);
    this.unsub = this.channel.on((msg) => this.onMessage(msg));
  }

  connect() {
    saveMe(this.code, this.me);
    this.sendJoin();
        this.pingTimer = setInterval(() => {
      this.channel.send({ t: 'ping', playerId: this.me.id });
    }, 15000);
    this.checkTimer = setInterval(() => {
      this.checkAlive();
      if (this.state && !this.presentInState() && this.state.status !== 'results') {
        this.sendJoin();
      }
    }, 3500);
    this.channel.send({ t: 'hello' });
  }

  sendJoin() {
    this.channel.send({
      t: 'join',
      playerId: this.me.id,
      nickname: this.me.nickname,
      team: this.me.team,
      avatar: this.me.avatar,
    });
  }

  presentInState() {
    return Boolean(this.state?.players?.some((p) => p.id === this.me.id));
  }

  onMessage(msg) {
    if (!msg || typeof msg !== 'object') return;
    this.lastMessageAt = Date.now();

    switch (msg.t) {
      case 'state':
        this.offset = Number(msg.now || Date.now()) - Date.now();
        this.state = msg.state;
        this.setConnected(true);
        this.handlers.onState?.(this.state);
        break;

      case 'joined':
        if (msg.to === this.me.id) this.handlers.onJoined?.(msg);
        break;

      case 'error':
        if (msg.to && msg.to !== this.me.id) return;
        this.handlers.onError?.(msg.message || 'No se pudo unir a la sala.');
        break;

      case 'kicked':
        if (msg.to === this.me.id) this.handlers.onKicked?.();
        break;

      default:
        break;
    }
  }

  checkAlive() {
    if (!this.lastMessageAt) return;
    const alive = Date.now() - this.lastMessageAt < 40000;
    this.setConnected(alive);
  }

  setConnected(value) {
    if (this.connected === value) return;
    this.connected = value;
    this.handlers.onConnection?.(value);
  }

  serverNow() {
    return Date.now() + this.offset;
  }

  remainingMs() {
    if (!this.state?.endsAt) return 0;
    return Math.max(0, this.state.endsAt - this.serverNow());
  }

  vote(choice) {
    if (!this.state) return;
    this.channel.send({
      t: 'vote',
      playerId: this.me.id,
      choice,
      round: this.state.round,
    });
  }

  updateMe(patch) {
    this.me = { ...this.me, ...patch };
    saveMe(this.code, this.me);
  }

  destroy() {
    this.destroyed = true;
    clearInterval(this.checkTimer);
    clearTimeout(this.joinTimer);
    this.channel.send({ t: 'leave', playerId: this.me.id });
    this.unsub?.();
    this.channel.close();
  }
}
