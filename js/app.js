(function () {
  'use strict';

  const L = window.Logic;
  const LIBRARY = window.EXERCISE_LIBRARY;
  const STORAGE_KEY = 'flyfit:v1';
  const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Glutes', 'Core'];
  const EQUIPMENT = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Kettlebell', 'Other'];
  const REST_OPTIONS = [0, 30, 60, 90, 120, 150, 180, 240, 300];
  const PR_LABELS = { weight: 'Heaviest weight', e1rm: 'Best est. 1RM', reps: 'Most reps' };

  // ---------- State & persistence ----------

  function seedRoutines() {
    const routine = (name, items) => ({
      id: L.uid(),
      name,
      exercises: items.map(([exerciseId, sets, reps]) => ({ exerciseId, sets, reps })),
    });
    return [
      routine('Push', [['bench-press', 4, 8], ['overhead-press', 3, 8], ['incline-db-press', 3, 10], ['lateral-raise', 3, 15], ['triceps-pushdown', 3, 12]]),
      routine('Pull', [['deadlift', 3, 5], ['pull-up', 3, 8], ['barbell-row', 3, 8], ['face-pull', 3, 15], ['db-curl', 3, 12]]),
      routine('Legs', [['back-squat', 4, 6], ['romanian-deadlift', 3, 8], ['leg-press', 3, 12], ['leg-curl', 3, 12], ['standing-calf-raise', 4, 15]]),
      routine('Full Body', [['back-squat', 3, 8], ['bench-press', 3, 8], ['barbell-row', 3, 8], ['hanging-leg-raise', 3, 12]]),
    ];
  }

  function defaultState() {
    return {
      version: 1,
      settings: { name: '', unit: 'lb', restSeconds: 90 },
      customExercises: [],
      routines: seedRoutines(),
      workouts: [],
      bodyweight: [],
      active: null,
    };
  }

  function normalize(data) {
    const base = defaultState();
    if (!data || typeof data !== 'object') return base;
    const list = (value, fallback) => (Array.isArray(value) ? value : fallback);
    return {
      version: 1,
      settings: Object.assign(base.settings, data.settings),
      customExercises: list(data.customExercises, []),
      routines: list(data.routines, base.routines),
      workouts: list(data.workouts, []),
      bodyweight: list(data.bodyweight, []),
      active: data.active && typeof data.active === 'object' ? data.active : null,
    };
  }

  function loadState() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalize(JSON.parse(raw)) : defaultState();
    } catch (err) {
      // Keep unreadable data around instead of silently overwriting it.
      try {
        if (raw) localStorage.setItem(STORAGE_KEY + ':corrupt', raw);
      } catch (ignored) { /* storage unavailable */ }
      return defaultState();
    }
  }

  let state = loadState();

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      toast('Could not save — storage is full or blocked');
    }
  }

  // ---------- Helpers ----------

  const $ = (sel, el = document) => el.querySelector(sel);

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function allExercises() {
    return LIBRARY.concat(state.customExercises);
  }

  function exercise(id) {
    return allExercises().find((x) => x.id === id) || { id, name: 'Unknown exercise', muscle: '', equipment: '' };
  }

  function unit() {
    return state.settings.unit;
  }

  function fmtW(kg) {
    return L.formatWeight(kg, unit());
  }

  function fmtVolume(kg) {
    const v = L.fromKg(kg, unit());
    if (v >= 100000) return Math.round(v / 1000) + 'k';
    if (v >= 10000) return (v / 1000).toFixed(1) + 'k';
    return Math.round(v).toLocaleString();
  }

  function fmtDate(ts) {
    return new Date(ts).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function shortDate(ts) {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function sortedWorkouts() {
    return state.workouts.slice().sort((a, b) => b.startedAt - a.startedAt);
  }

  function parseNum(value) {
    const n = parseFloat(value);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  function navigate(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  function emptyState(title, text) {
    return `<div class="empty"><strong>${esc(title)}</strong><p>${esc(text)}</p></div>`;
  }

  let toastTimer = null;
  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
  }

  // ---------- Modal ----------

  function openModal(html) {
    $('#modal-sheet').innerHTML = html;
    $('#modal').hidden = false;
    document.body.classList.add('modal-open');
  }

  function closeModal() {
    $('#modal').hidden = true;
    $('#modal-sheet').innerHTML = '';
    document.body.classList.remove('modal-open');
  }

  function modalHead(title) {
    return `<div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-action="close-modal" aria-label="Close">✕</button></div>`;
  }

  function askText(title, value, confirmLabel, onSubmit) {
    openModal(`${modalHead(title)}
      <form id="ask-form" class="stack">
        <input name="value" value="${esc(value)}" maxlength="60" required autocomplete="off">
        <button class="btn btn-primary btn-block">${esc(confirmLabel)}</button>
      </form>`);
    const form = $('#ask-form');
    form.value.focus();
    form.value.select();
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = form.value.value.trim();
      if (!text) return;
      closeModal();
      onSubmit(text);
    });
  }

  // ---------- Exercise picker ----------

  function openExercisePicker(onPick) {
    let muscle = 'All';
    openModal(`${modalHead('Add exercise')}
      <input type="search" id="ex-search" placeholder="Search exercises" autocomplete="off">
      <div class="chips" id="ex-chips">
        ${['All'].concat(MUSCLES).map((m) => `<button class="chip${m === 'All' ? ' active' : ''}" data-muscle="${m}">${m}</button>`).join('')}
      </div>
      <div class="picker-list" id="ex-list"></div>
      <button class="btn btn-ghost btn-block" id="ex-custom">+ Create custom exercise</button>`);

    const search = $('#ex-search');
    const list = $('#ex-list');

    function draw() {
      const q = search.value.trim().toLowerCase();
      const items = allExercises()
        .filter((x) => muscle === 'All' || x.muscle === muscle)
        .filter((x) => !q || x.name.toLowerCase().includes(q) || x.equipment.toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name));
      list.innerHTML = items.length
        ? items.map((x) => `<button class="picker-item" data-id="${esc(x.id)}">
            <span>${esc(x.name)}${x.custom ? ' <em class="tag">custom</em>' : ''}</span>
            <small>${esc(x.muscle)} · ${esc(x.equipment)}</small>
          </button>`).join('')
        : `<p class="muted center">No matches. Create it as a custom exercise below.</p>`;
    }

    search.addEventListener('input', draw);
    $('#ex-chips').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      muscle = chip.dataset.muscle;
      document.querySelectorAll('#ex-chips .chip').forEach((c) => c.classList.toggle('active', c === chip));
      draw();
    });
    list.addEventListener('click', (e) => {
      const item = e.target.closest('.picker-item');
      if (!item) return;
      closeModal();
      onPick(item.dataset.id);
    });
    $('#ex-custom').addEventListener('click', () => openCustomExerciseForm(search.value.trim(), onPick));
    draw();
  }

  function openCustomExerciseForm(presetName, onCreate) {
    const options = (values) => values.map((v) => `<option>${v}</option>`).join('');
    openModal(`${modalHead('Custom exercise')}
      <form id="custom-form" class="stack">
        <label class="field">Name<input name="name" maxlength="60" required value="${esc(presetName)}" autocomplete="off"></label>
        <label class="field">Muscle group<select name="muscle">${options(MUSCLES)}</select></label>
        <label class="field">Equipment<select name="equipment">${options(EQUIPMENT)}</select></label>
        <button class="btn btn-primary btn-block">Create &amp; add</button>
      </form>`);
    const form = $('#custom-form');
    form.name.focus();
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = form.name.value.trim();
      if (!name) return;
      const item = { id: 'custom-' + L.uid(), name, muscle: form.muscle.value, equipment: form.equipment.value, custom: true };
      state.customExercises.push(item);
      save();
      closeModal();
      onCreate(item.id);
    });
  }

  // ---------- Active workout ----------

  function newSet(weight, reps) {
    return { weight: weight == null ? null : weight, reps: reps == null ? null : reps, done: false };
  }

  function defaultWorkoutName() {
    const h = new Date().getHours();
    if (h < 5) return 'Late night workout';
    if (h < 12) return 'Morning workout';
    if (h < 17) return 'Afternoon workout';
    return 'Evening workout';
  }

  function startWorkout(template) {
    if (state.active && !confirm('You already have a workout in progress. Discard it and start a new one?')) return;
    state.active = {
      id: L.uid(),
      name: template.name || defaultWorkoutName(),
      routineId: template.routineId || null,
      startedAt: Date.now(),
      exercises: template.exercises || [],
      notes: '',
    };
    stopRest(false);
    save();
    navigate('#workout');
  }

  // Pre-fill weights from the last time each exercise was done.
  function exercisesFromRoutine(routine) {
    return routine.exercises.map((item) => {
      const prev = L.lastPerformance(state.workouts, item.exerciseId);
      const sets = [];
      for (let i = 0; i < item.sets; i += 1) {
        const p = prev[i] || prev[prev.length - 1];
        sets.push(newSet(p && p.weight ? p.weight : null, item.reps));
      }
      return { exerciseId: item.exerciseId, sets };
    });
  }

  function startRoutine(id) {
    const routine = state.routines.find((r) => r.id === id);
    if (routine) startWorkout({ name: routine.name, routineId: routine.id, exercises: exercisesFromRoutine(routine) });
  }

  function addExerciseToActive(exerciseId) {
    const prev = L.lastPerformance(state.workouts, exerciseId);
    const count = Math.max(prev.length, 3);
    const sets = [];
    for (let i = 0; i < count; i += 1) {
      const p = prev[i] || prev[prev.length - 1];
      sets.push(newSet(p && p.weight ? p.weight : null, p ? p.reps : null));
    }
    state.active.exercises.push({ exerciseId, sets });
    save();
    render();
    const blocks = document.querySelectorAll('.exercise-block');
    if (blocks.length) blocks[blocks.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function activeSetFrom(el) {
    const row = el.closest('[data-ex]');
    const ex = state.active.exercises[Number(row.dataset.ex)];
    const set = row.dataset.set != null ? ex.sets[Number(row.dataset.set)] : null;
    return { row, ex, set, exIndex: Number(row.dataset.ex), setIndex: Number(row.dataset.set) };
  }

  function updateLiveStats() {
    const el = $('#live-stats');
    if (!el || !state.active) return;
    const sets = L.completedSets(state.active).length;
    el.textContent = `${sets} ${sets === 1 ? 'set' : 'sets'} · ${fmtVolume(L.workoutVolume(state.active))} ${unit()}`;
  }

  function finishWorkout() {
    const w = state.active;
    const exercises = w.exercises
      .map((ex) => ({
        exerciseId: ex.exerciseId,
        sets: ex.sets.filter(L.isCompleted).map((s) => ({ weight: s.weight || 0, reps: s.reps, done: true })),
      }))
      .filter((ex) => ex.sets.length);

    if (!exercises.length) {
      if (confirm('No sets are checked off yet. Discard this workout?')) discardWorkout();
      return;
    }
    const total = w.exercises.reduce((n, ex) => n + ex.sets.length, 0);
    const unchecked = total - exercises.reduce((n, ex) => n + ex.sets.length, 0);
    if (unchecked && !confirm(`${unchecked} unchecked ${unchecked === 1 ? 'set' : 'sets'} won't be saved. Finish anyway?`)) return;

    const done = {
      id: w.id,
      name: (w.name || '').trim() || 'Workout',
      routineId: w.routineId,
      startedAt: w.startedAt,
      endedAt: Date.now(),
      exercises,
      notes: (w.notes || '').trim(),
    };
    done.prs = L.detectPRs(state.workouts, done);
    state.workouts.push(done);
    state.active = null;
    stopRest(false);
    save();
    navigate('#history/' + done.id);
    showSummary(done);
  }

  function discardWorkout() {
    state.active = null;
    stopRest(false);
    save();
    navigate('#home');
  }

  function showSummary(w) {
    const sets = L.completedSets(w).length;
    openModal(`${modalHead('Workout complete')}
      <p class="summary-name">${esc(w.name)}</p>
      <div class="stats">
        ${statCard('Time', L.formatDuration(w.endedAt - w.startedAt), '')}
        ${statCard('Volume', fmtVolume(L.workoutVolume(w)), unit())}
        ${statCard('Sets', sets, '')}
      </div>
      ${w.prs.length ? `<h4 class="section-title">New personal records</h4>${prList(w.prs)}` : '<p class="muted center">Logged. Consistency is the whole game.</p>'}
      <button class="btn btn-primary btn-block" data-action="close-modal">Done</button>`);
  }

  function prList(prs) {
    return `<ul class="pr-list">${prs.map((pr) => `<li><span class="trophy" aria-hidden="true">🏆</span>
      <span><strong>${esc(exercise(pr.exerciseId).name)}</strong><small>${PR_LABELS[pr.type]}: ${pr.type === 'reps' ? pr.value + ' reps' : fmtW(pr.value) + ' ' + unit()}</small></span></li>`).join('')}</ul>`;
  }

  // ---------- Rest timer ----------

  let restTick = null;
  let audioCtx = null;

  function primeAudio() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (err) { audioCtx = null; }
  }

  function beep() {
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    if (!audioCtx) return;
    [0, 0.25].forEach((offset) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.25, audioCtx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + offset + 0.2);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(audioCtx.currentTime + offset);
      osc.stop(audioCtx.currentTime + offset + 0.2);
    });
  }

  function startRest() {
    const seconds = Number(state.settings.restSeconds);
    if (!state.active || !(seconds > 0)) return;
    primeAudio();
    state.active.restEndAt = Date.now() + seconds * 1000;
    state.active.restDuration = seconds * 1000;
    save();
    runRest();
  }

  function runRest() {
    clearInterval(restTick);
    const bar = $('#rest-bar');
    if (!state.active || !state.active.restEndAt) {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;
    const tick = () => {
      const a = state.active;
      const left = a && a.restEndAt ? a.restEndAt - Date.now() : 0;
      if (left <= 0) {
        stopRest(true);
        return;
      }
      $('#rest-time').textContent = L.formatDuration(Math.ceil(left / 1000) * 1000);
      $('#rest-fill').style.width = Math.min(100, (left / a.restDuration) * 100) + '%';
    };
    tick();
    restTick = setInterval(tick, 250);
  }

  function stopRest(finished) {
    clearInterval(restTick);
    restTick = null;
    $('#rest-bar').hidden = true;
    if (state.active && state.active.restEndAt) {
      delete state.active.restEndAt;
      delete state.active.restDuration;
      save();
    }
    if (finished) {
      beep();
      toast('Rest over — next set');
    }
  }

  function adjustRest(seconds) {
    const a = state.active;
    if (!a || !a.restEndAt) return;
    a.restEndAt += seconds * 1000;
    a.restDuration = Math.max(a.restDuration + seconds * 1000, a.restEndAt - Date.now(), 1000);
    save();
    runRest();
  }

  // ---------- Charts ----------

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function axisLabel(v, range) {
    if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1) + 'k';
    return range < 10 ? v.toFixed(1) : String(Math.round(v));
  }

  function drawChart(canvas, points) {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const accent = cssVar('--accent');
    const muted = cssVar('--muted');
    const grid = cssVar('--line');
    ctx.font = '11px system-ui, -apple-system, sans-serif';

    if (!points.length) {
      ctx.fillStyle = muted;
      ctx.textAlign = 'center';
      ctx.fillText('No data yet', w / 2, h / 2);
      return;
    }

    const pad = { l: 42, r: 14, t: 14, b: 24 };
    const ys = points.map((p) => p.y);
    const dataMin = Math.min(...ys);
    let min = dataMin;
    let max = Math.max(...ys);
    if (min === max) { min -= 1; max += 1; }
    const span = max - min;
    min -= span * 0.12;
    max += span * 0.12;
    if (min < 0 && dataMin >= 0) min = 0;

    const x0 = points[0].x;
    const x1 = points[points.length - 1].x;
    const innerW = w - pad.l - pad.r;
    const innerH = h - pad.t - pad.b;
    const X = (x) => (x1 === x0 ? pad.l + innerW / 2 : pad.l + ((x - x0) / (x1 - x0)) * innerW);
    const Y = (y) => pad.t + (1 - (y - min) / (max - min)) * innerH;

    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.fillStyle = muted;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 3; i += 1) {
      const v = min + ((max - min) * i) / 3;
      const y = Y(v);
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
      ctx.fillText(axisLabel(v, max - min), pad.l - 8, y);
    }

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = points.length > 1 ? 'left' : 'center';
    ctx.fillText(shortDate(x0), points.length > 1 ? pad.l : X(x0), h - 6);
    if (points.length > 1) {
      ctx.textAlign = 'right';
      ctx.fillText(shortDate(x1), w - pad.r, h - 6);
    }

    if (points.length > 1) {
      ctx.beginPath();
      points.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y))));
      ctx.lineTo(X(x1), pad.t + innerH);
      ctx.lineTo(X(x0), pad.t + innerH);
      ctx.closePath();
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.beginPath();
      points.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y))));
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    ctx.fillStyle = accent;
    points.forEach((p) => {
      ctx.beginPath();
      ctx.arc(X(p.x), Y(p.y), 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // ---------- Shared fragments ----------

  function statCard(label, value, sub) {
    return `<div class="stat"><span class="stat-label">${esc(label)}</span><strong class="stat-value">${esc(value)}</strong>${sub ? `<span class="stat-sub">${esc(sub)}</span>` : ''}</div>`;
  }

  function workoutCard(w) {
    const sets = L.completedSets(w).length;
    const names = w.exercises.map((ex) => exercise(ex.exerciseId).name);
    const more = names.length > 3 ? ` +${names.length - 3} more` : '';
    const prs = w.prs && w.prs.length ? `<span class="badge">🏆 ${w.prs.length} PR${w.prs.length > 1 ? 's' : ''}</span>` : '';
    return `<a class="card workout-card" href="#history/${esc(w.id)}">
      <div class="row between"><strong>${esc(w.name)}</strong><span class="muted small">${fmtDate(w.startedAt)}</span></div>
      <div class="meta">${L.formatDuration(w.endedAt - w.startedAt)} · ${fmtVolume(L.workoutVolume(w))} ${unit()} · ${sets} sets ${prs}</div>
      <div class="muted small">${esc(names.slice(0, 3).join(', ') + more)}</div>
    </a>`;
  }

  function routineSummary(r) {
    const sets = r.exercises.reduce((n, e) => n + Number(e.sets), 0);
    return `${r.exercises.length} exercises · ${sets} sets`;
  }

  function routineCard(r) {
    return `<div class="card routine-card">
      <div class="row between">
        <div>
          <strong>${esc(r.name)}</strong>
          <div class="muted small">${routineSummary(r)}</div>
        </div>
        <div class="row gap-sm">
          <a class="btn btn-small" href="#routine/${esc(r.id)}">Edit</a>
          <button class="btn btn-small btn-primary" data-action="start-routine" data-id="${esc(r.id)}">Start</button>
        </div>
      </div>
      <p class="muted small routine-list">${esc(r.exercises.map((e) => exercise(e.exerciseId).name).join(' · '))}</p>
    </div>`;
  }

  function startOptions() {
    return `<button class="btn btn-primary btn-block btn-lg" data-action="start-empty">Start empty workout</button>
      <h2 class="section-title">From a routine</h2>
      ${state.routines.length ? state.routines.map(routineCard).join('') : emptyState('No routines', 'Create one in the Routines tab.')}`;
  }

  // ---------- Views ----------

  function viewHome() {
    const now = new Date();
    const stats = L.weekStats(state.workouts, now);
    const streak = L.weekStreak(state.workouts, now);
    const h = now.getHours();
    const greeting = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    const name = state.settings.name ? ', ' + state.settings.name : '';
    const recent = sortedWorkouts().slice(0, 3);
    let line = 'Ready when you are.';
    if (stats.count) line = `${stats.count} ${stats.count === 1 ? 'session' : 'sessions'} in this week. Keep it moving.`;
    else if (streak) line = `${streak}-week streak on the line — get one in this week.`;

    return {
      title: 'FlyFit',
      html: `
        <section class="hero">
          <h2>${esc(greeting + name)}</h2>
          <p class="muted">${esc(line)}</p>
        </section>
        ${state.active ? `<a class="banner" href="#workout"><span><strong>Workout in progress</strong><small>${esc(state.active.name)} · <span data-elapsed>${L.formatDuration(Date.now() - state.active.startedAt)}</span></small></span><span>Resume →</span></a>` : ''}
        <div class="stats">
          ${statCard('This week', stats.count, stats.count === 1 ? 'workout' : 'workouts')}
          ${statCard('Volume', fmtVolume(stats.volume), unit() + ' lifted')}
          ${statCard('Streak', streak, streak === 1 ? 'week' : 'weeks')}
        </div>
        ${state.active ? '' : `<h2 class="section-title">Quick start</h2>${startOptions()}`}
        <h2 class="section-title">Recent workouts</h2>
        ${recent.length ? recent.map(workoutCard).join('') : emptyState('No workouts yet', 'Start one above — your history and progress show up here.')}`,
    };
  }

  function viewWorkout() {
    const w = state.active;
    if (!w) return { title: 'Workout', html: startOptions() };

    const blocks = w.exercises.map((ex, i) => {
      const info = exercise(ex.exerciseId);
      const prev = L.lastPerformance(state.workouts, ex.exerciseId);
      const rows = ex.sets.map((s, j) => {
        const p = prev[j];
        return `<div class="set-row${s.done ? ' done' : ''}" data-ex="${i}" data-set="${j}">
          <span class="set-num">${j + 1}</span>
          <button class="prev" data-action="copy-prev" ${p ? '' : 'disabled'} aria-label="Copy previous">${p ? `${fmtW(p.weight)}×${p.reps}` : '—'}</button>
          <input type="number" inputmode="decimal" step="any" min="0" data-field="weight" value="${s.weight == null ? '' : fmtW(s.weight)}" placeholder="${p ? fmtW(p.weight) : unit()}" aria-label="Weight in ${unit()}">
          <input type="number" inputmode="numeric" step="1" min="0" data-field="reps" value="${s.reps == null ? '' : s.reps}" placeholder="${p ? p.reps : 'reps'}" aria-label="Reps">
          <button class="check" data-action="toggle-set" aria-label="Mark set ${j + 1} complete" aria-pressed="${s.done}">✓</button>
        </div>`;
      }).join('');
      return `<section class="card exercise-block" data-ex="${i}">
        <div class="row between">
          <div><h3>${esc(info.name)}</h3><span class="muted small">${esc(info.muscle)} · ${esc(info.equipment)}</span></div>
          <button class="icon-btn" data-action="exercise-menu" aria-label="Exercise options">⋯</button>
        </div>
        <div class="set-row set-head"><span>Set</span><span>Previous</span><span>${unit()}</span><span>Reps</span><span></span></div>
        ${rows}
        <div class="row gap-sm set-actions">
          <button class="btn btn-small btn-ghost grow" data-action="add-set">+ Add set</button>
          <button class="btn btn-small btn-ghost" data-action="remove-set" ${ex.sets.length ? '' : 'disabled'}>− Remove set</button>
        </div>
      </section>`;
    }).join('');

    return {
      title: 'Workout',
      html: `
        <section class="card workout-head">
          <input class="title-input" data-field="workout-name" value="${esc(w.name)}" aria-label="Workout name" maxlength="60">
          <div class="workout-meta"><span data-elapsed>${L.formatDuration(Date.now() - w.startedAt)}</span><span id="live-stats"></span></div>
        </section>
        ${blocks || emptyState('No exercises yet', 'Add your first exercise to start logging sets.')}
        <button class="btn btn-ghost btn-block" data-action="add-exercise">+ Add exercise</button>
        <textarea class="notes" data-field="workout-notes" placeholder="Notes (how it felt, gym, anything)" rows="2">${esc(w.notes)}</textarea>
        <div class="row gap-sm finish-row">
          <button class="btn btn-danger" data-action="discard-workout">Discard</button>
          <button class="btn btn-primary grow" data-action="finish-workout">Finish workout</button>
        </div>`,
      mount: updateLiveStats,
    };
  }

  function viewRoutines() {
    return {
      title: 'Routines',
      html: `<button class="btn btn-primary btn-block" data-action="new-routine">+ New routine</button>
        ${state.routines.length ? state.routines.map(routineCard).join('') : emptyState('No routines yet', 'Routines are reusable workout templates — create one to start faster.')}`,
    };
  }

  // Routine edits happen on a draft and only persist on Save.
  let draft = null;
  let draftKey = null;

  function viewRoutineEditor(id) {
    if (draftKey !== id || !draft) {
      const existing = state.routines.find((r) => r.id === id);
      draft = existing ? JSON.parse(JSON.stringify(existing)) : { id: L.uid(), name: '', exercises: [] };
      draftKey = id;
    }
    const isNew = !state.routines.some((r) => r.id === draft.id);
    const stepper = (i, field, value) => `<div class="stepper">
        <button data-action="step" data-index="${i}" data-field-name="${field}" data-delta="-1" aria-label="Decrease ${field}">−</button>
        <span>${value}</span>
        <button data-action="step" data-index="${i}" data-field-name="${field}" data-delta="1" aria-label="Increase ${field}">+</button>
      </div>`;
    const items = draft.exercises.map((e, i) => `<div class="card routine-item">
        <div class="row between">
          <strong>${esc(exercise(e.exerciseId).name)}</strong>
          <div class="row gap-sm">
            <button class="icon-btn" data-action="routine-move" data-index="${i}" data-delta="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
            <button class="icon-btn" data-action="routine-move" data-index="${i}" data-delta="1" ${i === draft.exercises.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
            <button class="icon-btn" data-action="routine-remove" data-index="${i}" aria-label="Remove">✕</button>
          </div>
        </div>
        <div class="row gap targets">
          <label>Sets ${stepper(i, 'sets', e.sets)}</label>
          <label>Reps ${stepper(i, 'reps', e.reps)}</label>
        </div>
      </div>`).join('');

    return {
      title: isNew ? 'New routine' : 'Edit routine',
      html: `
        <input class="title-input card" data-field="routine-name" value="${esc(draft.name)}" placeholder="Routine name (e.g. Upper A)" maxlength="60">
        ${items || emptyState('No exercises', 'Add the exercises this routine should include.')}
        <button class="btn btn-ghost btn-block" data-action="routine-add-exercise">+ Add exercise</button>
        <div class="row gap-sm finish-row">
          ${isNew ? '' : '<button class="btn btn-danger" data-action="routine-delete">Delete</button>'}
          <a class="btn" href="#routines" data-action="routine-cancel">Cancel</a>
          <button class="btn btn-primary grow" data-action="routine-save">Save routine</button>
        </div>`,
    };
  }

  function viewHistory(id) {
    if (id) return viewWorkoutDetail(id);
    const workouts = sortedWorkouts();
    if (!workouts.length) {
      return { title: 'History', html: emptyState('Nothing logged yet', 'Finished workouts land here with their sets, volume and PRs.') };
    }
    let html = '';
    let month = '';
    for (const w of workouts) {
      const m = new Date(w.startedAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      if (m !== month) {
        month = m;
        html += `<h2 class="section-title">${esc(m)}</h2>`;
      }
      html += workoutCard(w);
    }
    return { title: 'History', html };
  }

  function viewWorkoutDetail(id) {
    const w = state.workouts.find((x) => x.id === id);
    if (!w) return { title: 'History', html: emptyState('Workout not found', 'It may have been deleted.') };
    const prSet = new Set((w.prs || []).map((p) => p.exerciseId));
    const blocks = w.exercises.map((ex) => {
      const info = exercise(ex.exerciseId);
      const rows = ex.sets.map((s, j) => {
        const e1rm = L.estimate1RM(s.weight, s.reps);
        return `<div class="detail-row"><span class="set-num">${j + 1}</span><span>${s.weight ? `${fmtW(s.weight)} ${unit()} × ${s.reps}` : `${s.reps} reps`}</span><span class="muted small">${e1rm ? `e1RM ${fmtW(e1rm)}` : ''}</span></div>`;
      }).join('');
      return `<section class="card">
        <div class="row between"><h3>${esc(info.name)}</h3>${prSet.has(ex.exerciseId) ? '<span class="badge">🏆 PR</span>' : ''}</div>
        ${rows}
      </section>`;
    }).join('');

    return {
      title: 'Workout',
      html: `
        <section class="hero">
          <h2>${esc(w.name)}</h2>
          <p class="muted">${new Date(w.startedAt).toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
        </section>
        <div class="stats">
          ${statCard('Time', L.formatDuration(w.endedAt - w.startedAt), '')}
          ${statCard('Volume', fmtVolume(L.workoutVolume(w)), unit())}
          ${statCard('Sets', L.completedSets(w).length, '')}
        </div>
        ${w.prs && w.prs.length ? `<section class="card">${prList(w.prs)}</section>` : ''}
        ${blocks}
        ${w.notes ? `<section class="card"><h3>Notes</h3><p class="notes-text">${esc(w.notes)}</p></section>` : ''}
        <div class="row gap-sm finish-row wrap">
          <button class="btn btn-primary grow" data-action="repeat-workout" data-id="${esc(w.id)}">Repeat workout</button>
          <button class="btn grow" data-action="save-as-routine" data-id="${esc(w.id)}">Save as routine</button>
          <button class="btn btn-danger" data-action="delete-workout" data-id="${esc(w.id)}">Delete</button>
        </div>
        <a class="back-link" href="#history">← All workouts</a>`,
    };
  }

  // Progress view selections survive re-renders within a session.
  let progressExercise = null;
  let progressMetric = null;

  const METRICS = {
    e1rm: { label: 'Est. 1RM', value: (s) => L.fromKg(s.best1RM, unit()) },
    weight: { label: 'Top weight', value: (s) => L.fromKg(s.topWeight, unit()) },
    volume: { label: 'Volume', value: (s) => L.fromKg(s.volume, unit()) },
    reps: { label: 'Best reps', value: (s) => s.maxReps },
  };

  function trainedExerciseIds() {
    const ids = [];
    for (const w of sortedWorkouts()) {
      for (const ex of w.exercises) {
        if (!ids.includes(ex.exerciseId)) ids.push(ex.exerciseId);
      }
    }
    return ids;
  }

  function viewProgress() {
    const ids = trainedExerciseIds();
    if (!ids.includes(progressExercise)) progressExercise = ids[0] || null;

    let strength = emptyState('No lifts logged yet', 'Finish a workout and your strength trends show up here.');
    let sessions = [];
    if (progressExercise) {
      const info = exercise(progressExercise);
      sessions = L.exerciseSessions(state.workouts, progressExercise);
      const records = L.personalRecords(state.workouts, progressExercise);
      const bodyweightOnly = records.maxWeight === 0;
      if (!progressMetric || (bodyweightOnly && progressMetric !== 'reps')) progressMetric = bodyweightOnly ? 'reps' : 'e1rm';
      const options = ids
        .map((id) => ({ id, name: exercise(id).name }))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((x) => `<option value="${esc(x.id)}" ${x.id === progressExercise ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
      const metricKeys = bodyweightOnly ? ['reps'] : ['e1rm', 'weight', 'volume', 'reps'];
      strength = `<section class="card">
          <select data-field="progress-exercise" aria-label="Exercise">${options}</select>
          <div class="seg" role="tablist">
            ${metricKeys.map((k) => `<button class="${k === progressMetric ? 'active' : ''}" data-action="metric" data-metric="${k}" role="tab" aria-selected="${k === progressMetric}">${METRICS[k].label}</button>`).join('')}
          </div>
          <canvas id="chart" class="chart" aria-label="${esc(info.name)} ${METRICS[progressMetric].label} over time"></canvas>
          <div class="stats">
            ${bodyweightOnly
              ? statCard('Most reps', records.maxReps, 'in one set')
              : statCard('Best e1RM', fmtW(records.max1RM), unit()) + statCard('Heaviest', fmtW(records.maxWeight), unit())}
            ${statCard('Sessions', records.sessions, '')}
          </div>
        </section>
        <h2 class="section-title">Recent sessions</h2>
        ${sessions.slice(-5).reverse().map((s) => `<a class="card session-row" href="#history/${esc(s.workoutId)}">
          <span>${fmtDate(s.date)}</span>
          <span class="muted small">${esc(s.sets.map((x) => (x.weight ? fmtW(x.weight) + '×' + x.reps : x.reps)).join(', '))}</span>
        </a>`).join('')}`;
    }

    const bw = state.bodyweight.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    const latest = bw[bw.length - 1];
    const first = bw[0];
    const change = bw.length > 1 ? L.fromKg(latest.weight - first.weight, unit()) : null;

    return {
      title: 'Progress',
      html: `
        <h2 class="section-title first">Strength</h2>
        ${strength}
        <h2 class="section-title">Body weight</h2>
        <section class="card">
          <form class="row gap-sm" data-form="bodyweight">
            <input type="number" name="weight" inputmode="decimal" step="any" min="0" placeholder="Weight (${unit()})" required aria-label="Body weight">
            <input type="date" name="date" value="${L.isoDate(Date.now())}" required aria-label="Date">
            <button class="btn btn-primary">Log</button>
          </form>
          ${bw.length ? `<div class="stats">
              ${statCard('Current', fmtW(latest.weight), unit())}
              ${change == null ? '' : statCard('Change', (change > 0 ? '+' : '') + (Math.round(change * 10) / 10), unit() + ' since ' + shortDate(L.parseIsoDate(first.date)))}
            </div>
            <canvas id="bw-chart" class="chart"></canvas>
            <ul class="bw-list">${bw.slice(-5).reverse().map((e) => `<li><span>${shortDate(L.parseIsoDate(e.date))}</span><strong>${fmtW(e.weight)} ${unit()}</strong><button class="icon-btn" data-action="delete-bodyweight" data-id="${esc(e.id)}" aria-label="Delete entry">✕</button></li>`).join('')}</ul>`
            : '<p class="muted small">Log your weight to see the trend.</p>'}
        </section>`,
      mount() {
        drawProgressCharts(sessions, bw);
      },
    };
  }

  function drawProgressCharts(sessions, bw) {
    if (progressMetric) {
      drawChart($('#chart'), sessions.map((s) => ({ x: s.date, y: METRICS[progressMetric].value(s) })));
    }
    drawChart($('#bw-chart'), bw.map((e) => ({ x: L.parseIsoDate(e.date), y: L.fromKg(e.weight, unit()) })));
  }

  function viewSettings() {
    const s = state.settings;
    return {
      title: 'Settings',
      html: `
        <section class="card stack">
          <label class="field">Your name<input data-field="setting-name" value="${esc(s.name)}" placeholder="Shown on the home screen" maxlength="40" autocomplete="given-name"></label>
          <div class="field">Units
            <div class="seg">
              <button class="${s.unit === 'lb' ? 'active' : ''}" data-action="set-unit" data-unit="lb">Pounds (lb)</button>
              <button class="${s.unit === 'kg' ? 'active' : ''}" data-action="set-unit" data-unit="kg">Kilograms (kg)</button>
            </div>
          </div>
          <label class="field">Rest timer
            <select data-field="setting-rest">
              ${REST_OPTIONS.map((v) => `<option value="${v}" ${Number(s.restSeconds) === v ? 'selected' : ''}>${v ? L.formatDuration(v * 1000) + ' after each set' : 'Off'}</option>`).join('')}
            </select>
          </label>
        </section>
        <h2 class="section-title">Your data</h2>
        <section class="card stack">
          <p class="muted small">Everything is stored on this device only. Export a backup now and then — and to move to a new phone.</p>
          <button class="btn btn-block" data-action="export">Export backup</button>
          <label class="btn btn-block">Import backup<input type="file" accept="application/json,.json" data-field="import" hidden></label>
          <button class="btn btn-danger btn-block" data-action="reset">Erase all data</button>
        </section>
        <p class="muted small center about">FlyFit · ${state.workouts.length} workouts logged</p>`,
    };
  }

  // ---------- Render ----------

  const VIEWS = {
    home: viewHome,
    workout: viewWorkout,
    routines: viewRoutines,
    routine: viewRoutineEditor,
    history: viewHistory,
    progress: viewProgress,
    settings: viewSettings,
  };

  function currentRoute() {
    const [name, id] = (location.hash.slice(1) || 'home').split('/');
    return { name: VIEWS[name] ? name : 'home', id: id ? decodeURIComponent(id) : null };
  }

  let lastRoute = null;

  function render() {
    const route = currentRoute();
    const key = route.name + '/' + route.id;
    if (route.name !== 'routine') { draft = null; draftKey = null; }
    const tab = route.name === 'routine' ? 'routines' : route.name;
    document.querySelectorAll('.tab').forEach((t) => {
      const on = t.dataset.tab === tab;
      t.classList.toggle('active', on);
      if (on) t.setAttribute('aria-current', 'page');
      else t.removeAttribute('aria-current');
    });
    const out = VIEWS[route.name](route.id);
    $('#title').textContent = out.title;
    document.title = out.title === 'FlyFit' ? 'FlyFit' : out.title + ' · FlyFit';
    const view = $('#view');
    view.innerHTML = out.html;
    if (out.mount) out.mount(view);
    if (key !== lastRoute) window.scrollTo(0, 0);
    lastRoute = key;
  }

  // ---------- Actions ----------

  const ACTIONS = {
    'close-modal': closeModal,
    'start-empty': () => startWorkout({}),
    'start-routine': (el) => startRoutine(el.dataset.id),
    'add-exercise': () => openExercisePicker(addExerciseToActive),

    'toggle-set'(el) {
      const { set } = activeSetFrom(el);
      if (set.done) {
        set.done = false;
      } else {
        const row = el.closest('.set-row');
        if (set.reps == null) set.reps = parseNum($('[data-field="reps"]', row).placeholder);
        if (set.weight == null) {
          const prevWeight = parseNum($('[data-field="weight"]', row).placeholder);
          if (prevWeight != null) set.weight = L.toKg(prevWeight, unit());
        }
        if (!(set.reps > 0)) {
          toast('Enter reps first');
          $('[data-field="reps"]', row).focus();
          return;
        }
        set.done = true;
        startRest();
      }
      save();
      render();
    },

    'copy-prev'(el) {
      const { set, ex, setIndex } = activeSetFrom(el);
      const p = L.lastPerformance(state.workouts, ex.exerciseId)[setIndex];
      if (!p) return;
      set.weight = p.weight || null;
      set.reps = p.reps;
      save();
      render();
    },

    'add-set'(el) {
      const { ex } = activeSetFrom(el);
      const last = ex.sets[ex.sets.length - 1];
      ex.sets.push(newSet(last ? last.weight : null, last ? last.reps : null));
      save();
      render();
    },

    'remove-set'(el) {
      const { ex } = activeSetFrom(el);
      ex.sets.pop();
      save();
      render();
    },

    'exercise-menu'(el) {
      const { exIndex } = activeSetFrom(el);
      const ex = state.active.exercises[exIndex];
      const last = state.active.exercises.length - 1;
      openModal(`${modalHead(exercise(ex.exerciseId).name)}
        <div class="stack" data-ex="${exIndex}">
          <button class="btn btn-block" data-action="move-exercise" data-delta="-1" ${exIndex === 0 ? 'disabled' : ''}>Move up</button>
          <button class="btn btn-block" data-action="move-exercise" data-delta="1" ${exIndex === last ? 'disabled' : ''}>Move down</button>
          <button class="btn btn-block" data-action="replace-exercise">Replace exercise</button>
          <button class="btn btn-danger btn-block" data-action="remove-exercise">Remove exercise</button>
        </div>`);
    },

    'move-exercise'(el) {
      const i = Number(el.closest('[data-ex]').dataset.ex);
      const j = i + Number(el.dataset.delta);
      const list = state.active.exercises;
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      save();
      closeModal();
      render();
    },

    'replace-exercise'(el) {
      const i = Number(el.closest('[data-ex]').dataset.ex);
      openExercisePicker((id) => {
        state.active.exercises[i].exerciseId = id;
        save();
        render();
      });
    },

    'remove-exercise'(el) {
      const i = Number(el.closest('[data-ex]').dataset.ex);
      state.active.exercises.splice(i, 1);
      save();
      closeModal();
      render();
    },

    'finish-workout': finishWorkout,
    'discard-workout'() {
      if (confirm('Discard this workout? Nothing from it will be saved.')) discardWorkout();
    },

    'rest-minus': () => adjustRest(-15),
    'rest-plus': () => adjustRest(15),
    'rest-skip': () => stopRest(false),

    'new-routine': () => navigate('#routine/new'),
    'routine-add-exercise'() {
      openExercisePicker((id) => {
        draft.exercises.push({ exerciseId: id, sets: 3, reps: 10 });
        render();
      });
    },
    step(el) {
      const item = draft.exercises[Number(el.dataset.index)];
      const field = el.dataset.fieldName;
      const max = field === 'sets' ? 20 : 100;
      item[field] = Math.min(max, Math.max(1, Number(item[field]) + Number(el.dataset.delta)));
      render();
    },
    'routine-move'(el) {
      const i = Number(el.dataset.index);
      const j = i + Number(el.dataset.delta);
      if (j < 0 || j >= draft.exercises.length) return;
      [draft.exercises[i], draft.exercises[j]] = [draft.exercises[j], draft.exercises[i]];
      render();
    },
    'routine-remove'(el) {
      draft.exercises.splice(Number(el.dataset.index), 1);
      render();
    },
    'routine-save'() {
      if (!draft.exercises.length) {
        toast('Add at least one exercise');
        return;
      }
      draft.name = draft.name.trim() || 'Untitled routine';
      const i = state.routines.findIndex((r) => r.id === draft.id);
      if (i >= 0) state.routines[i] = draft;
      else state.routines.push(draft);
      save();
      toast('Routine saved');
      navigate('#routines');
    },
    'routine-delete'() {
      if (!confirm(`Delete the "${draft.name || 'Untitled'}" routine? Past workouts are kept.`)) return;
      state.routines = state.routines.filter((r) => r.id !== draft.id);
      save();
      navigate('#routines');
    },
    'routine-cancel': () => { draft = null; draftKey = null; },

    'repeat-workout'(el) {
      const w = state.workouts.find((x) => x.id === el.dataset.id);
      if (!w) return;
      startWorkout({
        name: w.name,
        routineId: w.routineId,
        exercises: w.exercises.map((ex) => ({
          exerciseId: ex.exerciseId,
          sets: ex.sets.map((s) => newSet(s.weight || null, s.reps)),
        })),
      });
    },

    'save-as-routine'(el) {
      const w = state.workouts.find((x) => x.id === el.dataset.id);
      if (!w) return;
      askText('Save as routine', w.name, 'Save routine', (name) => {
        state.routines.push({
          id: L.uid(),
          name,
          exercises: w.exercises.map((ex) => ({ exerciseId: ex.exerciseId, sets: ex.sets.length, reps: ex.sets[0].reps })),
        });
        save();
        toast('Routine saved');
      });
    },

    'delete-workout'(el) {
      if (!confirm('Delete this workout permanently?')) return;
      state.workouts = state.workouts.filter((x) => x.id !== el.dataset.id);
      save();
      navigate('#history');
    },

    metric(el) {
      progressMetric = el.dataset.metric;
      render();
    },

    'delete-bodyweight'(el) {
      state.bodyweight = state.bodyweight.filter((e) => e.id !== el.dataset.id);
      save();
      render();
    },

    'set-unit'(el) {
      state.settings.unit = el.dataset.unit;
      save();
      render();
    },

    export() {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `flyfit-backup-${L.isoDate(Date.now())}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },

    reset() {
      if (!confirm('Erase all workouts, routines and settings on this device? This cannot be undone.')) return;
      stopRest(false);
      state = defaultState();
      save();
      toast('All data erased');
      navigate('#home');
    },
  };

  const FIELDS = {
    weight(el) {
      const { set } = activeSetFrom(el);
      const v = parseNum(el.value);
      set.weight = v == null ? null : L.toKg(v, unit());
      save();
      updateLiveStats();
    },
    reps(el) {
      const { set } = activeSetFrom(el);
      const v = parseNum(el.value);
      set.reps = v == null ? null : Math.round(v);
      if (set.done && !(set.reps > 0)) {
        set.done = false;
        el.closest('.set-row').classList.remove('done');
      }
      save();
      updateLiveStats();
    },
    'workout-name'(el) { state.active.name = el.value; save(); },
    'workout-notes'(el) { state.active.notes = el.value; save(); },
    'routine-name'(el) { draft.name = el.value; },
    'setting-name'(el) { state.settings.name = el.value.trim(); save(); },
  };

  const CHANGES = {
    'progress-exercise'(el) {
      progressExercise = el.value;
      progressMetric = null;
      render();
    },
    'setting-rest'(el) {
      state.settings.restSeconds = Number(el.value);
      save();
    },
    import(el) {
      const file = el.files && el.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!data || !Array.isArray(data.workouts)) throw new Error('not a backup');
          if (!confirm(`Replace everything on this device with this backup (${data.workouts.length} workouts)?`)) return;
          stopRest(false);
          state = normalize(data);
          save();
          toast('Backup restored');
          navigate('#home');
          runRest();
        } catch (err) {
          toast("That file isn't a FlyFit backup");
        } finally {
          el.value = '';
        }
      };
      reader.readAsText(file);
    },
  };

  const FORMS = {
    bodyweight(form) {
      const v = parseNum(form.weight.value);
      if (!(v > 0) || !form.date.value) return;
      const entry = { id: L.uid(), date: form.date.value, weight: L.toKg(v, unit()) };
      state.bodyweight = state.bodyweight.filter((e) => e.date !== entry.date).concat(entry);
      save();
      render();
      toast('Weight logged');
    },
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const action = ACTIONS[el.dataset.action];
    if (!action) return;
    if (el.tagName === 'BUTTON') e.preventDefault();
    action(el, e);
  });

  document.addEventListener('input', (e) => {
    const handler = FIELDS[e.target.dataset && e.target.dataset.field];
    if (handler) handler(e.target);
  });

  document.addEventListener('change', (e) => {
    const handler = CHANGES[e.target.dataset && e.target.dataset.field];
    if (handler) handler(e.target);
  });

  document.addEventListener('submit', (e) => {
    const handler = FORMS[e.target.dataset && e.target.dataset.form];
    if (!handler) return;
    e.preventDefault();
    handler(e.target);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#modal').hidden) closeModal();
  });

  window.addEventListener('hashchange', render);

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (currentRoute().name === 'progress') render();
    }, 150);
  });

  // Keep elapsed-time labels ticking during a workout.
  setInterval(() => {
    if (!state.active) return;
    const text = L.formatDuration(Date.now() - state.active.startedAt);
    document.querySelectorAll('[data-elapsed]').forEach((el) => { el.textContent = text; });
  }, 1000);

  // Another tab changed the data: pick it up.
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    state = loadState();
    render();
    runRest();
  });

  render();
  runRest();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
    });
  }
})();
