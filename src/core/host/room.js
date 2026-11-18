import { Channel, loadSnapshot, saveSnapshot, touchHost } from '../../net/bus.js';
import { buildQueue, loadBank, maxRoundsFor, MIN_ROUNDS, toPublic } from '../questions.js';
import {
  applyBonuses,
  individualPoints,
  isKnockout,
  rankPlayers,
  resolveWinner,
  SCORE,
  ropeFromScores,
  tallyRound,
  clamp,
} from '../rules.js';
import { pick, uid } from '../utils.js';
import { AVATARS, MAX_PLAYERS, MAX_PER_TEAM, PHASE_MS, BOT_NAMES } from './constants.js';
import { createPlayer, createState } from './state.js';
import { loadHostData, saveHostData as persistHostData } from './storage.js';
import { castVote, handleMessage } from './messages.js';

export class HostRoom {
  constructor(code, { onChange } = {}) {
    this.code = code;
    this.onChange = onChange || (() => {});
    this.state = loadSnapshot(code) || createState(code);

    if (this.state.teams?.A?.name === 'VERDE') this.state.teams.A.name = 'MARCIANOS';
    if (this.state.teams?.B?.name === 'MAGENTA') this.state.teams.B.name = 'SATURNINOS';

    const stored = loadHostData(code);
    this.queue = stored?.queue || [];
    this.correctIndex = stored?.correctIndex ?? -1;
    this.votes = stored?.votes || {};
    this.away = {};
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
    if (patch.duration) this.state.config.duration = clamp(Number(patch.duration), 12, 60);
    if (patch.rounds) {
      const max = Math.max(MIN_ROUNDS, maxRoundsFor(loadBank(), this.state.config));
      this.state.totalRounds = clamp(Number(patch.rounds), MIN_ROUNDS, max);
      this.state.config.rounds = this.state.totalRounds;
    }
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
      p.warned = false;
      p.correct = 0;
      p.answered = 0;
      p.totalMs = 0;
      p.streak = 0;
      p.bestStreak = 0;
      p.voted = false;
    }

    this.votes = {};
    this.away = {};
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
    this.durationMs = this.state.config.duration * 1000;
    this.state.question = toPublic(question);
    this.correctIndex = question.correct;
    this.votes = {};
    this.away = {};
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

    const tallyVotes = {};
    for (const [id, v] of Object.entries(this.votes)) {
      tallyVotes[id] = v.away ? { ...v, ms: duration } : v;
    }
    
    const result = applyBonuses(
      tallyRound({
        votes: tallyVotes,
        players: participants,
        correctIndex: this.correctIndex,
        durationMs: duration,
      }),
      this.state.teams
    );

    const individuals = {};
    for (const p of participants) {
      const vote = this.votes[p.id];
      if (!vote) {
        p.streak = 0;
        continue;
      }
      const correct = vote.choice === this.correctIndex;
      const flagged = Boolean(vote.away);
      const points = individualPoints({
        correct,
        ms: flagged ? duration : vote.ms,
        durationMs: duration,
      });
      p.score += points;
      let penalty = 0;
      let warning = false;
      if (flagged) {
        if (p.warned) {
          penalty = Math.min(SCORE.awayPenalty, p.score);
          p.score -= penalty;
        } else {
          p.warned = true;
          warning = true;
        }
      }
      p.answered += 1;
      p.totalMs += vote.ms;
      if (correct) {
        p.correct += 1;
        p.streak += 1;
        p.bestStreak = Math.max(p.bestStreak, p.streak);
      } else {
        p.streak = 0;
      }
        individuals[p.id] = { choice: vote.choice, correct, ms: vote.ms, points, penalty, away: flagged, warning };
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

  resetToLobby() {
    this.state.status = 'lobby';
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
    this.away = {};
    this.queue = [];
    this.correctIndex = -1;
    for (const team of ['A', 'B']) {
      this.state.teams[team].score = 0;
      this.state.teams[team].correct = 0;
      this.state.teams[team].streak = 0;
    }
    for (const p of this.state.players) {
      p.score = 0;
      p.warned = false;
      p.correct = 0;
      p.answered = 0;
      p.totalMs = 0;
      p.streak = 0;
      p.bestStreak = 0;
      p.voted = false;
    }
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

  addBots(count = 4) {
    if (this.state.status !== 'lobby') return 0;
    const slots = Math.max(0, MAX_PLAYERS - this.state.players.length);
    const total = Math.min(Math.max(0, Math.floor(Number(count) || 0)), slots);

    for (let i = 0; i < total; i++) {
      const a = this.state.players.filter((p) => p.team === 'A').length;
      const b = this.state.players.filter((p) => p.team === 'B').length;
      let team;
      if (a < b) team = 'A';
      else if (b < a) team = 'B';
      else team = Math.random() < 0.5 ? 'A' : 'B';
      this.addBot(team);
    }

    return total;
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
    handleMessage(this, msg);
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
        castVote(this, { playerId: bot.id, choice, round: this.state.round });
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
    persistHostData(this.code, {
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
