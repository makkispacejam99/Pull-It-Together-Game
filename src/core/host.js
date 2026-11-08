/* Anfitrion */
/* El anfitrion es el único que conoce la respuesta correcta durante la ronda */ 

import { Channel, loadSnapshot, saveSnapshot, touchHost } from '../net/bus.js';
import { buildQueue, loadBank, toPublic } from './questions.js';
import {
  applyBonuses,
  individualPoints,
  isKnockout,
  rankPlayers,
  resolveWinner,
  ropeFromScores,
  tallyRound,
  clamp,
} from './rules.js';
import { pick, readJSON, uid, writeJSON } from './utils.js';

export const MAX_PLAYERS = 30;
export const MIN_PLAYERS = 2;
const MAX_PER_TEAM = MAX_PLAYERS / 2;
export const PHASE_MS = {
  countdown: 3000,
  reveal: 7000,
  allVoted: 900,
};

const BOT_NAMES = [
  'Pixel', 'Turbo', 'Zeta', 'Nova', 'Bombo', 'Chispa', 'Kuma', 'Rayo',
  'Tofu', 'Mango', 'Bruno', 'Luna', 'Taco', 'Michi', 'Duna', 'Beto',
  'Frida', 'Nube', 'Pogo', 'Yuki', 'Rulo', 'Canela', 'Trueno', 'Kiwi',
  'Samba', 'Coco', 'Pepa', 'Golfo', 'Mimo', 'Vega',
];

const AVATARS = ['green', 'pink', 'purple', 'yellow', 'beige'];

const hostDataKey = (code) => `tyg:hostdata:${code}`;

export function createState(code) {
  const totalRounds = 8;
  return {
    v: 1,
    code,
    createdAt: Date.now(),
    revision: 0,
    status: 'lobby',
    config: {
      rounds: totalRounds,
      duration: 45,
      difficulty: 'all',
      categories: [],
    },
    totalRounds,
    teams: {
      A: { name: 'MARCIANOS', score: 0, correct: 0, streak: 0 },
      B: { name: 'SATURNINOS', score: 0, correct: 0, streak: 0 },
    },
    rope: 0,
    round: 0,
    phaseStartedAt: 0,
    endsAt: 0,
    question: null,
    roundPlayers: [],
    voteCount: 0,
    players: [],
    lastResult: null,
    winner: null,
    winnerReason: null,
    ko: false,
    history: [],
  };
}

function createPlayer({ id, nickname, team, avatar, isBot = false }) {
  return {
    id,
    nickname,
    team,
    avatar: AVATARS.includes(avatar) ? avatar : pick(AVATARS),
    isBot,
    score: 0,
    correct: 0,
    answered: 0,
    totalMs: 0,
    streak: 0,
    bestStreak: 0,
    connected: true,
    voted: false,
    lastSeen: Date.now(),
    joinedAt: Date.now(),
  };
}

export class HostRoom {
  constructor(code, { onChange } = {}) {
    this.code = code;
    this.onChange = onChange || (() => {});
    this.state = loadSnapshot(code) || createState(code);

    if (this.state.teams?.A?.name === 'VERDE') this.state.teams.A.name = 'MARCIANOS';
    if (this.state.teams?.B?.name === 'MAGENTA') this.state.teams.B.name = 'SATURNINOS';

    const stored = readJSON(hostDataKey(code), null);
    this.queue = stored?.queue || [];
    this.correctIndex = stored?.correctIndex ?? -1;
    this.votes = stored?.votes || {};
    this.durationMs = stored?.durationMs || this.state.config.duration * 1000;

    this.channel = new Channel(code, 'host');
    this.unsub = this.channel.on((msg) => this.onMessage(msg));
    this.botTimers = [];
    this.tickTimer = null;
    this.lastPublish = 0;
    this.publishTimer = null;
    this.destroyed = false;
    this.kicked = new Set();
  }

  /* Ciclo de vida */

  start() {
    this.resume();
    this.tickTimer = setInterval(() => this.tick(), 250);
    this.publish(true);
    touchHost(this.code);
    this.hostTimer = setInterval(() => {
      touchHost(this.code);
      this.channel.send({ t: 'beat' });
    }, 15000);
  }

  destroy() {
    this.destroyed = true;
    clearInterval(this.tickTimer);
    clearInterval(this.hostTimer);
    clearTimeout(this.publishTimer);
    this.clearBots();
    this.unsub?.();
    this.channel.close();
  }

  resume() {
    const now = Date.now();
    if (this.state.status === 'question') {
      this.state.roundPlayers = this.state.roundPlayers.filter((id) => this.player(id));
      this.scheduleBots();
      if (this.state.endsAt && now > this.state.endsAt + 30000) {
        this.state.endsAt = now + 1500;
      }
    }
    if (this.state.status === 'countdown' && (!this.state.endsAt || now > this.state.endsAt + 30000)) {
      this.state.endsAt = now + 1500;
    }
    if (this.state.status === 'reveal' && (!this.state.endsAt || now > this.state.endsAt + 60000)) {
      this.state.endsAt = now + 1200;
    }
  }

  tick() {
    if (this.destroyed) return;
    const now = Date.now();
    let dirty = false;

    for (const p of this.state.players) {
      if (p.isBot) {
        p.connected = true;
        p.lastSeen = now;
        continue;
      }
      if (p.connected && now - p.lastSeen > 45000) {
        p.connected = false;
        dirty = true;
      }
    }

    if (this.state.status === 'lobby') {
      const before = this.state.players.length;
      this.state.players = this.state.players.filter(
        (p) => p.isBot || p.connected || now - p.lastSeen < 25000
      );
      if (this.state.players.length !== before) dirty = true;
    }

    if (dirty) this.publishSoon();

    if (this.state.endsAt && now >= this.state.endsAt) {
      this.advance();
    }
  }

  advance() {
    switch (this.state.status) {
      case 'countdown':
        this.startQuestion();
        break;
      case 'question':
        this.reveal();
        break;
      case 'reveal':
        if (this.state.ko || this.state.round >= this.state.totalRounds) {
          this.finish();
        } else {
          this.startQuestion();
        }
        break;
      default:
        this.state.endsAt = 0;
    }
  }

  /* Partida */

  configure(patch) {
    if (this.state.status !== 'lobby') return;
    this.state.config = { ...this.state.config, ...patch };
    if (patch.rounds) this.state.totalRounds = clamp(Number(patch.rounds), 1, 20);
    this.publish();
  }

  setTeamName(team, name) {
    if (this.state.status !== 'lobby') return;
    const clean = String(name || '').trim().slice(0, 16);
    if (!clean) return;
    this.state.teams[team].name = clean.toUpperCase();
    this.publishSoon();
  }

  startGame() {
    if (this.state.status !== 'lobby') return;
    const bank = loadBank();
    const queue = buildQueue(bank, this.state.config);
    if (!queue.length) {
      this.emitLocal('No hay preguntas para esos filtros. Revisa el banco.');
      return;
    }
    if (queue.length < this.state.config.rounds) {
      this.emitLocal(`Solo hay ${queue.length} preguntas con esos filtros: la partida tendrá ${queue.length} rondas.`);
    }

    const hasA = this.state.players.some((p) => p.team === 'A');
    const hasB = this.state.players.some((p) => p.team === 'B');
    if (!hasA || !hasB) {
      this.emitLocal('Cada equipo necesita al menos un jugador.');
      return;
    }

    this.queue = queue;
    this.state.round = 0;
    this.state.totalRounds = queue.length;
    this.state.rope = 0;
    this.state.ko = false;
    this.state.winner = null;
    this.state.winnerReason = null;
    this.state.lastResult = null;
    this.state.history = [];
    this.state.status = 'countdown';
    this.state.phaseStartedAt = Date.now();
    this.state.endsAt = Date.now() + PHASE_MS.countdown;
    this.state.question = null;
    this.state.voteCount = 0;

    for (const team of ['A', 'B']) {
      this.state.teams[team].score = 0;
      this.state.teams[team].correct = 0;
      this.state.teams[team].streak = 0;
    }
    for (const p of this.state.players) {
      p.score = 0;
      p.correct = 0;
      p.answered = 0;
      p.totalMs = 0;
      p.streak = 0;
      p.bestStreak = 0;
      p.voted = false;
    }

    this.votes = {};
    this.correctIndex = -1;
    this.saveHostData();
    this.publish();
    this.emitLocal(null, 'start');
  }

  startQuestion() {
    const index = this.state.round;
    const question = this.queue[index];
    if (!question) {
      this.finish();
      return;
    }

    const now = Date.now();
    this.state.round = index + 1;
    this.durationMs = (question.time || this.state.config.duration) * 1000;
    this.state.question = toPublic(question);
    this.correctIndex = question.correct;
    this.votes = {};
    this.state.voteCount = 0;
    this.state.roundPlayers = this.state.players
      .filter((p) => p.connected && p.joinedAt <= now + 1000)
      .map((p) => p.id);
    this.state.phaseStartedAt = now;
    this.state.endsAt = now + this.durationMs;
    this.state.status = 'question';

    for (const p of this.state.players) p.voted = false;

    this.clearBots();
    this.saveHostData();
    this.publish();
    this.emitLocal(null, 'question');
    this.scheduleBots();
  }

  reveal() {
    if (this.state.status !== 'question') return;
    const now = Date.now();
    const duration = this.durationMs || this.state.config.duration * 1000;
    const participants = this.state.players.filter((p) => this.state.roundPlayers.includes(p.id));

    const result = applyBonuses(
      tallyRound({
        votes: this.votes,
        players: participants,
        correctIndex: this.correctIndex,
        durationMs: duration,
      }),
      this.state.teams
    );

    const individuals = {};
    for (const p of participants) {
      const vote = this.votes[p.id];
      if (!vote) continue;
      const correct = vote.choice === this.correctIndex;
      const points = individualPoints({ correct, ms: vote.ms, durationMs: duration });
      p.score += points;
      p.answered += 1;
      p.totalMs += vote.ms;
      if (correct) {
        p.correct += 1;
        p.streak += 1;
        p.bestStreak = Math.max(p.bestStreak, p.streak);
      } else {
        p.streak = 0;
      }
      individuals[p.id] = { choice: vote.choice, correct, ms: vote.ms, points };
    }

    const ropeBefore = this.state.rope;
    this.state.teams.A.score += result.A.pull;
    this.state.teams.B.score += result.B.pull;
    this.state.rope = ropeFromScores(this.state.teams.A.score, this.state.teams.B.score);
    const delta = this.state.rope - ropeBefore;
    this.state.ko = isKnockout(this.state.teams.A.score, this.state.teams.B.score);

    const roundResult = {
      round: this.state.round,
      correctIndex: this.correctIndex,
      teams: result,
      individuals,
      ropeBefore,
      ropeAfter: this.state.rope,
      delta,
      question: this.state.question,
    };

    this.state.lastResult = roundResult;
    this.state.history.push({
      round: this.state.round,
      correctIndex: this.correctIndex,
      choiceA: result.A.choice,
      choiceB: result.B.choice,
      pullA: result.A.pull,
      pullB: result.B.pull,
      rope: this.state.rope,
    });

    this.state.status = 'reveal';
    this.state.phaseStartedAt = now;
    this.state.endsAt = now + PHASE_MS.reveal;

    this.saveHostData();
    this.publish();
    this.emitLocal(null, 'reveal');
  }

  finish() {
    const { winner, reason } = resolveWinner(this.state);
    this.state.status = 'results';
    this.state.winner = winner;
    this.state.winnerReason = reason;
    this.state.endsAt = 0;
    this.clearBots();
    this.publish();
    this.emitLocal(null, 'finish');
  }

  skip() {
    if (!this.state.endsAt) return;
    this.state.endsAt = Date.now();
    this.publishSoon();
  }

  resetToLobby() {    this.state.status = 'lobby';
    this.state.round = 0;
    this.state.rope = 0;
    this.state.ko = false;
    this.state.winner = null;
    this.state.winnerReason = null;
    this.state.question = null;
    this.state.lastResult = null;
    this.state.history = [];
    this.state.endsAt = 0;
    this.state.voteCount = 0;
    this.votes = {};
    this.queue = [];
    this.correctIndex = -1;
    for (const team of ['A', 'B']) {
      this.state.teams[team].score = 0;
      this.state.teams[team].correct = 0;
      this.state.teams[team].streak = 0;
    }
    for (const p of this.state.players) {
      p.score = 0;
      p.correct = 0;
      p.answered = 0;
      p.totalMs = 0;
      p.streak = 0;
      p.bestStreak = 0;
      p.voted = false;
    }
    this.clearBots();
    this.stopBots();
    this.saveHostData();
    this.publish();
  }

  rematch() {
    this.resetToLobby();
    this.startGame();
  }

  /* Jugadores */

  addBot(team = 'A') {
    if (this.state.status !== 'lobby') return;
    const total = this.state.players.length;
    if (total >= MAX_PLAYERS) return;

    const used = new Set(this.state.players.map((p) => p.nickname.toLowerCase()));
    const available = BOT_NAMES.filter((n) => !used.has(n.toLowerCase()));
    const nickname = available.length ? pick(available) : `Bot${total + 1}`;

    const player = createPlayer({
      id: uid('bot_'),
      nickname,
      team,
      avatar: pick(AVATARS),
      isBot: true,
    });
    this.state.players.push(player);
    this.publish();
  }

  addBots(perTeam = 4) {
    for (const team of ['A', 'B']) {
      const current = this.state.players.filter((p) => p.team === team).length;
      const missing = Math.max(0, perTeam - current);
      for (let i = 0; i < missing; i++) this.addBot(team);
    }
  }

  stopBots() {
    for (const timer of this.botTimers) clearTimeout(timer);
    this.botTimers = [];
  }

  clearBots() {
    this.stopBots();
    if (this.state.status === 'lobby') {
      const before = this.state.players.length;
      this.state.players = this.state.players.filter((p) => !p.isBot);
      if (this.state.players.length !== before) this.publishSoon();
    }
  }

    removePlayer(id) {
    if (this.state.status !== 'lobby') return;
    const player = this.player(id);
    this.state.players = this.state.players.filter((p) => p.id !== id);
    if (player && !player.isBot) {
      this.kicked.add(id);
      this.channel.send({ t: 'kicked', to: id });
    }
    this.publish();
  }

    movePlayer(id, team) {
    if (this.state.status !== 'lobby') return;
    const player = this.player(id);
    if (!player || player.team === team) return;
    const count = this.state.players.filter((p) => p.team === team).length;
    if (count >= MAX_PER_TEAM) {
      this.emitLocal('Ese equipo ya está lleno.');
      return;
    }
    player.team = team;
    this.publish();
  }

  player(id) {
    return this.state.players.find((p) => p.id === id);
  }

  /* Mensajes */

  onMessage(msg) {
    if (!msg || typeof msg !== 'object') return;

    switch (msg.t) {
      case 'hello':
        this.publish(true);
        break;

      case 'join':
        this.handleJoin(msg);
        break;

      case 'vote':
        this.handleVote(msg);
        break;

      case 'ping':
        this.handlePing(msg);
        break;

      case 'leave': {
        const p = this.player(msg.playerId);
        if (p) {
          p.connected = false;
          this.publishSoon();
        }
        break;
      }

      default:
        break;
    }
  }

  handleJoin(msg) {
    const id = String(msg.playerId || '').slice(0, 40);
    if (!id) return;

    if (this.kicked.has(id)) {
      this.reply(id, 'El anfitrión te sacó de la sala.');
      return;
    }

    let player = this.player(id);

    if (player) {
            player.connected = true;
      player.lastSeen = Date.now();
      if (this.state.status === 'question' && !this.state.roundPlayers.includes(player.id)) {
        this.state.roundPlayers.push(player.id);
      }
      this.publish(true);
      return;
    }

    if (this.state.status === 'results') {
      this.reply(id, 'La partida ya terminó. Pide una revancha.');
      return;
    }
    if (this.state.players.length >= MAX_PLAYERS) {
      this.reply(id, 'La sala está llena (30 jugadores).');
      return;
    }

    const nickname = String(msg.nickname || '').trim().replace(/[<>]/g, '').slice(0, 14);
    if (nickname.length < 2) {
      this.reply(id, 'El apodo necesita al menos 2 caracteres.');
      return;
    }
    const taken = this.state.players.some(
      (p) => p.id !== id && p.nickname.toLowerCase() === nickname.toLowerCase()
    );
    if (taken) {
      this.reply(id, 'Ese apodo ya está en uso. Prueba otro.');
      return;
    }

    const countA = this.state.players.filter((p) => p.team === 'A').length;
    const countB = this.state.players.filter((p) => p.team === 'B').length;
    const available = [];
    if (countA < MAX_PER_TEAM) available.push('A');
    if (countB < MAX_PER_TEAM) available.push('B');
    if (!available.length) {
      this.reply(id, 'La sala está llena.');
      return;
    }
    const team = available[Math.floor(Math.random() * available.length)];

    player = createPlayer({ id, nickname, team, avatar: msg.avatar });
    this.state.players.push(player);
    this.publish();
    this.reply(id, null, 'joined');
  }

  handlePing(msg) {
    const player = this.player(msg.playerId);
    if (!player) return;
    player.lastSeen = Date.now();
    if (!player.connected) {
      player.connected = true;
      this.publishSoon();
    }
  }

  handleVote(msg) {
    if (this.state.status !== 'question') return;
    const player = this.player(msg.playerId);
    if (!player) return;
    if (!this.state.roundPlayers.includes(player.id)) return;
    if (![0, 1, 2, 3].includes(msg.choice)) return;
    if (Number(msg.round) !== this.state.round) return;

    const ms = clamp(Date.now() - this.state.phaseStartedAt, 0, this.durationMs);
    this.votes[player.id] = { choice: msg.choice, ms };
    player.voted = true;
    this.state.voteCount = Object.keys(this.votes).length;

    this.publishSoon(1500);
    this.saveHostData();
    this.checkAllVoted();
  }

  checkAllVoted() {
    const pending = this.state.roundPlayers.filter((id) => {
      if (this.votes[id]) return false;
      const player = this.player(id);
      return player && player.connected;
    });
    const now = Date.now();
    if (pending.length === 0) {
      const target = now + PHASE_MS.allVoted;
      if (!this.state.endsAt || this.state.endsAt > target) {
        this.state.endsAt = target;
        this.publishSoon();
      }
    }
  }

  scheduleBots() {
    const bots = this.state.players.filter(
      (p) => p.isBot && this.state.roundPlayers.includes(p.id) && !this.votes[p.id]
    );
    const duration = this.durationMs || this.state.config.duration * 1000;

    for (const bot of bots) {
      const delay = Math.round(duration * (0.22 + Math.random() * 0.58));
      const timer = setTimeout(() => {
        if (this.state.status !== 'question') return;
        if (this.votes[bot.id]) return;
        const hit = Math.random() < 0.7;
        let choice = this.correctIndex;
        if (!hit) {
          const wrong = [0, 1, 2, 3].filter((i) => i !== this.correctIndex);
          choice = pick(wrong);
        }
        this.handleVote({ playerId: bot.id, choice, round: this.state.round });
      }, delay);
      this.botTimers.push(timer);
    }
  }

  /* Utilidades */

  reply(to, message, kind = 'error') {
    this.channel.send({ t: kind === 'joined' ? 'joined' : 'error', to, message });
  }

  emitLocal(message, event = null) {
    this.lastEvent = { message, event, at: Date.now() };
    if (this.onChange) this.onChange(this.state, this.lastEvent);
  }

  publish(force = false) {
    if (this.destroyed) return;
    this.state.revision += 1;
    saveSnapshot(this.state);
    this.channel.send({ t: 'state', state: this.state, now: Date.now() });
    this.lastPublish = Date.now();
    this.onChange(this.state);
  }

  publishSoon(gap = 180) {
    if (this.destroyed) return;
    const wait = gap - (Date.now() - this.lastPublish);
    if (wait <= 0) {
      this.publish();
      return;
    }
    if (this.publishTimer) return;
    this.publishTimer = setTimeout(() => {
      this.publishTimer = null;
      this.publish();
    }, wait);
  }

  saveHostData() {
    writeJSON(hostDataKey(this.code), {
      queue: this.queue,
      correctIndex: this.correctIndex,
      votes: this.votes,
      durationMs: this.durationMs,
    });
  }

  briefing() {
    const players = this.state.players;
    return {
      total: players.length,
      a: players.filter((p) => p.team === 'A').length,
      b: players.filter((p) => p.team === 'B').length,
      rankedA: rankPlayers(players.filter((p) => p.team === 'A')),
      rankedB: rankPlayers(players.filter((p) => p.team === 'B')),
    };
  }
}
