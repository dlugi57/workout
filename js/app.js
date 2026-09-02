(() => {
  "use strict";

  const DATA_KEY = "workoutTimerData";
  const SETTINGS_KEY = "workoutTimerSettings";
  const SESSION_KEY = "workoutTimerSession";
  const app = document.querySelector("#app");
  const toastElement = document.querySelector("#toast");
  const importInput = document.querySelector("#import-file");

  let presetWorkouts = [];
  let workouts = [];
  let settings = loadSettings();
  let currentView = "home";
  let editingId = null;
  let importMode = "all";
  let audioContext = null;
  let player = null;
  let toastTimer = null;

  function id(prefix = "id") {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
      return `${prefix}-${globalThis.crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function defaultWorkouts() {
    const sourcePresets = presetWorkouts.length ? presetWorkouts : (window.WORKOUT_TIMER_PRESETS || []);
    return JSON.parse(JSON.stringify(sourcePresets));
  }

  function loadWorkouts() {
    try {
      const saved = JSON.parse(localStorage.getItem(DATA_KEY));
      if (Array.isArray(saved) && saved.every(isValidWorkout)) {
        const normalized = saved.map(normalizeWorkout);
        enrichBuiltInWorkout(normalized);
        const existingIds = new Set(normalized.map((workout) => workout.id));
        defaultWorkouts().forEach((preset) => {
          if (!existingIds.has(preset.id)) normalized.push(normalizeWorkout(preset));
        });
        localStorage.setItem(DATA_KEY, JSON.stringify(normalized));
        return normalized;
      }
    } catch (error) {
      console.warn("Nie udało się odczytać treningów", error);
    }
    const seeded = defaultWorkouts();
    localStorage.setItem(DATA_KEY, JSON.stringify(seeded));
    return seeded;
  }

  function enrichBuiltInWorkout(items) {
    const builtIn = defaultWorkouts().find((workout) => workout.id === "dumbbell-full-body-15");
    const savedBuiltIn = items.find((workout) => workout.id === "dumbbell-full-body-15");
    if (!builtIn || !savedBuiltIn) return;
    const needsUpgrade = savedBuiltIn.exercises.some((exercise) => !exercise.muscles);
    if (!needsUpgrade) return;
    const referenceExercises = new Map(builtIn.exercises.map((exercise) => [exercise.id, exercise]));
    savedBuiltIn.exercises.forEach((exercise) => {
      const reference = referenceExercises.get(exercise.id);
      if (!reference) return;
      exercise.name = reference.name;
      exercise.description = reference.description;
      exercise.tips = reference.tips;
      exercise.muscles = reference.muscles;
      if (!exercise.weight) exercise.weight = reference.weight;
    });
  }

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      if (saved && typeof saved === "object") return { sounds: saved.sounds !== false };
    } catch (error) {
      console.warn("Nie udało się odczytać ustawień", error);
    }
    return { sounds: true };
  }

  function saveWorkouts() {
    localStorage.setItem(DATA_KEY, JSON.stringify(workouts));
    updateSaveIndicator();
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function isValidWorkout(value) {
    return Boolean(
      value && typeof value === "object" &&
      typeof value.name === "string" && value.name.trim() &&
      Array.isArray(value.exercises) &&
      value.exercises.every((exercise) => exercise && typeof exercise === "object" &&
        typeof exercise.name === "string" && exercise.name.trim() &&
        Number.isFinite(Number(exercise.duration || 0)) && Number(exercise.duration || 0) >= 0 &&
        Number.isFinite(Number(exercise.rest || 0)) && Number(exercise.rest || 0) >= 0)
    );
  }

  function normalizeWorkout(value) {
    return {
      id: String(value.id || id("workout")),
      name: String(value.name).trim(),
      description: String(value.description || ""),
      includeLastRest: value.includeLastRest === true,
      rounds: clampRounds(value.rounds),
      roundRest: clampSeconds(value.roundRest),
      exercises: value.exercises.map((exercise) => ({
        id: String(exercise.id || id("exercise")),
        name: String(exercise.name).trim(),
        mode: exercise.mode === "reps" ? "reps" : "time",
        sets: clampSets(exercise.sets),
        duration: clampSeconds(exercise.duration),
        reps: clampReps(exercise.reps),
        rest: clampSeconds(exercise.rest),
        weight: String(exercise.weight || ""),
        muscles: String(exercise.muscles || ""),
        description: String(exercise.description || ""),
        tips: String(exercise.tips || "")
      }))
    };
  }

  function isReps(exercise) {
    return exercise.mode === "reps";
  }

  // Ćwiczenia na powtórzenia nie mają twardego czasu — do sum i paska postępu
  // używamy szacunku (własny czas, albo 3 s na powtórzenie).
  function plannedSeconds(exercise) {
    if (!isReps(exercise)) return Number(exercise.duration || 0);
    if (Number(exercise.duration) > 0) return Number(exercise.duration);
    return Math.max(5, clampReps(exercise.reps) * 3);
  }

  function totalDuration(workout) {
    return buildSegments(workout).reduce((sum, segment) => sum + segment.plan, 0);
  }

  function hasEstimatedTime(workout) {
    return workout.exercises.some((exercise) => isReps(exercise) && Number(exercise.duration) <= 0);
  }

  function roundsOf(workout) {
    return clampRounds(workout.rounds);
  }

  function setsOf(exercise) {
    return clampSets(exercise.sets);
  }

  function totalSets(workout) {
    return workout.exercises.reduce((sum, exercise) => sum + setsOf(exercise), 0) * roundsOf(workout);
  }

  // Skrót w nagłówku karty ćwiczenia, np. „5 × 40 s” albo „3 × 10 powt.”.
  function describeExercise(exercise) {
    const work = isReps(exercise) ? `${clampReps(exercise.reps)} powt.` : `${clampSeconds(exercise.duration)} s`;
    const sets = setsOf(exercise);
    return sets > 1 ? `${sets} × ${work}` : work;
  }

  function formatTime(seconds) {
    const safeSeconds = Math.max(0, Math.ceil(Number(seconds) || 0));
    const minutes = Math.floor(safeSeconds / 60);
    const remainder = safeSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }

  function header() {
    return `
      <header class="topbar">
        <div class="brand" aria-label="Tempo">
          <div class="brand-mark">T.</div>
          <div class="brand-copy"><strong>TEMPO</strong><span>Twój trening. Twój rytm.</span></div>
        </div>
        <button class="sound-toggle" data-action="toggle-sound" data-enabled="${settings.sounds}" aria-pressed="${settings.sounds}">
          <span class="sound-dot"></span>Dźwięki: ${settings.sounds ? "ON" : "OFF"}
        </button>
      </header>`;
  }

  function renderHome() {
    currentView = "home";
    editingId = null;
    const cards = workouts.map((workout) => `
      <article class="workout-card">
        <h2>${escapeHtml(workout.name)}</h2>
        <p class="card-description">${escapeHtml(workout.description || "Własny trening interwałowy")}</p>
        <div class="metrics">
          <span class="metric">${workout.exercises.length} ${pluralizeExercises(workout.exercises.length)}</span>
          ${totalSets(workout) > workout.exercises.length ? `<span class="metric">${totalSets(workout)} ${pluralizeSets(totalSets(workout))}</span>` : ""}
          ${roundsOf(workout) > 1 ? `<span class="metric">${roundsOf(workout)} ${pluralizeRounds(roundsOf(workout))}</span>` : ""}
          <span class="metric">${hasEstimatedTime(workout) ? "~" : ""}${formatTime(totalDuration(workout))}</span>
        </div>
        <div class="card-actions">
          <button class="btn btn-primary" data-action="start" data-id="${escapeHtml(workout.id)}" ${workout.exercises.length ? "" : "disabled"}>Start</button>
          <button class="btn" data-action="edit" data-id="${escapeHtml(workout.id)}">Edytuj</button>
          <button class="btn" data-action="duplicate" data-id="${escapeHtml(workout.id)}">Duplikuj</button>
          <button class="btn btn-danger btn-icon" data-action="delete" data-id="${escapeHtml(workout.id)}" aria-label="Usuń trening ${escapeHtml(workout.name)}">×</button>
        </div>
        <button class="btn btn-ghost btn-small" data-action="export-one" data-id="${escapeHtml(workout.id)}" style="margin-top:10px;width:100%">Eksportuj ten trening</button>
      </article>`).join("");

    app.innerHTML = `
      <div class="container">
        ${header()}
        <section class="page-heading">
          <div>
            <p class="eyebrow">Biblioteka treningów</p>
            <h1>Gotowy na ruch?</h1>
            <p class="lead">Wybierz trening albo ułóż własny. Wszystko działa lokalnie i zostaje w tej przeglądarce.</p>
          </div>
          <button class="btn btn-primary" data-action="new">+ Nowy trening</button>
        </section>
        <div class="toolbar">
          <div class="actions"><span class="metric">${workouts.length} ${workouts.length === 1 ? "trening" : "treningi"}</span></div>
          <div class="actions">
            <button class="btn btn-ghost" data-action="import-all">Importuj</button>
            <button class="btn btn-ghost" data-action="export-all">Eksportuj wszystko</button>
          </div>
        </div>
        <main class="workout-grid">
          ${cards || `<div class="empty-state"><h2>Jeszcze pusto</h2><p>Dodaj pierwszy trening i ustaw własne interwały.</p><button class="btn btn-primary" data-action="new">+ Nowy trening</button></div>`}
        </main>
      </div>`;
  }

  function pluralizeSets(count) {
    if (count === 1) return "seria";
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return "serie";
    return "serii";
  }

  function pluralizeRounds(count) {
    if (count === 1) return "obieg";
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return "obiegi";
    return "obiegów";
  }

  function pluralizeExercises(count) {
    if (count === 1) return "ćwiczenie";
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return "ćwiczenia";
    return "ćwiczeń";
  }

  function createWorkout() {
    const workout = {
      id: id("workout"),
      name: "Nowy trening",
      description: "",
      includeLastRest: false,
      exercises: []
    };
    workouts.unshift(workout);
    saveWorkouts();
    renderEditor(workout.id);
  }

  function renderEditor(workoutId) {
    const workout = workouts.find((item) => item.id === workoutId);
    if (!workout) return renderHome();
    currentView = "editor";
    editingId = workoutId;

    const exercises = workout.exercises.map((exercise, index) => `
      <article class="exercise-card" data-exercise-card="${index}">
        <div class="exercise-summary">
          <span class="exercise-number">${index + 1}</span>
          <h3 class="exercise-name-preview">${escapeHtml(exercise.name || "Nowe ćwiczenie")}</h3>
          <span class="mode-tag">${describeExercise(exercise)}</span>
          <div class="actions">
            <button class="btn btn-icon btn-small" data-action="move-up" data-index="${index}" aria-label="Przesuń w górę" ${index === 0 ? "disabled" : ""}>↑</button>
            <button class="btn btn-icon btn-small" data-action="move-down" data-index="${index}" aria-label="Przesuń w dół" ${index === workout.exercises.length - 1 ? "disabled" : ""}>↓</button>
            <button class="btn btn-danger btn-icon btn-small" data-action="delete-exercise" data-index="${index}" aria-label="Usuń ćwiczenie">×</button>
          </div>
        </div>
        <div class="exercise-fields">
          <div class="field-grid">
            ${field("Nazwa", "name", exercise.name, index, "text", "np. Przysiad z hantlami")}
            ${modeField(exercise, index)}
            ${isReps(exercise)
              ? `${field("Powtórzenia", "reps", exercise.reps, index, "number", "12")}
                 ${field("Szacowany czas (s)", "duration", exercise.duration, index, "number", "0 = auto")}`
              : field("Czas serii (s)", "duration", exercise.duration, index, "number", "40")}
            ${field("Ilość serii", "sets", exercise.sets, index, "number", "1")}
            ${field("Przerwa (s)", "rest", exercise.rest, index, "number", "25")}
            ${field("Ciężar", "weight", exercise.weight, index, "text", "np. 2 × 8 kg")}
            ${field("Główne mięśnie", "muscles", exercise.muscles, index, "text", "np. uda, pośladki")}
            ${textareaField("Opis wykonania", "description", exercise.description, index)}
            ${textareaField("Wskazówki", "tips", exercise.tips, index)}
          </div>
        </div>
      </article>`).join("");

    app.innerHTML = `
      <div class="container editor-page">
        <header class="editor-header">
          <div class="editor-title">
            <button class="btn btn-icon" data-action="home" aria-label="Wróć do listy">←</button>
            <div><p class="eyebrow">Edycja treningu</p><h1>${escapeHtml(workout.name)}</h1></div>
          </div>
          <span id="save-indicator" class="save-indicator">Zmiany zapisują się automatycznie</span>
        </header>
        <main class="editor-layout">
          <div>
            <section class="panel">
              <div class="panel-heading"><h2>Informacje</h2></div>
              <div class="field-grid">
                <div class="field field-full"><label for="workout-name">Nazwa treningu</label><input id="workout-name" data-workout-field="name" value="${escapeHtml(workout.name)}" maxlength="100"></div>
                <div class="field field-full"><label for="workout-description">Krótki opis</label><textarea id="workout-description" data-workout-field="description" maxlength="500" placeholder="Co to za trening?">${escapeHtml(workout.description)}</textarea></div>
                <div class="field"><label for="workout-rounds">Obiegi całego treningu</label><input id="workout-rounds" type="number" min="1" max="20" step="1" inputmode="numeric" data-workout-field="rounds" value="${roundsOf(workout)}"></div>
                <div class="field"><label for="workout-round-rest">Przerwa między obiegami (s)</label><input id="workout-round-rest" type="number" min="0" max="3600" step="1" inputmode="numeric" data-workout-field="roundRest" value="${clampSeconds(workout.roundRest)}" placeholder="0 = jak zwykła przerwa"></div>
                <label class="check-row field-full"><input type="checkbox" data-workout-field="includeLastRest" ${workout.includeLastRest ? "checked" : ""}><span>Dolicz przerwę po ostatnim ćwiczeniu<small>Domyślnie trening kończy się od razu po ostatnim ćwiczeniu.</small></span></label>
              </div>
            </section>
            <section class="panel">
              <div class="panel-heading"><h2>Ćwiczenia (${workout.exercises.length})</h2><button class="btn btn-primary btn-small" data-action="add-exercise">+ Dodaj ćwiczenie</button></div>
              <div class="exercise-list">${exercises || `<div class="empty-state"><p>Dodaj pierwsze ćwiczenie do tego treningu.</p></div>`}</div>
            </section>
          </div>
          <aside class="panel bulk-panel">
            <h2>Szybkie ustawienia</h2>
            <div class="bulk-setting">
              <label for="bulk-duration">Ustaw wszystkie ćwiczenia na:</label>
              <div class="bulk-setting-row"><input id="bulk-duration" type="number" min="0" max="3600" value="40"><button class="btn btn-small" data-action="bulk-duration">Ustaw</button></div>
            </div>
            <div class="bulk-setting">
              <label for="bulk-rest">Ustaw wszystkie przerwy na:</label>
              <div class="bulk-setting-row"><input id="bulk-rest" type="number" min="0" max="3600" value="25"><button class="btn btn-small" data-action="bulk-rest">Ustaw</button></div>
            </div>
            <p class="editor-total">Łączny czas<strong id="editor-total">${formatTotal(workout)}</strong></p>
            ${roundsOf(workout) > 1 ? `<p class="bulk-hint">${roundsOf(workout)} ${pluralizeRounds(roundsOf(workout))} × ${workout.exercises.length} ${pluralizeExercises(workout.exercises.length)}</p>` : ""}
            <button class="btn btn-primary" data-action="home" style="width:100%;margin-top:18px">Gotowe</button>
            <button class="btn btn-ghost btn-small" data-action="import-one" style="width:100%;margin-top:8px">Importuj trening</button>
            <button class="btn btn-ghost btn-small" data-action="export-one" data-id="${escapeHtml(workout.id)}" style="width:100%;margin-top:8px">Eksportuj trening</button>
          </aside>
        </main>
      </div>`;
  }

  function formatTotal(workout) {
    return `${hasEstimatedTime(workout) ? "~" : ""}${formatTime(totalDuration(workout))}`;
  }

  function modeField(exercise, index) {
    return `<div class="field"><label>Typ ćwiczenia</label>
      <select data-exercise-field="mode" data-index="${index}" aria-label="Typ ćwiczenia — ćwiczenie ${index + 1}">
        <option value="time"${isReps(exercise) ? "" : " selected"}>Na czas</option>
        <option value="reps"${isReps(exercise) ? " selected" : ""}>Na powtórzenia</option>
      </select></div>`;
  }

  function field(label, name, value, index, type, placeholder) {
    const limits = { reps: [1, 999], sets: [1, 20] }[name] || [0, 3600];
    const numeric = type === "number"
      ? ` min="${limits[0]}" max="${limits[1]}" step="1" inputmode="numeric"`
      : ' maxlength="100"';
    return `<div class="field"><label>${label}</label><input type="${type}" data-exercise-field="${name}" data-index="${index}" value="${escapeHtml(value)}" placeholder="${placeholder}" aria-label="${label} — ćwiczenie ${index + 1}"${numeric}></div>`;
  }

  function textareaField(label, name, value, index) {
    return `<div class="field text-area"><label>${label}</label><textarea data-exercise-field="${name}" data-index="${index}" maxlength="1200" aria-label="${label} — ćwiczenie ${index + 1}">${escapeHtml(value)}</textarea></div>`;
  }

  function updateSaveIndicator() {
    const indicator = document.querySelector("#save-indicator");
    if (!indicator) return;
    indicator.textContent = "Zapisano";
    window.setTimeout(() => {
      if (indicator.isConnected) indicator.textContent = "Zmiany zapisują się automatycznie";
    }, 900);
  }

  function addExercise() {
    const workout = workouts.find((item) => item.id === editingId);
    if (!workout) return;
    workout.exercises.push({ id: id("exercise"), name: "Nowe ćwiczenie", mode: "time", sets: 1, duration: 40, reps: 10, rest: 25, weight: "", muscles: "", description: "", tips: "" });
    saveWorkouts();
    renderEditor(editingId);
  }

  function moveExercise(index, delta) {
    const workout = workouts.find((item) => item.id === editingId);
    const target = index + delta;
    if (!workout || target < 0 || target >= workout.exercises.length) return;
    [workout.exercises[index], workout.exercises[target]] = [workout.exercises[target], workout.exercises[index]];
    saveWorkouts();
    renderEditor(editingId);
  }

  function bulkSet(fieldName, inputId) {
    const workout = workouts.find((item) => item.id === editingId);
    const input = document.querySelector(inputId);
    if (!workout || !input) return;
    const value = clampSeconds(input.value);
    workout.exercises.forEach((exercise) => { exercise[fieldName] = value; });
    saveWorkouts();
    renderEditor(editingId);
    showToast(`Ustawiono ${value} s dla wszystkich ${fieldName === "duration" ? "ćwiczeń" : "przerw"}.`);
  }

  function clampSeconds(value) {
    return Math.min(3600, Math.max(0, Math.round(Number(value) || 0)));
  }

  function clampReps(value) {
    return Math.min(999, Math.max(1, Math.round(Number(value) || 10)));
  }

  function clampRounds(value) {
    return Math.min(20, Math.max(1, Math.round(Number(value) || 1)));
  }

  function clampSets(value) {
    return Math.min(20, Math.max(1, Math.round(Number(value) || 1)));
  }

  function duplicateWorkout(workoutId) {
    const original = workouts.find((item) => item.id === workoutId);
    if (!original) return;
    const copy = normalizeWorkout(JSON.parse(JSON.stringify(original)));
    copy.id = id("workout");
    copy.name = `${original.name} — kopia`;
    copy.exercises.forEach((exercise) => { exercise.id = id("exercise"); });
    workouts.splice(workouts.indexOf(original) + 1, 0, copy);
    saveWorkouts();
    renderHome();
    showToast("Utworzono kopię treningu.");
  }

  function deleteWorkout(workoutId) {
    const workout = workouts.find((item) => item.id === workoutId);
    if (!workout || !confirm(`Usunąć trening „${workout.name}”?`)) return;
    workouts = workouts.filter((item) => item.id !== workoutId);
    saveWorkouts();
    renderHome();
    showToast("Trening został usunięty.");
  }

  function buildSegments(workout) {
    const segments = [];
    const rounds = roundsOf(workout);
    const lastIndex = workout.exercises.length - 1;

    for (let round = 0; round < rounds; round += 1) {
      const isLastRound = round === rounds - 1;
      workout.exercises.forEach((exercise, index) => {
        const sets = setsOf(exercise);
        for (let set = 0; set < sets; set += 1) {
          segments.push({
            type: "work",
            exerciseIndex: index,
            round,
            set,
            sets,
            mode: isReps(exercise) ? "reps" : "time",
            reps: exercise.reps,
            duration: isReps(exercise) ? 0 : exercise.duration,
            plan: plannedSeconds(exercise)
          });

          // Koniec obiegu dopiero po ostatniej serii ostatniego ćwiczenia.
          const endsRound = index === lastIndex && set === sets - 1;
          if (endsRound && !isLastRound) {
            const between = workout.roundRest > 0 ? workout.roundRest : exercise.rest;
            if (between > 0) {
              segments.push({ type: "rest", exerciseIndex: index, round, set, sets, mode: "time", duration: between, plan: between, roundBreak: true });
            }
            continue;
          }
          const hasRest = exercise.rest > 0 && (!endsRound || workout.includeLastRest);
          if (hasRest) segments.push({ type: "rest", exerciseIndex: index, round, set, sets, mode: "time", duration: exercise.rest, plan: exercise.rest });
        }
      });
    }
    return segments;
  }

  function nextWorkSegment(fromPos) {
    if (!player) return null;
    for (let index = fromPos + 1; index < player.segments.length; index += 1) {
      if (player.segments[index].type === "work") return player.segments[index];
    }
    return null;
  }

  function exerciseOf(segment) {
    return player.workout.exercises[segment.exerciseIndex];
  }

  function isRepsSegment(segment) {
    return Boolean(segment) && segment.type === "work" && segment.mode === "reps";
  }

  function startPlayer(workoutId, resumeState = null) {
    const workout = workouts.find((item) => item.id === workoutId);
    if (!workout || workout.exercises.length === 0) return false;
    unlockAudio();
    keepScreenAwake().then(refreshWakeNote);
    const segments = buildSegments(workout);
    let pos = 0;
    let remainingMs = null;
    let paused = false;

    if (resumeState) {
      const round = clampRounds(resumeState.round + 1) - 1;
      const set = clampSets(resumeState.set + 1) - 1;
      const found = segments.findIndex((segment) =>
        segment.type === resumeState.phase &&
        segment.exerciseIndex === resumeState.index &&
        segment.round === round &&
        segment.set === set);
      if (found >= 0) {
        pos = found;
        paused = Boolean(resumeState.paused);
        if (isRepsSegment(segments[pos])) {
          remainingMs = 0;
        } else {
          const elapsed = paused ? 0 : Math.max(0, Date.now() - Number(resumeState.savedAt || Date.now()));
          remainingMs = Number(resumeState.remainingMs) - elapsed;
          while (remainingMs <= 0 && pos < segments.length - 1 && !isRepsSegment(segments[pos + 1])) {
            pos += 1;
            remainingMs += segments[pos].duration * 1000;
            paused = false;
          }
          if (remainingMs <= 0 && pos < segments.length - 1) {
            pos += 1;
            remainingMs = 0;
            paused = false;
          } else if (remainingMs <= 0) {
            localStorage.removeItem(SESSION_KEY);
            return false;
          }
        }
      }
    }

    player = {
      workout,
      segments,
      pos,
      endTime: null,
      remainingMs: remainingMs ?? segments[pos].duration * 1000,
      elapsedMs: 0,
      startTime: null,
      paused: resumeState ? paused : true,
      hasStarted: Boolean(resumeState),
      lastBeepSecond: null,
      lastPersistAt: 0,
      timerId: null
    };
    currentView = "player";
    if (resumeState) activateCurrentSegment(player.remainingMs, paused, true);
    else renderPlayer();
    return true;
  }

  function beginWorkout() {
    if (!player || player.hasStarted) return;
    unlockAudio();
    keepScreenAwake().then(refreshWakeNote);
    player.hasStarted = true;
    player.paused = false;
    activateCurrentSegment(player.segments[player.pos].duration * 1000, false, true);
  }

  function cancelReadyScreen() {
    if (!player || player.hasStarted) return;
    clearInterval(player.timerId);
    releaseScreenAwake();
    player = null;
    localStorage.removeItem(SESSION_KEY);
    renderHome();
  }

  function activateCurrentSegment(durationMs, paused = false, initial = false) {
    if (!player) return;
    clearInterval(player.timerId);
    const segment = player.segments[player.pos];
    const counting = isRepsSegment(segment);
    player.paused = paused;
    player.lastBeepSecond = null;
    if (counting) {
      // Seria na powtórzenia: stoper liczy w górę, użytkownik kończy przyciskiem.
      player.remainingMs = 0;
      player.elapsedMs = 0;
      player.startTime = paused ? null : Date.now();
      player.endTime = null;
    } else {
      player.remainingMs = Math.max(0, durationMs);
      player.elapsedMs = 0;
      player.startTime = null;
      player.endTime = paused ? null : Date.now() + player.remainingMs;
    }
    renderPlayer();
    updatePlayerDisplay();
    if (!paused) player.timerId = window.setInterval(updateTimer, 100);
    if (segment.type === "work" && (!initial || settings.sounds)) beep("start");
    persistSession(true);
  }

  function renderPlayer() {
    if (!player) return;
    if (!player.hasStarted) {
      renderReadyPlayer();
      return;
    }
    const segment = player.segments[player.pos];
    const exercise = exerciseOf(segment);
    const upcoming = nextWorkSegment(player.pos);
    const nextExercise = upcoming ? exerciseOf(upcoming) : null;
    const isRest = segment.type === "rest";
    const counting = isRepsSegment(segment);
    const main = isRest ? restMarkup(segment, nextExercise, upcoming) : workMarkup(exercise, segment, nextExercise, upcoming);
    const centerControl = counting
      ? `<button class="btn primary-control pause-control" data-action="reps-done">Zrobione ✓</button>`
      : `<button class="btn primary-control pause-control" data-action="pause">${player.paused ? "Wznów" : "Pauza"}</button>`;

    app.innerHTML = `
      <main class="player ${isRest ? "is-rest" : "is-work"}${counting ? " is-reps" : ""}">
        <div class="player-inner">
          <div class="player-top">
            <div><div class="player-kicker">${isRest ? (segment.roundBreak ? "Przerwa między seriami" : "Regeneracja") : "Trening w toku"}${roundBadge(segment)}</div><div class="player-title">${escapeHtml(player.workout.name)}</div><div class="wake-note">${keepAwakeLabel()}</div></div>
            <div class="player-count">Ćwiczenie ${segment.exerciseIndex + 1} z ${player.workout.exercises.length}</div>
            <div class="player-remaining"><span>Pozostało</span><strong id="total-remaining">00:00</strong></div>
          </div>
          <div class="progress-track" aria-label="Postęp całego treningu"><div id="progress-fill" class="progress-fill"></div></div>
          ${main}
          <div class="player-controls">
            <button class="btn" data-action="previous">Poprzednie</button>
            ${centerControl}
            <button class="btn" data-action="next">Następne</button>
            <button class="btn" data-action="restart">Restart</button>
            <button class="btn" data-action="toggle-sound">Dźwięk ${settings.sounds ? "ON" : "OFF"}</button>
            <button class="btn btn-danger" data-action="finish">Zakończ</button>
          </div>
        </div>
      </main>`;
  }

  function roundBadge(segment) {
    const rounds = roundsOf(player.workout);
    const badges = [];
    if (rounds > 1) badges.push(`<span class="round-pill">Obieg ${segment.round + 1}/${rounds}</span>`);
    if (segment.sets > 1) badges.push(`<span class="round-pill">Seria ${segment.set + 1}/${segment.sets}</span>`);
    return badges.length ? ` ${badges.join(" ")}` : "";
  }

  function renderReadyPlayer() {
    const firstExercise = player.workout.exercises[0];
    const nextExercise = player.workout.exercises[1] || null;
    const rounds = roundsOf(player.workout);
    const firstIsReps = isReps(firstExercise);
    const estimated = hasEstimatedTime(player.workout);
    app.innerHTML = `
      <main class="player is-ready">
        <div class="player-inner">
          <div class="player-top">
            <div><div class="player-kicker">Gotowy do startu${rounds > 1 ? ` <span class="round-pill">Seria 1/${rounds}</span>` : ""}</div><div class="player-title">${escapeHtml(player.workout.name)}</div><div class="wake-note">${keepAwakeLabel()}</div></div>
            <div class="player-count">Ćwiczenie 1 z ${player.workout.exercises.length}</div>
            <div class="player-remaining"><span>Cały trening</span><strong>${estimated ? "~" : ""}${formatTime(totalDuration(player.workout))}</strong></div>
          </div>
          <div class="progress-track" aria-label="Postęp całego treningu"><div class="progress-fill" style="width:0"></div></div>
          <section class="player-main">
            <div class="focus-block">
              <div class="phase-label">Pierwsze ćwiczenie</div>
              <h1 class="current-name">${escapeHtml(firstExercise.name)}</h1>
              <button class="timer timer-button ready-timer${firstIsReps ? " reps-timer" : ""}" data-action="begin-workout" aria-label="Rozpocznij trening">${firstIsReps ? `${firstExercise.reps}<span class="reps-unit">×</span>` : formatTime(firstExercise.duration)}</button>
              <div class="interval-meta"><span>${firstIsReps ? `${firstExercise.reps} ${pluralizeReps(firstExercise.reps)}` : `${firstExercise.duration} sekund pracy`}</span>${setsOf(firstExercise) > 1 ? `<span>${setsOf(firstExercise)} ${pluralizeSets(setsOf(firstExercise))}</span>` : ""}${rounds > 1 ? `<span>${rounds} ${pluralizeRounds(rounds)}</span>` : ""}${firstExercise.weight ? `<span>${escapeHtml(firstExercise.weight)}</span>` : ""}</div>
              <p class="next-line">Następne: <strong>${nextExercise ? escapeHtml(nextExercise.name) : "koniec treningu"}</strong></p>
            </div>
            <aside class="technique">
              <h2>Przygotuj się</h2>
              <p>${escapeHtml(firstExercise.description || "Przygotuj pozycję i rozpocznij, kiedy będziesz gotowy.")}</p>
              ${firstExercise.muscles ? `<p class="muscles"><span>Główne mięśnie</span>${escapeHtml(firstExercise.muscles)}</p>` : ""}
              ${firstExercise.tips ? `<p class="tips">${escapeHtml(firstExercise.tips)}</p>` : ""}
            </aside>
          </section>
          <div class="player-controls ready-controls">
            <button class="btn" data-action="cancel-start">Wróć</button>
            <button class="btn primary-control ready-start" data-action="begin-workout">${firstIsReps ? "Rozpocznij trening" : "Rozpocznij timer"}</button>
          </div>
        </div>
      </main>`;
  }

  function workMarkup(exercise, segment, nextExercise, upcoming) {
    const counting = isRepsSegment(segment);
    const focus = counting
      ? `<div class="phase-label">Powtórzenia</div>
          <h1 class="current-name">${escapeHtml(exercise.name)}</h1>
          <button id="interval-timer" class="timer timer-button reps-timer" data-action="reps-done" aria-label="Oznacz serię jako zrobioną">${segment.reps}<span class="reps-unit">×</span></button>
          <div class="interval-meta"><span>Wykonaj ${segment.reps} ${pluralizeReps(segment.reps)}</span><span>Czas serii <strong id="reps-elapsed">00:00</strong></span>${exercise.weight ? `<span>${escapeHtml(exercise.weight)}</span>` : ""}</div>`
      : `<div class="phase-label">Praca</div>
          <h1 class="current-name">${escapeHtml(exercise.name)}</h1>
          <button id="interval-timer" class="timer timer-button ${player.paused ? "is-paused" : ""}" data-action="pause" aria-label="${player.paused ? "Wznów timer" : "Wstrzymaj timer"}" aria-pressed="${player.paused}">00:00</button>
          <div class="interval-meta"><span>${exercise.duration} sekund pracy</span>${exercise.weight ? `<span>${escapeHtml(exercise.weight)}</span>` : ""}</div>`;
    return `
      <section class="player-main">
        <div class="focus-block">
          ${focus}
          <p class="next-line">Następne: <strong>${nextLabel(segment, upcoming, nextExercise)}</strong>${nextRoundHint(segment, upcoming)}</p>
        </div>
        <aside class="technique">
          <h2>Technika wykonania</h2>
          <p>${escapeHtml(exercise.description || "Wykonuj ćwiczenie w kontrolowanym tempie.")}</p>
          ${exercise.muscles ? `<p class="muscles"><span>Główne mięśnie</span>${escapeHtml(exercise.muscles)}</p>` : ""}
          ${exercise.tips ? `<p class="tips">${escapeHtml(exercise.tips)}</p>` : ""}
        </aside>
      </section>`;
  }

  function pluralizeReps(count) {
    if (count === 1) return "powtórzenie";
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return "powtórzenia";
    return "powtórzeń";
  }

  function nextRoundHint(segment, upcoming) {
    if (!upcoming || upcoming.round === segment.round) return "";
    return ` <span class="round-pill">Obieg ${upcoming.round + 1}/${roundsOf(player.workout)}</span>`;
  }

  function nextLabel(segment, upcoming, nextExercise) {
    if (!nextExercise) return "koniec treningu";
    if (upcoming.round === segment.round && upcoming.exerciseIndex === segment.exerciseIndex) {
      return `kolejna seria (${upcoming.set + 1}/${upcoming.sets})`;
    }
    return escapeHtml(nextExercise.name);
  }

  function restMarkup(segment, nextExercise, upcoming) {
    const endRest = !nextExercise;
    const startsNewRound = Boolean(upcoming) && upcoming.round !== segment.round;
    const sameExercise = Boolean(upcoming) && !startsNewRound && upcoming.exerciseIndex === segment.exerciseIndex;
    const phase = startsNewRound
      ? `Przerwa przed obiegiem ${upcoming.round + 1}`
      : sameExercise ? `Przerwa przed serią ${upcoming.set + 1}/${upcoming.sets}` : "Przerwa";
    return `
      <section class="player-main">
        <div class="focus-block">
          <div class="phase-label">${phase}</div>
          <h1 class="current-name">Przerwa</h1>
          <button id="interval-timer" class="timer timer-button ${player.paused ? "is-paused" : ""}" data-action="pause" aria-label="${player.paused ? "Wznów timer" : "Wstrzymaj timer"}" aria-pressed="${player.paused}">00:00</button>
          <p id="starts-in" class="starts-in">Za chwilę zaczynamy.</p>
        </div>
        <aside class="technique">
          <div class="rest-next-label">${endRest ? "Ostatnia przerwa" : startsNewRound ? "Nowy obieg — ćwiczenie 1" : sameExercise ? `Kolejna seria — ${upcoming.set + 1} z ${upcoming.sets}` : "Następne ćwiczenie"}</div>
          <h2 class="rest-next-name">${endRest ? "Koniec treningu" : escapeHtml(nextExercise.name)}</h2>
          <p class="rest-description">${endRest ? "Złap oddech. Za moment zakończymy sesję." : escapeHtml(nextExercise.description || "Przygotuj się do kolejnego ćwiczenia.")}</p>
          ${!endRest && isRepsSegment(upcoming) ? `<p class="prepare">Cel: ${upcoming.reps} ${pluralizeReps(upcoming.reps)}</p>` : ""}
          ${!endRest && nextExercise.weight ? `<p class="prepare">Przygotuj: ${escapeHtml(nextExercise.weight)}</p>` : ""}
          ${!endRest && nextExercise.muscles ? `<p class="muscles"><span>Główne mięśnie</span>${escapeHtml(nextExercise.muscles)}</p>` : ""}
          ${!endRest && nextExercise.tips ? `<p class="tips">${escapeHtml(nextExercise.tips)}</p>` : ""}
        </aside>
      </section>`;
  }

  function updateTimer() {
    if (!player || player.paused) return;
    if (isRepsSegment(player.segments[player.pos])) {
      player.elapsedMs = Math.max(0, Date.now() - player.startTime);
      updatePlayerDisplay();
      persistSession();
      return;
    }
    player.remainingMs = Math.max(0, player.endTime - Date.now());
    if (player.remainingMs <= 0) {
      advanceSegment(Math.max(0, Date.now() - player.endTime));
      return;
    }
    updatePlayerDisplay();
    persistSession();
  }

  function updatePlayerDisplay() {
    if (!player) return;
    const segment = player.segments[player.pos];
    const counting = isRepsSegment(segment);
    const timer = document.querySelector("#interval-timer");
    const stopwatch = document.querySelector("#reps-elapsed");
    const total = document.querySelector("#total-remaining");
    const progress = document.querySelector("#progress-fill");
    const startsIn = document.querySelector("#starts-in");
    const seconds = Math.ceil(player.remainingMs / 1000);
    if (timer && !counting) timer.textContent = formatTime(seconds);
    if (stopwatch) stopwatch.textContent = formatTime(Math.floor(player.elapsedMs / 1000));
    if (total) total.textContent = formatTime(totalRemainingSeconds());
    if (progress) progress.style.width = `${progressPercent()}%`;
    if (startsIn) startsIn.textContent = player.paused ? "Timer jest wstrzymany." : `Za ${seconds} ${seconds === 1 ? "sekundę" : seconds < 5 ? "sekundy" : "sekund"} zaczynamy.`;

    if (!counting && !player.paused && settings.sounds && seconds > 0 && seconds <= 3 && player.lastBeepSecond !== seconds) {
      player.lastBeepSecond = seconds;
      beep("countdown");
    }
  }

  function currentRemainingMs() {
    if (!player) return 0;
    const segment = player.segments[player.pos];
    if (!isRepsSegment(segment)) return player.remainingMs;
    return Math.max(0, segment.plan * 1000 - player.elapsedMs);
  }

  function totalRemainingSeconds() {
    if (!player) return 0;
    let totalMs = currentRemainingMs();
    for (let index = player.pos + 1; index < player.segments.length; index += 1) {
      totalMs += player.segments[index].plan * 1000;
    }
    return Math.ceil(totalMs / 1000);
  }

  function progressPercent() {
    if (!player) return 0;
    const total = player.segments.reduce((sum, segment) => sum + segment.plan * 1000, 0);
    if (total <= 0) return 100;
    let remaining = currentRemainingMs();
    for (let index = player.pos + 1; index < player.segments.length; index += 1) {
      remaining += player.segments[index].plan * 1000;
    }
    return Math.min(100, Math.max(0, ((total - remaining) / total) * 100));
  }

  function advanceSegment(overdueMs = 0) {
    if (!player) return;
    clearInterval(player.timerId);
    let nextPos = player.pos + 1;
    let elapsedDebt = Math.max(0, overdueMs);
    while (nextPos < player.segments.length) {
      // Seria na powtórzenia nigdy nie przewija się sama — czeka na użytkownika.
      if (isRepsSegment(player.segments[nextPos])) {
        player.pos = nextPos;
        activateCurrentSegment(0);
        return;
      }
      const nextDuration = player.segments[nextPos].duration * 1000;
      if (elapsedDebt < nextDuration) {
        player.pos = nextPos;
        activateCurrentSegment(nextDuration - elapsedDebt);
        return;
      }
      elapsedDebt -= nextDuration;
      nextPos += 1;
    }
    completeWorkout();
  }

  function repsDone() {
    if (!player || !isRepsSegment(player.segments[player.pos])) return;
    advanceSegment(0);
  }

  function jumpExercise(direction) {
    if (!player) return;
    const workPositions = [];
    player.segments.forEach((segment, index) => {
      if (segment.type === "work") workPositions.push(index);
    });
    const isWork = player.segments[player.pos].type === "work";
    let cursor = workPositions.findIndex((position) => position >= player.pos);
    if (cursor < 0) cursor = workPositions.length;
    const target = direction > 0 ? (isWork ? cursor + 1 : cursor) : cursor - 1;

    if (target >= workPositions.length) {
      completeWorkout();
      return;
    }
    player.pos = workPositions[Math.max(0, target)];
    activateCurrentSegment(player.segments[player.pos].duration * 1000);
  }

  function togglePause() {
    if (!player) return;
    const counting = isRepsSegment(player.segments[player.pos]);
    if (player.paused) {
      player.paused = false;
      if (counting) player.startTime = Date.now() - player.elapsedMs;
      else player.endTime = Date.now() + player.remainingMs;
      player.timerId = window.setInterval(updateTimer, 100);
    } else {
      if (counting) player.elapsedMs = Math.max(0, Date.now() - player.startTime);
      else player.remainingMs = Math.max(0, player.endTime - Date.now());
      player.paused = true;
      player.endTime = null;
      clearInterval(player.timerId);
    }
    renderPlayer();
    updatePlayerDisplay();
    persistSession(true);
  }

  function restartWorkout() {
    if (!player) return;
    player.pos = 0;
    activateCurrentSegment(player.segments[0].duration * 1000);
  }

  function finishWorkout() {
    if (!player) return;
    if (confirm("Zakończyć ten trening?")) {
      clearInterval(player.timerId);
      releaseScreenAwake();
      player = null;
      localStorage.removeItem(SESSION_KEY);
      renderHome();
    }
  }

  function completeWorkout() {
    if (!player) return;
    const completed = player.workout;
    clearInterval(player.timerId);
    releaseScreenAwake();
    player = null;
    localStorage.removeItem(SESSION_KEY);
    beep("complete");
    currentView = "complete";
    app.innerHTML = `
      <main class="complete-page">
        <section class="complete-card">
          <div class="complete-icon">✓</div>
          <p class="eyebrow">Trening ukończony</p>
          <h1>Dobra robota.</h1>
          <p>„${escapeHtml(completed.name)}” jest za Tobą.</p>
          <div class="actions"><button class="btn btn-primary" data-action="start" data-id="${escapeHtml(completed.id)}">Jeszcze raz</button><button class="btn" data-action="home">Lista treningów</button></div>
        </section>
      </main>`;
  }

  function persistSession(force = false) {
    if (!player || !player.hasStarted) return;
    const now = Date.now();
    if (!force && now - player.lastPersistAt < 500) return;
    player.lastPersistAt = now;
    const segment = player.segments[player.pos];
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      workoutId: player.workout.id,
      index: segment.exerciseIndex,
      round: segment.round,
      set: segment.set,
      phase: segment.type,
      remainingMs: player.remainingMs,
      paused: player.paused,
      savedAt: now
    }));
  }

  function tryResumeSession() {
    try {
      const saved = JSON.parse(localStorage.getItem(SESSION_KEY));
      const workoutExists = saved && workouts.some((item) => item.id === saved.workoutId);
      if (!workoutExists) {
        localStorage.removeItem(SESSION_KEY);
        return false;
      }
      if (confirm("Masz niedokończony trening. Kontynuować?")) {
        return startPlayer(saved.workoutId, saved);
      }
      localStorage.removeItem(SESSION_KEY);
    } catch (error) {
      localStorage.removeItem(SESSION_KEY);
    }
    return false;
  }

  // --- Ekran ma nie gasnąć podczas treningu -------------------------------
  // 1. Screen Wake Lock API (wymaga https lub localhost).
  // 2. Awaryjnie: ukryty filmik odtwarzany w pętli (działa też po http w LAN).
  let wakeLock = null;
  let keepAwakeVideo = null;
  let keepAwakeCanvasTimer = null;
  let keepAwakeWanted = false;

  function wakeLockSupported() {
    return "wakeLock" in navigator && typeof navigator.wakeLock.request === "function";
  }

  async function keepScreenAwake() {
    keepAwakeWanted = true;
    if (wakeLockSupported()) {
      try {
        if (!wakeLock) {
          wakeLock = await navigator.wakeLock.request("screen");
          wakeLock.addEventListener("release", () => { wakeLock = null; });
        }
        stopFallbackKeepAwake();
        return true;
      } catch (error) {
        console.warn("Wake Lock niedostępny, używam filmu zastępczego.", error);
      }
    }
    startFallbackKeepAwake();
    return false;
  }

  function releaseScreenAwake() {
    keepAwakeWanted = false;
    if (wakeLock) {
      wakeLock.release().catch(() => {});
      wakeLock = null;
    }
    stopFallbackKeepAwake();
  }

  function startFallbackKeepAwake() {
    if (keepAwakeVideo) {
      keepAwakeVideo.play().catch(() => {});
      return;
    }
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 2;
      canvas.height = 2;
      const context = canvas.getContext("2d");
      if (!context || typeof canvas.captureStream !== "function") return;

      // Strumień musi mieć nowe klatki, inaczej odtwarzanie się zatrzymuje.
      let tick = 0;
      keepAwakeCanvasTimer = window.setInterval(() => {
        tick = (tick + 1) % 2;
        context.fillStyle = tick ? "#000001" : "#000000";
        context.fillRect(0, 0, 2, 2);
      }, 1000);

      const video = document.createElement("video");
      video.srcObject = canvas.captureStream(1);
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.setAttribute("playsinline", "");
      video.setAttribute("aria-hidden", "true");
      video.style.cssText = "position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:.01;pointer-events:none;z-index:-1";
      document.body.appendChild(video);
      keepAwakeVideo = video;
      video.play().catch(() => {});
    } catch (error) {
      console.warn("Nie udało się uruchomić zastępczej blokady wygaszania.", error);
    }
  }

  function stopFallbackKeepAwake() {
    clearInterval(keepAwakeCanvasTimer);
    keepAwakeCanvasTimer = null;
    if (!keepAwakeVideo) return;
    keepAwakeVideo.pause();
    const stream = keepAwakeVideo.srcObject;
    if (stream && typeof stream.getTracks === "function") stream.getTracks().forEach((track) => track.stop());
    keepAwakeVideo.srcObject = null;
    keepAwakeVideo.remove();
    keepAwakeVideo = null;
  }

  function refreshWakeNote() {
    document.querySelectorAll(".wake-note").forEach((node) => { node.textContent = keepAwakeLabel(); });
  }

  function keepAwakeLabel() {
    if (!keepAwakeWanted) return "";
    if (wakeLock) return "Ekran nie zgaśnie";
    if (!wakeLockSupported() && !window.isSecureContext) return "Ekran: tryb zastępczy (bez https)";
    return "Ekran: tryb zastępczy";
  }

  function unlockAudio() {
    if (!settings.sounds) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === "suspended") audioContext.resume();
    } catch (error) {
      console.warn("Web Audio API jest niedostępne", error);
    }
  }

  function beep(type) {
    if (!settings.sounds) return;
    unlockAudio();
    if (!audioContext) return;
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const isStart = type === "start" || type === "complete";
    oscillator.type = isStart ? "sine" : "square";
    oscillator.frequency.setValueAtTime(type === "complete" ? 880 : isStart ? 660 : 430, now);
    if (type === "start") oscillator.frequency.exponentialRampToValueAtTime(990, now + 0.14);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (isStart ? 0.22 : 0.1));
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + (isStart ? 0.23 : 0.11));
  }

  function toggleSound() {
    settings.sounds = !settings.sounds;
    saveSettings();
    if (settings.sounds) unlockAudio();
    if (currentView === "player") renderPlayer();
    else if (currentView === "home") renderHome();
    showToast(`Dźwięki ${settings.sounds ? "włączone" : "wyłączone"}.`);
  }

  function exportData(workoutId = null) {
    const payload = workoutId
      ? { version: 1, type: "workout", workout: workouts.find((item) => item.id === workoutId) }
      : { version: 1, type: "workout-collection", exportedAt: new Date().toISOString(), workouts };
    if (workoutId && !payload.workout) return;
    const filename = workoutId ? `${safeFilename(payload.workout.name)}.json` : `tempo-treningi-${new Date().toISOString().slice(0, 10)}.json`;
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Plik JSON został przygotowany.");
  }

  function safeFilename(value) {
    return String(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "trening";
  }

  function openImport(mode) {
    importMode = mode;
    importInput.value = "";
    importInput.click();
  }

  async function handleImport(file) {
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      let incoming;
      let single = false;
      if (payload && payload.type === "workout" && isValidWorkout(payload.workout)) {
        incoming = [normalizeWorkout(payload.workout)];
        single = true;
      } else if (payload && Array.isArray(payload.workouts) && payload.workouts.length > 0 && payload.workouts.every(isValidWorkout)) {
        incoming = payload.workouts.map(normalizeWorkout);
      } else if (isValidWorkout(payload)) {
        incoming = [normalizeWorkout(payload)];
        single = true;
      } else {
        throw new Error("Nieprawidłowa struktura pliku");
      }

      if (!single && importMode === "all") {
        if (!confirm(`Plik zawiera ${incoming.length} treningów. Zastąpić obecną bibliotekę?`)) return;
        ensureUniqueIds(incoming);
        workouts = incoming;
      } else {
        ensureUniqueIds(incoming, true);
        workouts.push(...incoming);
      }
      saveWorkouts();
      renderHome();
      showToast(`Zaimportowano ${incoming.length} ${incoming.length === 1 ? "trening" : "treningi"}.`);
    } catch (error) {
      alert("Nie udało się zaimportować pliku. Sprawdź, czy zawiera poprawne dane treningu w formacie JSON.");
    }
  }

  function ensureUniqueIds(items, avoidExisting = false) {
    const usedWorkoutIds = new Set(avoidExisting ? workouts.map((item) => item.id) : []);
    const usedExerciseIds = new Set();
    items.forEach((workout) => {
      if (usedWorkoutIds.has(workout.id)) workout.id = id("workout");
      usedWorkoutIds.add(workout.id);
      workout.exercises.forEach((exercise) => {
        if (usedExerciseIds.has(exercise.id)) exercise.id = id("exercise");
        usedExerciseIds.add(exercise.id);
      });
    });
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    toastElement.textContent = message;
    toastElement.classList.add("is-visible");
    toastTimer = window.setTimeout(() => toastElement.classList.remove("is-visible"), 2400);
  }

  app.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    const workoutId = button.dataset.id;
    const index = Number(button.dataset.index);

    if (action === "home") renderHome();
    if (action === "new") createWorkout();
    if (action === "edit") renderEditor(workoutId);
    if (action === "duplicate") duplicateWorkout(workoutId);
    if (action === "delete") deleteWorkout(workoutId);
    if (action === "add-exercise") addExercise();
    if (action === "delete-exercise") {
      const workout = workouts.find((item) => item.id === editingId);
      if (workout && confirm("Usunąć to ćwiczenie?")) {
        workout.exercises.splice(index, 1);
        saveWorkouts();
        renderEditor(editingId);
      }
    }
    if (action === "move-up") moveExercise(index, -1);
    if (action === "move-down") moveExercise(index, 1);
    if (action === "bulk-duration") bulkSet("duration", "#bulk-duration");
    if (action === "bulk-rest") bulkSet("rest", "#bulk-rest");
    if (action === "start") startPlayer(workoutId);
    if (action === "begin-workout") beginWorkout();
    if (action === "cancel-start") cancelReadyScreen();
    if (action === "pause") togglePause();
    if (action === "reps-done") repsDone();
    if (action === "previous") jumpExercise(-1);
    if (action === "next") jumpExercise(1);
    if (action === "restart") restartWorkout();
    if (action === "finish") finishWorkout();
    if (action === "toggle-sound") toggleSound();
    if (action === "export-all") exportData();
    if (action === "export-one") exportData(workoutId || editingId);
    if (action === "import-all") openImport("all");
    if (action === "import-one") openImport("one");
  });

  app.addEventListener("input", (event) => {
    const workout = workouts.find((item) => item.id === editingId);
    if (!workout) return;
    const workoutField = event.target.dataset.workoutField;
    const exerciseField = event.target.dataset.exerciseField;
    if (workoutField) {
      if (workoutField === "includeLastRest") workout.includeLastRest = event.target.checked;
      else if (workoutField === "rounds") workout.rounds = clampRounds(event.target.value);
      else if (workoutField === "roundRest") workout.roundRest = clampSeconds(event.target.value);
      else workout[workoutField] = event.target.value;
      const title = document.querySelector(".editor-title h1");
      if (workoutField === "name" && title) title.textContent = event.target.value || "Bez nazwy";
    }
    if (exerciseField) {
      const exerciseIndex = Number(event.target.dataset.index);
      const exercise = workout.exercises[exerciseIndex];
      if (!exercise) return;
      if (exerciseField === "mode") {
        // Zmiana typu serii przestawia widoczne pola — trzeba przerysować kartę.
        exercise.mode = event.target.value === "reps" ? "reps" : "time";
        if (exercise.mode === "reps") exercise.reps = clampReps(exercise.reps);
        saveWorkouts();
        renderEditor(editingId);
        document.querySelector(`[data-exercise-card="${exerciseIndex}"]`)?.scrollIntoView({ block: "center" });
        return;
      }
      if (exerciseField === "reps") exercise.reps = clampReps(event.target.value);
      else if (exerciseField === "sets") exercise.sets = clampSets(event.target.value);
      else if (["duration", "rest"].includes(exerciseField)) exercise[exerciseField] = clampSeconds(event.target.value);
      else exercise[exerciseField] = event.target.value;
      if (exerciseField === "name") {
        const card = event.target.closest(".exercise-card");
        const preview = card?.querySelector(".exercise-name-preview");
        if (preview) preview.textContent = event.target.value || "Nowe ćwiczenie";
      }
      if (["duration", "reps", "sets"].includes(exerciseField)) {
        const tag = event.target.closest(".exercise-card")?.querySelector(".mode-tag");
        if (tag) tag.textContent = describeExercise(exercise);
      }
    }
    saveWorkouts();
    refreshEditorTotal(workout);
  });

  app.addEventListener("change", (event) => {
    if (event.target.matches('[data-workout-field="includeLastRest"]')) {
      const workout = workouts.find((item) => item.id === editingId);
      if (!workout) return;
      workout.includeLastRest = event.target.checked;
      saveWorkouts();
      refreshEditorTotal(workout);
    }
  });

  function refreshEditorTotal(workout) {
    const total = document.querySelector("#editor-total");
    if (total) total.textContent = formatTotal(workout);
  }

  importInput.addEventListener("change", () => handleImport(importInput.files[0]));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    // Blokada ekranu jest zwalniana przez system po minimalizacji — bierzemy ją z powrotem.
    if (keepAwakeWanted) keepScreenAwake().then(refreshWakeNote);
    if (player && !player.paused) updateTimer();
  });
  window.addEventListener("beforeunload", () => persistSession(true));

  async function bootstrap() {
    presetWorkouts = await window.WorkoutData.loadPresets();
    workouts = loadWorkouts();
    if (!tryResumeSession()) renderHome();
  }

  bootstrap().catch((error) => {
    console.error("Nie udało się uruchomić aplikacji.", error);
    app.innerHTML = `<main class="complete-page"><section class="complete-card"><h1>Nie udało się uruchomić aplikacji.</h1><p>Odśwież stronę lub sprawdź pliki w katalogu data.</p></section></main>`;
  });
})();
