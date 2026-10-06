/*
 * Pure workout math and data helpers. No DOM access, so it runs in the
 * browser (as window.Logic) and in Node for the unit tests.
 *
 * All weights are stored in kilograms; convert at the UI edge with
 * toKg / fromKg.
 */
(function (root) {
  'use strict';

  const KG_PER_LB = 0.45359237;
  const DAY_MS = 24 * 60 * 60 * 1000;

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function toKg(value, unit) {
    return unit === 'lb' ? value * KG_PER_LB : value;
  }

  function fromKg(kg, unit) {
    return unit === 'lb' ? kg / KG_PER_LB : kg;
  }

  // Display a stored kg value in the user's unit, at most one decimal place.
  function formatWeight(kg, unit) {
    const value = Math.round(fromKg(kg || 0, unit) * 10) / 10;
    return String(value);
  }

  // Epley formula. A single rep is the 1RM by definition.
  function estimate1RM(weight, reps) {
    if (!(weight > 0) || !(reps > 0)) return 0;
    if (reps === 1) return weight;
    return weight * (1 + reps / 30);
  }

  function isCompleted(set) {
    return Boolean(set && set.done && set.reps > 0);
  }

  function completedSets(workout) {
    const sets = [];
    for (const ex of workout.exercises || []) {
      for (const set of ex.sets || []) {
        if (isCompleted(set)) sets.push(set);
      }
    }
    return sets;
  }

  function setVolume(set) {
    return (set.weight || 0) * set.reps;
  }

  function workoutVolume(workout) {
    return completedSets(workout).reduce((sum, set) => sum + setVolume(set), 0);
  }

  function byStartAsc(a, b) {
    return a.startedAt - b.startedAt;
  }

  // One entry per workout that included the exercise, oldest first.
  function exerciseSessions(workouts, exerciseId) {
    const sessions = [];
    for (const workout of workouts.slice().sort(byStartAsc)) {
      const sets = [];
      for (const ex of workout.exercises || []) {
        if (ex.exerciseId !== exerciseId) continue;
        for (const set of ex.sets || []) {
          if (isCompleted(set)) sets.push(set);
        }
      }
      if (!sets.length) continue;
      let best1RM = 0;
      let topWeight = 0;
      let maxReps = 0;
      let volume = 0;
      for (const set of sets) {
        best1RM = Math.max(best1RM, estimate1RM(set.weight, set.reps));
        topWeight = Math.max(topWeight, set.weight || 0);
        maxReps = Math.max(maxReps, set.reps);
        volume += setVolume(set);
      }
      sessions.push({
        workoutId: workout.id,
        date: workout.startedAt,
        sets,
        best1RM,
        topWeight,
        maxReps,
        volume,
      });
    }
    return sessions;
  }

  function personalRecords(workouts, exerciseId) {
    const sessions = exerciseSessions(workouts, exerciseId);
    const records = { sessions: sessions.length, max1RM: 0, maxWeight: 0, maxReps: 0, maxVolume: 0 };
    for (const s of sessions) {
      records.max1RM = Math.max(records.max1RM, s.best1RM);
      records.maxWeight = Math.max(records.maxWeight, s.topWeight);
      records.maxReps = Math.max(records.maxReps, s.maxReps);
      records.maxVolume = Math.max(records.maxVolume, s.volume);
    }
    return records;
  }

  // Compare a just-finished workout against everything before it. The first
  // time an exercise is logged is a baseline, not a PR.
  function detectPRs(history, workout) {
    const earlier = history.filter((w) => w.id !== workout.id && w.startedAt < workout.startedAt);
    const prs = [];
    const seen = new Set();
    for (const ex of workout.exercises || []) {
      if (seen.has(ex.exerciseId)) continue;
      seen.add(ex.exerciseId);
      const prev = personalRecords(earlier, ex.exerciseId);
      if (!prev.sessions) continue;
      const cur = personalRecords([workout], ex.exerciseId);
      if (!cur.sessions) continue;
      if (cur.maxWeight > prev.maxWeight) {
        prs.push({ exerciseId: ex.exerciseId, type: 'weight', value: cur.maxWeight });
      }
      if (cur.max1RM > prev.max1RM) {
        prs.push({ exerciseId: ex.exerciseId, type: 'e1rm', value: cur.max1RM });
      }
      if (cur.maxWeight === 0 && prev.maxWeight === 0 && cur.maxReps > prev.maxReps) {
        prs.push({ exerciseId: ex.exerciseId, type: 'reps', value: cur.maxReps });
      }
    }
    return prs;
  }

  // Completed sets from the most recent workout that included the exercise.
  function lastPerformance(workouts, exerciseId) {
    const sessions = exerciseSessions(workouts, exerciseId);
    return sessions.length ? sessions[sessions.length - 1].sets : [];
  }

  // Monday 00:00 local time of the week containing `date`.
  function startOfWeek(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  }

  function dayKey(date) {
    const d = new Date(date);
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function weekStats(workouts, now) {
    const start = startOfWeek(now).getTime();
    const stats = { count: 0, volume: 0, sets: 0, minutes: 0 };
    for (const w of workouts) {
      if (w.startedAt < start) continue;
      stats.count += 1;
      stats.volume += workoutVolume(w);
      stats.sets += completedSets(w).length;
      if (w.endedAt) stats.minutes += Math.round((w.endedAt - w.startedAt) / 60000);
    }
    return stats;
  }

  // Consecutive weeks (Mon-Sun) with at least one workout. The current week
  // doesn't break the streak until it's over.
  function weekStreak(workouts, now) {
    const weeks = new Set(workouts.map((w) => dayKey(startOfWeek(w.startedAt))));
    const cursor = startOfWeek(now);
    if (!weeks.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 7);
    let streak = 0;
    while (weeks.has(dayKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 7);
    }
    return streak;
  }

  function formatDuration(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
  }

  // YYYY-MM-DD in local time.
  function isoDate(date) {
    const d = new Date(date);
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function parseIsoDate(iso) {
    const [y, m, d] = String(iso).split('-').map(Number);
    return new Date(y, m - 1, d).getTime();
  }

  const api = {
    KG_PER_LB,
    DAY_MS,
    uid,
    toKg,
    fromKg,
    formatWeight,
    estimate1RM,
    isCompleted,
    completedSets,
    workoutVolume,
    exerciseSessions,
    personalRecords,
    detectPRs,
    lastPerformance,
    startOfWeek,
    weekStats,
    weekStreak,
    formatDuration,
    isoDate,
    parseIsoDate,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.Logic = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
