(() => {
  "use strict";

  const DATA_KEY = "workoutTimerData";
  const SETTINGS_KEY = "workoutTimerSettings";
  const SESSION_KEY = "workoutTimerSession";
  const app = document.querySelector("#app");
  const toastElement = document.querySelector("#toast");
  const importInput = document.querySelector("#import-file");

  let workouts = loadWorkouts();
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
    const ex = (slug, name, description, tips, muscles, weight = "2 × 8 kg") => ({
      id: slug,
      name,
      duration: 40,
      rest: 25,
      weight,
      muscles,
      description,
      tips
    });

    return [
      {
        id: "dumbbell-full-body-15",
        name: "Hantle – Full Body 15",
        description: "15 ćwiczeń całego ciała. Równe tempo, prosta technika i 40 sekund pracy w każdej rundzie.",
        includeLastRest: false,
        exercises: [
          ex("biceps-curl", "Uginanie ramion na biceps", "Stań prosto, hantle przy biodrach. Łokcie trzymaj blisko tułowia. Zegnij ręce i podnieś hantle w stronę barków, potem powoli opuść. Nie bujaj tułowiem.", "Łokcie trzymaj blisko tułowia. Nie bujaj ciałem. Opuszczaj ciężar wolniej niż go unosisz.", "biceps"),
          ex("overhead-press", "Wyciskanie hantli nad głowę", "Hantle ustaw na wysokości barków. Napnij brzuch i wypchnij je pionowo nad głowę. Nie wyginaj mocno pleców. Wróć spokojnie do barków.", "Żebra trzymaj schowane. Nadgarstki ustaw nad łokciami. Nie zderzaj hantli nad głową.", "barki, triceps"),
          ex("front-dumbbell-squat", "Przysiad z hantlami z przodu", "Trzymaj dwa hantle przy barkach. Cofnij biodra i zejdź do przysiadu. Kolana prowadź w kierunku palców stóp. Wstań, mocno prostując biodra.", "Kolana prowadź w kierunku palców stóp. Utrzymuj długi kręgosłup. Pięty zostają na podłodze.", "uda, pośladki, brzuch", "2 × 10 kg"),
          ex("reverse-lunge", "Wykroki w tył", "Hantle trzymaj wzdłuż ciała. Zrób jedną nogą duży krok do tyłu i opuść tylne kolano w stronę podłogi. Wróć i zmień nogę.", "Przednie kolano utrzymuj nad stopą. Krok kieruj prosto w tył. Tułów pozostaje wysoki.", "pośladki, uda"),
          ex("lateral-raise", "Unoszenie hantli bokiem", "Lekko ugnij łokcie. Unieś ręce bokiem mniej więcej do wysokości barków. Opuść powoli. Tu użyj lekkich hantli.", "Prowadź ruch łokciami. Nie unoś barków do uszu. Użyj lekkiego ciężaru.", "boczna część barków", "2 × 4 kg"),
          ex("bent-over-row", "Wiosłowanie hantlami w opadzie", "Lekko ugnij kolana, wypchnij biodra do tyłu i pochyl tułów. Plecy pozostają proste. Przyciągaj hantle w stronę bioder lub żeber i ściągaj łopatki.", "Szyja pozostaje przedłużeniem kręgosłupa. Łokcie prowadź blisko ciała. Nie szarp ciężarem.", "plecy, biceps", "2 × 12 kg"),
          ex("goblet-squat", "Goblet squat", "Jeden hantel trzymaj pionowo przy klatce obiema rękami. Zejdź do przysiadu, utrzymując klatkę wysoko. Wstań, naciskając stopami mocno w podłoże.", "Trzymaj ciężar blisko ciała. Rozpychaj kolana na zewnątrz. Nie odrywaj pięt.", "uda, pośladki", "1 × 16 kg"),
          ex("arnold-press", "Arnold press", "Zacznij z hantlami przed twarzą, dłońmi skierowanymi do siebie. Podczas wyciskania obracaj ręce tak, żeby nad głową dłonie były skierowane do przodu.", "Ruch wykonuj płynnie. Napnij brzuch. Nie przeprostowuj lędźwi.", "barki, triceps", "2 × 6 kg"),
          ex("close-grip-floor-press", "Wąskie wyciskanie hantli", "Hantle trzymaj blisko siebie na wysokości klatki lub barków i wyciskaj do góry, pilnując, żeby łokcie nie uciekały szeroko.", "Łokcie prowadź blisko tułowia. Nadgarstki utrzymuj prosto. Nie unoś barków.", "triceps, barki"),
          ex("thruster", "Przysiad + wyciskanie nad głowę", "Trzymaj hantle przy barkach, wykonaj przysiad, a podczas wstawania wykorzystaj ruch nóg i wyciśnij hantle nad głowę. Połącz etapy w jeden płynny ruch.", "Najpierw rozpocznij wyprost bioder. Napnij brzuch nad głową. Zachowaj płynne tempo.", "całe ciało"),
          ex("front-raise", "Unoszenie hantli przed siebie", "Ręce trzymaj prawie proste. Unieś hantle przed siebie do wysokości barków i spokojnie opuść. Nie zarzucaj ciężaru biodrami.", "Nie odchylaj tułowia. Barki trzymaj nisko. Zakończ ruch na wysokości ramion.", "przednia część barków", "2 × 4 kg"),
          ex("curl-to-press", "Biceps + wyciskanie nad głowę", "Najpierw wykonaj klasyczne ugięcie na biceps. Gdy hantle znajdą się przy barkach, wypchnij je nad głowę. Wróć w odwrotnej kolejności.", "Nie skracaj fazy bicepsa. Ustabilizuj tułów przed wyciskaniem. Kontroluj cały powrót.", "biceps, barki, triceps", "2 × 6 kg"),
          ex("rdl", "Rumuński martwy ciąg – RDL", "Trzymaj hantle przed udami, a kolana lekko ugnij. Biodra cofaj do tyłu, prowadząc hantle blisko nóg. Zejdź mniej więcej do połowy piszczeli i wróć poprzez napięcie pośladków.", "Nie rób z tego przysiadu. Biodra kieruj mocno do tyłu. Trzymaj hantle blisko nóg i nie zaokrąglaj pleców.", "tył uda, pośladki, plecy", "2 × 12 kg"),
          ex("overhead-triceps-extension", "Prostowanie hantla zza głowy – triceps", "Jeden hantel trzymaj obiema rękami nad głową. Zegnij łokcie i opuść go za głowę. Wyprostuj ręce. Łokcie staraj się trzymać blisko głowy.", "Łokcie kieruj do przodu. Nie wyginaj pleców. Poruszaj tylko przedramionami.", "triceps", "1 × 10 kg"),
          ex("narrow-squat-curl", "Wąski przysiad + biceps", "Stopy ustaw trochę węziej niż przy normalnym przysiadzie. Zejdź w dół, wstań i wykonaj ugięcie hantli na biceps.", "Rozdziel oba ruchy. Kolana prowadź zgodnie ze stopami. Przy uginaniu nie kołysz tułowiem.", "uda, pośladki, biceps")
        ]
      },
      {
        id: "poranny-rozruch-5",
        name: "Poranny rozruch 5",
        description: "Krótka sesja bez sprzętu na dobry początek dnia.",
        includeLastRest: false,
        exercises: [
          { id: "march", name: "Marsz w miejscu", duration: 35, rest: 15, weight: "", description: "Maszeruj energicznie, unosząc kolana do komfortowej wysokości i pracując ramionami.", tips: "Stań wysoko. Oddychaj swobodnie." },
          { id: "air-squat", name: "Przysiad bez obciążenia", duration: 35, rest: 15, weight: "", description: "Cofnij biodra, ugnij kolana i zejdź do wygodnej głębokości, następnie wróć do stania.", tips: "Pięty na podłodze. Kolana prowadź nad stopami." },
          { id: "wall-pushup", name: "Pompki przy ścianie", duration: 35, rest: 15, weight: "", description: "Oprzyj dłonie o ścianę, utrzymaj ciało w jednej linii i zbliż klatkę do ściany, uginając łokcie.", tips: "Napnij brzuch. Łokcie prowadź lekko w dół." },
          { id: "good-morning", name: "Skłon biodrowy", duration: 35, rest: 15, weight: "", description: "Połóż dłonie za głową, lekko ugnij kolana i cofnij biodra, utrzymując proste plecy.", tips: "Ruch zaczyna się w biodrach. Nie zaokrąglaj pleców." },
          { id: "plank", name: "Deska", duration: 35, rest: 15, weight: "", description: "Oprzyj przedramiona i palce stóp o podłoże. Utrzymuj ciało w jednej linii od głowy do pięt.", tips: "Napnij brzuch i pośladki. Oddychaj spokojnie." }
        ]
      },
      {
        id: "szybki-core-6",
        name: "Szybki core 6",
        description: "Sześć prostych interwałów wzmacniających środek ciała.",
        includeLastRest: false,
        exercises: [
          { id: "dead-bug", name: "Dead bug", duration: 30, rest: 15, weight: "", description: "Leżąc na plecach, opuszczaj naprzemiennie przeciwną rękę i nogę, utrzymując lędźwie przy podłożu.", tips: "Ruszaj się powoli. Nie unoś lędźwi." },
          { id: "side-plank-l", name: "Deska bokiem — lewa", duration: 30, rest: 15, weight: "", description: "Oprzyj lewe przedramię, unieś biodra i utrzymuj ciało w prostej linii.", tips: "Łokieć pod barkiem. Biodra wysoko." },
          { id: "side-plank-r", name: "Deska bokiem — prawa", duration: 30, rest: 15, weight: "", description: "Oprzyj prawe przedramię, unieś biodra i utrzymuj ciało w prostej linii.", tips: "Łokieć pod barkiem. Oddychaj spokojnie." },
          { id: "bird-dog", name: "Bird dog", duration: 30, rest: 15, weight: "", description: "W klęku podpartym wyprostuj przeciwną rękę i nogę, zatrzymaj, a potem zmień stronę.", tips: "Biodra pozostają nieruchome. Sięgaj w dwie strony." },
          { id: "slow-climber", name: "Wolny mountain climber", duration: 30, rest: 15, weight: "", description: "Z pozycji deski przyciągaj naprzemiennie kolano w stronę klatki piersiowej.", tips: "Nie kołysz biodrami. Dłonie pod barkami." },
          { id: "hollow-hold", name: "Hollow hold", duration: 30, rest: 15, weight: "", description: "Leżąc na plecach, unieś łopatki i nogi, utrzymując lędźwie dociśnięte do podłoża.", tips: "Skróć dźwignię, jeśli lędźwie się odrywają." }
        ]
      }
    ];
  }

  function loadWorkouts() {
    try {
      const saved = JSON.parse(localStorage.getItem(DATA_KEY));
      if (Array.isArray(saved) && saved.every(isValidWorkout)) {
        const normalized = saved.map(normalizeWorkout);
        enrichBuiltInWorkout(normalized);
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
        Number.isFinite(Number(exercise.duration)) && Number(exercise.duration) >= 0 &&
        Number.isFinite(Number(exercise.rest)) && Number(exercise.rest) >= 0)
    );
  }

  function normalizeWorkout(value) {
    return {
      id: String(value.id || id("workout")),
      name: String(value.name).trim(),
      description: String(value.description || ""),
      includeLastRest: value.includeLastRest === true,
      exercises: value.exercises.map((exercise) => ({
        id: String(exercise.id || id("exercise")),
        name: String(exercise.name).trim(),
        duration: Math.max(0, Math.round(Number(exercise.duration))),
        rest: Math.max(0, Math.round(Number(exercise.rest))),
        weight: String(exercise.weight || ""),
        muscles: String(exercise.muscles || ""),
        description: String(exercise.description || ""),
        tips: String(exercise.tips || "")
      }))
    };
  }

  function totalDuration(workout) {
    return workout.exercises.reduce((sum, exercise, index) => {
      const countRest = index < workout.exercises.length - 1 || workout.includeLastRest;
      return sum + Number(exercise.duration || 0) + (countRest ? Number(exercise.rest || 0) : 0);
    }, 0);
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
          <span class="metric">${formatTime(totalDuration(workout))}</span>
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
          <div class="actions">
            <button class="btn btn-icon btn-small" data-action="move-up" data-index="${index}" aria-label="Przesuń w górę" ${index === 0 ? "disabled" : ""}>↑</button>
            <button class="btn btn-icon btn-small" data-action="move-down" data-index="${index}" aria-label="Przesuń w dół" ${index === workout.exercises.length - 1 ? "disabled" : ""}>↓</button>
            <button class="btn btn-danger btn-icon btn-small" data-action="delete-exercise" data-index="${index}" aria-label="Usuń ćwiczenie">×</button>
          </div>
        </div>
        <div class="exercise-fields">
          <div class="field-grid">
            ${field("Nazwa", "name", exercise.name, index, "text", "np. Przysiad z hantlami")}
            ${field("Czas ćwiczenia (s)", "duration", exercise.duration, index, "number", "40")}
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
            <p class="editor-total">Łączny czas<strong id="editor-total">${formatTime(totalDuration(workout))}</strong></p>
            <button class="btn btn-primary" data-action="home" style="width:100%;margin-top:18px">Gotowe</button>
            <button class="btn btn-ghost btn-small" data-action="import-one" style="width:100%;margin-top:8px">Importuj trening</button>
            <button class="btn btn-ghost btn-small" data-action="export-one" data-id="${escapeHtml(workout.id)}" style="width:100%;margin-top:8px">Eksportuj trening</button>
          </aside>
        </main>
      </div>`;
  }

  function field(label, name, value, index, type, placeholder) {
    const numeric = type === "number" ? ' min="0" max="3600" step="1" inputmode="numeric"' : ' maxlength="100"';
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
    workout.exercises.push({ id: id("exercise"), name: "Nowe ćwiczenie", duration: 40, rest: 25, weight: "", muscles: "", description: "", tips: "" });
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
    workout.exercises.forEach((exercise, index) => {
      segments.push({ type: "work", exerciseIndex: index, duration: exercise.duration });
      const hasRest = exercise.rest > 0 && (index < workout.exercises.length - 1 || workout.includeLastRest);
      if (hasRest) segments.push({ type: "rest", exerciseIndex: index, duration: exercise.rest });
    });
    return segments;
  }

  function startPlayer(workoutId, resumeState = null) {
    const workout = workouts.find((item) => item.id === workoutId);
    if (!workout || workout.exercises.length === 0) return false;
    unlockAudio();
    const segments = buildSegments(workout);
    let pos = 0;
    let remainingMs = null;
    let paused = false;

    if (resumeState) {
      const found = segments.findIndex((segment) => segment.type === resumeState.phase && segment.exerciseIndex === resumeState.index);
      if (found >= 0) {
        pos = found;
        const elapsed = resumeState.paused ? 0 : Math.max(0, Date.now() - Number(resumeState.savedAt || Date.now()));
        remainingMs = Number(resumeState.remainingMs) - elapsed;
        paused = Boolean(resumeState.paused);
        while (remainingMs <= 0 && pos < segments.length - 1) {
          pos += 1;
          remainingMs += segments[pos].duration * 1000;
          paused = false;
        }
        if (remainingMs <= 0 && pos === segments.length - 1) {
          localStorage.removeItem(SESSION_KEY);
          return false;
        }
      }
    }

    player = {
      workout,
      segments,
      pos,
      endTime: null,
      remainingMs: remainingMs ?? segments[pos].duration * 1000,
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
    player.hasStarted = true;
    player.paused = false;
    activateCurrentSegment(player.segments[player.pos].duration * 1000, false, true);
  }

  function cancelReadyScreen() {
    if (!player || player.hasStarted) return;
    clearInterval(player.timerId);
    player = null;
    localStorage.removeItem(SESSION_KEY);
    renderHome();
  }

  function activateCurrentSegment(durationMs, paused = false, initial = false) {
    if (!player) return;
    clearInterval(player.timerId);
    player.remainingMs = Math.max(0, durationMs);
    player.paused = paused;
    player.endTime = paused ? null : Date.now() + player.remainingMs;
    player.lastBeepSecond = null;
    renderPlayer();
    updatePlayerDisplay();
    if (!paused) player.timerId = window.setInterval(updateTimer, 100);
    const segment = player.segments[player.pos];
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
    const exercise = player.workout.exercises[segment.exerciseIndex];
    const nextExercise = player.workout.exercises[segment.exerciseIndex + 1] || null;
    const isRest = segment.type === "rest";
    const main = isRest ? restMarkup(exercise, nextExercise) : workMarkup(exercise, nextExercise);

    app.innerHTML = `
      <main class="player ${isRest ? "is-rest" : "is-work"}">
        <div class="player-inner">
          <div class="player-top">
            <div><div class="player-kicker">${isRest ? "Regeneracja" : "Trening w toku"}</div><div class="player-title">${escapeHtml(player.workout.name)}</div></div>
            <div class="player-count">Ćwiczenie ${segment.exerciseIndex + 1} z ${player.workout.exercises.length}</div>
            <div class="player-remaining"><span>Pozostało</span><strong id="total-remaining">00:00</strong></div>
          </div>
          <div class="progress-track" aria-label="Postęp całego treningu"><div id="progress-fill" class="progress-fill"></div></div>
          ${main}
          <div class="player-controls">
            <button class="btn" data-action="previous">Poprzednie</button>
            <button class="btn primary-control pause-control" data-action="pause">${player.paused ? "Wznów" : "Pauza"}</button>
            <button class="btn" data-action="next">Następne</button>
            <button class="btn" data-action="restart">Restart</button>
            <button class="btn" data-action="toggle-sound">Dźwięk ${settings.sounds ? "ON" : "OFF"}</button>
            <button class="btn btn-danger" data-action="finish">Zakończ</button>
          </div>
        </div>
      </main>`;
  }

  function renderReadyPlayer() {
    const firstExercise = player.workout.exercises[0];
    const nextExercise = player.workout.exercises[1] || null;
    app.innerHTML = `
      <main class="player is-ready">
        <div class="player-inner">
          <div class="player-top">
            <div><div class="player-kicker">Gotowy do startu</div><div class="player-title">${escapeHtml(player.workout.name)}</div></div>
            <div class="player-count">Ćwiczenie 1 z ${player.workout.exercises.length}</div>
            <div class="player-remaining"><span>Cały trening</span><strong>${formatTime(totalDuration(player.workout))}</strong></div>
          </div>
          <div class="progress-track" aria-label="Postęp całego treningu"><div class="progress-fill" style="width:0"></div></div>
          <section class="player-main">
            <div class="focus-block">
              <div class="phase-label">Pierwsze ćwiczenie</div>
              <h1 class="current-name">${escapeHtml(firstExercise.name)}</h1>
              <button class="timer timer-button ready-timer" data-action="begin-workout" aria-label="Rozpocznij timer">${formatTime(firstExercise.duration)}</button>
              <div class="interval-meta"><span>${firstExercise.duration} sekund pracy</span>${firstExercise.weight ? `<span>${escapeHtml(firstExercise.weight)}</span>` : ""}</div>
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
            <button class="btn primary-control ready-start" data-action="begin-workout">Rozpocznij timer</button>
          </div>
        </div>
      </main>`;
  }

  function workMarkup(exercise, nextExercise) {
    return `
      <section class="player-main">
        <div class="focus-block">
          <div class="phase-label">Praca</div>
          <h1 class="current-name">${escapeHtml(exercise.name)}</h1>
          <button id="interval-timer" class="timer timer-button ${player.paused ? "is-paused" : ""}" data-action="pause" aria-label="${player.paused ? "Wznów timer" : "Wstrzymaj timer"}" aria-pressed="${player.paused}">00:00</button>
          <div class="interval-meta"><span>${exercise.duration} sekund pracy</span>${exercise.weight ? `<span>${escapeHtml(exercise.weight)}</span>` : ""}</div>
          <p class="next-line">Następne: <strong>${nextExercise ? escapeHtml(nextExercise.name) : "koniec treningu"}</strong></p>
        </div>
        <aside class="technique">
          <h2>Technika wykonania</h2>
          <p>${escapeHtml(exercise.description || "Wykonuj ćwiczenie w kontrolowanym tempie.")}</p>
          ${exercise.muscles ? `<p class="muscles"><span>Główne mięśnie</span>${escapeHtml(exercise.muscles)}</p>` : ""}
          ${exercise.tips ? `<p class="tips">${escapeHtml(exercise.tips)}</p>` : ""}
        </aside>
      </section>`;
  }

  function restMarkup(previousExercise, nextExercise) {
    const endRest = !nextExercise;
    return `
      <section class="player-main">
        <div class="focus-block">
          <div class="phase-label">Przerwa</div>
          <h1 class="current-name">Przerwa</h1>
          <button id="interval-timer" class="timer timer-button ${player.paused ? "is-paused" : ""}" data-action="pause" aria-label="${player.paused ? "Wznów timer" : "Wstrzymaj timer"}" aria-pressed="${player.paused}">00:00</button>
          <p id="starts-in" class="starts-in">Za chwilę zaczynamy.</p>
        </div>
        <aside class="technique">
          <div class="rest-next-label">${endRest ? "Ostatnia przerwa" : "Następne ćwiczenie"}</div>
          <h2 class="rest-next-name">${endRest ? "Koniec treningu" : escapeHtml(nextExercise.name)}</h2>
          <p class="rest-description">${endRest ? "Złap oddech. Za moment zakończymy sesję." : escapeHtml(nextExercise.description || "Przygotuj się do kolejnego ćwiczenia.")}</p>
          ${!endRest && nextExercise.weight ? `<p class="prepare">Przygotuj: ${escapeHtml(nextExercise.weight)}</p>` : ""}
          ${!endRest && nextExercise.muscles ? `<p class="muscles"><span>Główne mięśnie</span>${escapeHtml(nextExercise.muscles)}</p>` : ""}
          ${!endRest && nextExercise.tips ? `<p class="tips">${escapeHtml(nextExercise.tips)}</p>` : ""}
        </aside>
      </section>`;
  }

  function updateTimer() {
    if (!player || player.paused) return;
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
    const timer = document.querySelector("#interval-timer");
    const total = document.querySelector("#total-remaining");
    const progress = document.querySelector("#progress-fill");
    const startsIn = document.querySelector("#starts-in");
    const seconds = Math.ceil(player.remainingMs / 1000);
    if (timer) timer.textContent = formatTime(seconds);
    if (total) total.textContent = formatTime(totalRemainingSeconds());
    if (progress) progress.style.width = `${progressPercent()}%`;
    if (startsIn) startsIn.textContent = player.paused ? "Timer jest wstrzymany." : `Za ${seconds} ${seconds === 1 ? "sekundę" : seconds < 5 ? "sekundy" : "sekund"} zaczynamy.`;

    if (!player.paused && settings.sounds && seconds > 0 && seconds <= 3 && player.lastBeepSecond !== seconds) {
      player.lastBeepSecond = seconds;
      beep("countdown");
    }
  }

  function totalRemainingSeconds() {
    if (!player) return 0;
    let totalMs = player.remainingMs;
    for (let index = player.pos + 1; index < player.segments.length; index += 1) {
      totalMs += player.segments[index].duration * 1000;
    }
    return Math.ceil(totalMs / 1000);
  }

  function progressPercent() {
    if (!player) return 0;
    const total = player.segments.reduce((sum, segment) => sum + segment.duration * 1000, 0);
    if (total <= 0) return 100;
    let remaining = player.remainingMs;
    for (let index = player.pos + 1; index < player.segments.length; index += 1) {
      remaining += player.segments[index].duration * 1000;
    }
    return Math.min(100, Math.max(0, ((total - remaining) / total) * 100));
  }

  function advanceSegment(overdueMs = 0) {
    if (!player) return;
    clearInterval(player.timerId);
    let nextPos = player.pos + 1;
    let elapsedDebt = Math.max(0, overdueMs);
    while (nextPos < player.segments.length) {
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

  function jumpExercise(direction) {
    if (!player) return;
    const segment = player.segments[player.pos];
    let targetIndex;
    if (segment.type === "rest") targetIndex = direction > 0 ? segment.exerciseIndex + 1 : segment.exerciseIndex;
    else targetIndex = segment.exerciseIndex + direction;
    targetIndex = Math.max(0, Math.min(player.workout.exercises.length - 1, targetIndex));
    const targetPos = player.segments.findIndex((item) => item.type === "work" && item.exerciseIndex === targetIndex);
    if (targetPos < 0 || (targetPos === player.pos && direction > 0 && targetIndex === player.workout.exercises.length - 1)) {
      if (direction > 0) completeWorkout();
      return;
    }
    player.pos = targetPos;
    activateCurrentSegment(player.segments[targetPos].duration * 1000);
  }

  function togglePause() {
    if (!player) return;
    if (player.paused) {
      player.paused = false;
      player.endTime = Date.now() + player.remainingMs;
      player.timerId = window.setInterval(updateTimer, 100);
    } else {
      player.remainingMs = Math.max(0, player.endTime - Date.now());
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
      player = null;
      localStorage.removeItem(SESSION_KEY);
      renderHome();
    }
  }

  function completeWorkout() {
    if (!player) return;
    const completed = player.workout;
    clearInterval(player.timerId);
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
      workout[workoutField] = workoutField === "includeLastRest" ? event.target.checked : event.target.value;
      const title = document.querySelector(".editor-title h1");
      if (workoutField === "name" && title) title.textContent = event.target.value || "Bez nazwy";
    }
    if (exerciseField) {
      const exercise = workout.exercises[Number(event.target.dataset.index)];
      if (!exercise) return;
      exercise[exerciseField] = ["duration", "rest"].includes(exerciseField) ? clampSeconds(event.target.value) : event.target.value;
      if (exerciseField === "name") {
        const card = event.target.closest(".exercise-card");
        const preview = card?.querySelector(".exercise-name-preview");
        if (preview) preview.textContent = event.target.value || "Nowe ćwiczenie";
      }
    }
    saveWorkouts();
    const total = document.querySelector("#editor-total");
    if (total) total.textContent = formatTime(totalDuration(workout));
  });

  app.addEventListener("change", (event) => {
    if (event.target.matches('[data-workout-field="includeLastRest"]')) {
      const workout = workouts.find((item) => item.id === editingId);
      if (!workout) return;
      workout.includeLastRest = event.target.checked;
      saveWorkouts();
      const total = document.querySelector("#editor-total");
      if (total) total.textContent = formatTime(totalDuration(workout));
    }
  });

  importInput.addEventListener("change", () => handleImport(importInput.files[0]));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && player && !player.paused) updateTimer();
  });
  window.addEventListener("beforeunload", () => persistSession(true));

  if (!tryResumeSession()) renderHome();
})();
