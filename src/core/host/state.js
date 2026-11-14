import { pick } from '../utils.js';
import { AVATARS } from './constants.js';

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

export function createPlayer({ id, nickname, team, avatar, isBot = false }) {
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
