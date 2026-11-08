/* Logica y reglas del juego */

export const SCORE = {
  base: 10,
  speed: 5,
  counter: 5,
  streak2: 2,
  streak3: 5,
  individualBase: 100,
  individualSpeed: 50,
  ropeMax: 100,
};

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export function majorityChoice(votes) {
  const valid = votes.filter((v) => Number.isInteger(v?.choice) && v.choice >= 0 && v.choice < 4);
  if (!valid.length) {
    return { choice: -1, count: 0, ms: 0, tied: false, votes: 0 };
  }

  const counts = [0, 0, 0, 0];
  for (const vote of valid) counts[vote.choice] += 1;

  const max = Math.max(...counts);
  const tied = counts.map((c, i) => (c === max ? i : -1)).filter((i) => i >= 0);

  let choice = tied[0];
  if (tied.length > 1) {
    let fastest = Infinity;
    for (const vote of valid) {
      if (tied.includes(vote.choice) && vote.ms < fastest) {
        fastest = vote.ms;
        choice = vote.choice;
      }
    }
  }

  const chosen = valid.filter((v) => v.choice === choice);
  const ms = Math.round(chosen.reduce((sum, v) => sum + Math.max(0, v.ms || 0), 0) / chosen.length);

  return { choice, count: max, ms, tied: tied.length > 1, votes: valid.length };
}

export function tallyRound({ votes, players, correctIndex, durationMs }) {
  const result = {};

  for (const team of ['A', 'B']) {
    const roster = players.filter((p) => p.team === team);
    const teamVotes = roster.map((p) => votes[p.id]).filter(Boolean);
    const majority = majorityChoice(teamVotes);
    const correct = majority.choice === correctIndex;
    const speed = correct ? clamp(1 - majority.ms / Math.max(1, durationMs), 0, 1) : 0;

    result[team] = {
      choice: majority.choice,
      votes: majority.votes,
      voters: roster.length,
      count: majority.count,
      tied: majority.tied,
      ms: majority.ms,
      correct,
      speed,
      pull: 0,
      streak: 0,
    };
  }

  return result;
}

export function applyBonuses(result, teams) {
  const a = result.A;
  const b = result.B;

  if (a.correct && !b.correct) a.pull += SCORE.counter;
  if (b.correct && !a.correct) b.pull += SCORE.counter;

  for (const team of ['A', 'B']) {
    const r = result[team];
    if (!r.correct) {
      teams[team].streak = 0;
      continue;
    }

    r.pull += SCORE.base + Math.round(SCORE.speed * r.speed);
    const streak = (teams[team].streak || 0) + 1;
    teams[team].streak = streak;
    teams[team].correct = (teams[team].correct || 0) + 1;

    if (streak >= 3) r.pull += SCORE.streak3;
    else if (streak === 2) r.pull += SCORE.streak2;

    r.streak = streak;
  }

  return result;
}

export function individualPoints({ correct, ms, durationMs }) {
  if (!correct) return 0;
  const speed = clamp(1 - ms / Math.max(1, durationMs), 0, 1);
  return SCORE.individualBase + Math.round(SCORE.individualSpeed * speed);
}

export function ropeFromScores(scoreA, scoreB) {
  return clamp((scoreA || 0) - (scoreB || 0), -SCORE.ropeMax, SCORE.ropeMax);
}

export function isKnockout(scoreA, scoreB) {
  return Math.abs((scoreA || 0) - (scoreB || 0)) >= SCORE.ropeMax;
}

export function rankPlayers(players) {
  return players.slice().sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.correct !== a.correct) return b.correct - a.correct;
    return (a.totalMs || 0) - (b.totalMs || 0);
  });
}

export function resolveWinner(state) {
  const rope = state.rope || 0;
  const a = state.teams.A;
  const b = state.teams.B;

  if (rope > 0) return { winner: 'A', reason: 'rope' };
  if (rope < 0) return { winner: 'B', reason: 'rope' };

  if ((a.correct || 0) !== (b.correct || 0)) {
    return { winner: (a.correct || 0) > (b.correct || 0) ? 'A' : 'B', reason: 'correct' };
  }

  return { winner: null, reason: 'tie' };
}
