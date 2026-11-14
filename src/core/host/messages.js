import { clamp } from '../utils.js';
import { createPlayer } from './state.js';
import { MAX_PLAYERS, MAX_PER_TEAM, PHASE_MS } from './constants.js';

export function handleMessage(host, msg) {
  if (!msg || typeof msg !== 'object') return;

  switch (msg.t) {
    case 'hello':
      host.publish(true);
      break;

    case 'join':
      handleJoin(host, msg);
      break;

    case 'vote':
      castVote(host, msg);
      break;

    case 'ping':
      handlePing(host, msg);
      break;

    case 'leave': {
      const p = host.player(msg.playerId);
      if (p) {
        p.connected = false;
        host.publishSoon();
      }
      break;
    }

    default:
      break;
  }
}

export function handleJoin(host, msg) {
  const id = String(msg.playerId || '').slice(0, 40);
  if (!id) return;

  if (host.kicked.has(id)) {
    host.reply(id, 'El anfitrión te sacó de la sala.');
    return;
  }

  let player = host.player(id);

  if (player) {
    player.connected = true;
    player.lastSeen = Date.now();
    if (host.state.status === 'question' && !host.state.roundPlayers.includes(player.id)) {
      host.state.roundPlayers.push(player.id);
    }
    host.publish(true);
    return;
  }

  if (host.state.status === 'results') {
    host.reply(id, 'La partida ya terminó. Pide una revancha.');
    return;
  }
  if (host.state.players.length >= MAX_PLAYERS) {
    host.reply(id, 'La sala está llena (30 jugadores).');
    return;
  }

  const nickname = String(msg.nickname || '').trim().replace(/[<>]/g, '').slice(0, 14);
  if (nickname.length < 2) {
    host.reply(id, 'El apodo necesita al menos 2 caracteres.');
    return;
  }
  const taken = host.state.players.some(
    (p) => p.id !== id && p.nickname.toLowerCase() === nickname.toLowerCase()
  );
  if (taken) {
    host.reply(id, 'Ese apodo ya está en uso. Prueba otro.');
    return;
  }

  const countA = host.state.players.filter((p) => p.team === 'A').length;
  const countB = host.state.players.filter((p) => p.team === 'B').length;
  const available = [];
  if (countA < MAX_PER_TEAM) available.push('A');
  if (countB < MAX_PER_TEAM) available.push('B');
  if (!available.length) {
    host.reply(id, 'La sala está llena.');
    return;
  }
  const team = available[Math.floor(Math.random() * available.length)];

  player = createPlayer({ id, nickname, team, avatar: msg.avatar });
  host.state.players.push(player);
  host.publish();
  host.reply(id, null, 'joined');
}

export function handlePing(host, msg) {
  const player = host.player(msg.playerId);
  if (!player) return;
  player.lastSeen = Date.now();
  if (!player.connected) {
    player.connected = true;
    host.publishSoon();
  }
}

export function castVote(host, msg) {
  if (host.state.status !== 'question') return;
  const player = host.player(msg.playerId);
  if (!player) return;
  if (!host.state.roundPlayers.includes(player.id)) return;
  if (![0, 1, 2, 3].includes(msg.choice)) return;
  if (Number(msg.round) !== host.state.round) return;

  const ms = clamp(Date.now() - host.state.phaseStartedAt, 0, host.durationMs);
  host.votes[player.id] = { choice: msg.choice, ms };
  player.voted = true;
  host.state.voteCount = Object.keys(host.votes).length;

  host.publishSoon(1500);
  host.saveHostData();
  host.checkAllVoted();
}
