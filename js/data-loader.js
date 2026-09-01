(function () {
  "use strict";

  const fallbackPresets = Array.isArray(window.WORKOUT_TIMER_PRESETS)
    ? window.WORKOUT_TIMER_PRESETS
    : [];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  async function loadFromManifest() {
    const manifestResponse = await fetch("data/manifest.json", { cache: "no-store" });
    if (!manifestResponse.ok) throw new Error(`Nie udało się wczytać manifestu (${manifestResponse.status})`);
    const manifest = await manifestResponse.json();
    if (!manifest || !Array.isArray(manifest.files)) throw new Error("Nieprawidłowy data/manifest.json");

    const workouts = await Promise.all(manifest.files.map(async (filename) => {
      if (typeof filename !== "string" || !filename.toLowerCase().endsWith(".json") || filename.includes("..")) {
        throw new Error(`Nieprawidłowa nazwa pliku danych: ${filename}`);
      }
      const response = await fetch(`data/${filename}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Nie udało się wczytać data/${filename}`);
      return response.json();
    }));

    return workouts;
  }

  async function loadPresets() {
    if (window.location.protocol === "file:") return clone(fallbackPresets);
    try {
      const loaded = await loadFromManifest();
      return loaded.length ? loaded : clone(fallbackPresets);
    } catch (error) {
      console.warn("Używam wbudowanych danych zapasowych.", error);
      return clone(fallbackPresets);
    }
  }

  window.WorkoutData = { loadPresets };
})();
