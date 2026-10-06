const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/logic.js');

const day = (y, m, d, h = 10) => new Date(y, m - 1, d, h).getTime();

function workout(id, startedAt, exercises) {
  return {
    id,
    name: 'W',
    startedAt,
    endedAt: startedAt + 60 * 60 * 1000,
    exercises: Object.entries(exercises).map(([exerciseId, sets]) => ({
      exerciseId,
      sets: sets.map(([weight, reps, done = true]) => ({ weight, reps, done })),
    })),
  };
}

test('unit conversion round-trips', () => {
  assert.equal(L.formatWeight(L.toKg(225, 'lb'), 'lb'), '225');
  assert.equal(L.formatWeight(100, 'kg'), '100');
  assert.equal(L.formatWeight(100, 'lb'), '220.5');
});

test('estimate1RM uses Epley and handles edge cases', () => {
  assert.equal(L.estimate1RM(100, 1), 100);
  assert.equal(L.estimate1RM(100, 10), 100 * (1 + 10 / 30));
  assert.equal(L.estimate1RM(0, 10), 0);
  assert.equal(L.estimate1RM(100, 0), 0);
});

test('volume only counts completed sets', () => {
  const w = workout('a', day(2026, 1, 5), { bench: [[100, 5], [100, 5, false], [100, 0]] });
  assert.equal(L.completedSets(w).length, 1);
  assert.equal(L.workoutVolume(w), 500);
});

test('exerciseSessions are oldest first with per-session bests', () => {
  const later = workout('b', day(2026, 1, 8), { bench: [[105, 5], [110, 3]] });
  const earlier = workout('a', day(2026, 1, 5), { bench: [[100, 5]], squat: [[140, 5]] });
  const sessions = L.exerciseSessions([later, earlier], 'bench');
  assert.deepEqual(sessions.map((s) => s.workoutId), ['a', 'b']);
  assert.equal(sessions[1].topWeight, 110);
  assert.equal(sessions[1].volume, 105 * 5 + 110 * 3);
  assert.equal(sessions[1].best1RM, L.estimate1RM(105, 5));
});

test('lastPerformance returns the most recent sets', () => {
  const a = workout('a', day(2026, 1, 5), { bench: [[100, 5]] });
  const b = workout('b', day(2026, 1, 8), { bench: [[105, 5], [105, 4]] });
  assert.deepEqual(L.lastPerformance([b, a], 'bench').map((s) => s.reps), [5, 4]);
  assert.deepEqual(L.lastPerformance([a], 'squat'), []);
});

test('detectPRs ignores first-ever sessions and flags improvements', () => {
  const first = workout('a', day(2026, 1, 5), { bench: [[100, 5]], pullup: [[0, 8]] });
  assert.deepEqual(L.detectPRs([], first), []);

  const second = workout('b', day(2026, 1, 8), { bench: [[105, 5]], pullup: [[0, 10]], squat: [[140, 5]] });
  const prs = L.detectPRs([first], second);
  assert.deepEqual(
    prs.map((p) => p.exerciseId + ':' + p.type).sort(),
    ['bench:e1rm', 'bench:weight', 'pullup:reps']
  );

  const same = workout('c', day(2026, 1, 10), { bench: [[105, 5]] });
  assert.deepEqual(L.detectPRs([first, second], same), []);
});

test('detectPRs only compares against earlier workouts', () => {
  const past = workout('a', day(2026, 1, 5), { bench: [[100, 5]] });
  const future = workout('z', day(2026, 2, 5), { bench: [[200, 5]] });
  const current = workout('b', day(2026, 1, 8), { bench: [[105, 5]] });
  assert.equal(L.detectPRs([past, future], current).length, 2);
});

test('startOfWeek is Monday at midnight', () => {
  // 2026-10-07 is a Wednesday.
  const start = L.startOfWeek(new Date(2026, 9, 7, 15));
  assert.equal(start.getDay(), 1);
  assert.equal(start.getDate(), 5);
  assert.equal(start.getHours(), 0);
  // Sunday belongs to the week that started the previous Monday.
  assert.equal(L.startOfWeek(new Date(2026, 9, 11, 9)).getDate(), 5);
});

test('weekStats counts only this week', () => {
  const now = new Date(2026, 9, 7, 12);
  const ws = [
    workout('a', day(2026, 10, 5), { bench: [[100, 5]] }),
    workout('b', day(2026, 10, 4), { bench: [[100, 5]] }),
  ];
  const stats = L.weekStats(ws, now);
  assert.equal(stats.count, 1);
  assert.equal(stats.volume, 500);
  assert.equal(stats.minutes, 60);
});

test('weekStreak counts consecutive weeks and tolerates an empty current week', () => {
  const now = new Date(2026, 9, 7, 12); // Wed in week of Oct 5
  const ws = [
    workout('a', day(2026, 9, 29), {}), // week of Sep 28
    workout('b', day(2026, 9, 22), {}), // week of Sep 21
    workout('c', day(2026, 9, 8), {}), // gap before this one
  ];
  assert.equal(L.weekStreak(ws, now), 2);
  assert.equal(L.weekStreak(ws.concat(workout('d', day(2026, 10, 6), {})), now), 3);
  assert.equal(L.weekStreak([], now), 0);
});

test('formatDuration', () => {
  assert.equal(L.formatDuration(0), '0:00');
  assert.equal(L.formatDuration(65 * 1000), '1:05');
  assert.equal(L.formatDuration((3600 + 125) * 1000), '1:02:05');
});

test('iso dates round-trip in local time', () => {
  const ts = L.parseIsoDate('2026-03-08');
  assert.equal(L.isoDate(ts), '2026-03-08');
});
