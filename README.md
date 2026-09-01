# Tempo — timer treningów interwałowych

Lekka aplikacja działająca całkowicie w przeglądarce. Nie wymaga instalacji, serwera, npm ani połączenia z internetem.

## Uruchomienie

Otwórz plik `index.html` w dowolnej współczesnej przeglądarce.

## Struktura projektu

```text
workout-timer/
├── index.html
├── styles.css
├── js/
│   ├── app.js
│   └── data-loader.js
└── data/
    ├── manifest.json
    ├── presets.js
    ├── dumbbell-full-body-15.json
    ├── poranny-rozruch-5.json
    └── szybki-core-6.json
```

`js/app.js` zawiera interfejs i timer. `js/data-loader.js` odpowiada wyłącznie za ładowanie treningów startowych. Każdy trening startowy znajduje się w osobnym pliku JSON.

### Dodawanie kolejnego treningu startowego

1. Dodaj poprawny plik, np. `data/moj-trening.json`.
2. Dopisz jego nazwę do tablicy `files` w `data/manifest.json`.
3. Jeżeli aplikacja ma nadal działać również po bezpośrednim otwarciu `index.html` przez `file://`, dopisz ten sam trening do `data/presets.js`.

Na GitHub Pages aplikacja automatycznie pobiera wszystkie pliki JSON wymienione w manifeście. Statyczna strona nie może samodzielnie wylistować katalogu serwera, dlatego manifest jest konieczny. `data/presets.js` jest zapasowym źródłem danych tylko dla trybu `file://`, w którym przeglądarki blokują `fetch()` lokalnych JSON-ów.

## Możliwości

- tworzenie, edycja, usuwanie, duplikowanie i zmiana kolejności ćwiczeń,
- automatyczne zapisywanie treningów oraz ustawienia dźwięku w `localStorage`,
- precyzyjny timer oparty na timestampach,
- osobny ekran pracy i przerwy z opisem kolejnego ćwiczenia,
- ekran przygotowania — timer rusza dopiero po dodatkowym kliknięciu „Rozpocznij timer”,
- duży centralny przycisk pauzy oraz możliwość zatrzymania i wznowienia treningu przez dotknięcie timera,
- pauza, wznowienie, poprzednie/następne, restart i zakończenie,
- sygnały Web Audio API przy 3, 2 i 1 sekundzie oraz przy starcie ćwiczenia,
- pasek postępu i poprawnie liczony pozostały czas,
- import i eksport wszystkich treningów lub pojedynczego treningu w JSON,
- przywracanie niedokończonego treningu po odświeżeniu,
- responsywny widok telefonu.

## Dane lokalne

Aplikacja korzysta z kluczy:

- `workoutTimerData` — treningi,
- `workoutTimerSettings` — ustawienia,
- `workoutTimerSession` — stan niedokończonego treningu.

Usunięcie danych witryny w ustawieniach przeglądarki wyczyści zapisane treningi. Warto wcześniej użyć opcji „Eksportuj wszystko”.

## Import JSON

Import przyjmuje pliki utworzone przez aplikację, pojedynczy obiekt treningu albo kolekcję z polem `workouts`. Dane są sprawdzane przed zapisem: trening musi mieć nazwę, listę ćwiczeń, a każde ćwiczenie nazwę oraz nieujemny czas pracy i przerwy.

Najprostszy format pojedynczego treningu:

```json
{
  "id": "moj-trening",
  "name": "Mój trening",
  "description": "Opcjonalny opis treningu",
  "includeLastRest": false,
  "exercises": [
    {
      "id": "przysiad",
      "name": "Przysiad z hantlami",
      "duration": 40,
      "rest": 25,
      "weight": "2 × 8 kg",
      "muscles": "uda, pośladki, brzuch",
      "description": "Cofnij biodra i zejdź do przysiadu.",
      "tips": "Kolana prowadź w kierunku palców stóp."
    }
  ]
}
```

Pola `id`, `description`, `weight`, `muscles`, `tips` i `includeLastRest` mogą zostać pominięte. Wymagane są: nazwa treningu, tablica `exercises`, nazwa każdego ćwiczenia oraz liczbowy `duration` i `rest` większe lub równe zero.

Kolekcję wielu treningów można zaimportować w formacie:

```json
{
  "version": 1,
  "type": "workout-collection",
  "workouts": [
    { "name": "Trening A", "exercises": [] },
    { "name": "Trening B", "exercises": [] }
  ]
}
```

W praktyce najłatwiej utworzyć jeden trening w aplikacji, użyć „Eksportuj trening”, a następnie edytować wygenerowany plik JSON.

## GitHub Pages

Pliki używają wyłącznie ścieżek względnych. Można je umieścić w katalogu głównym repozytorium albo w folderze publikowanym przez GitHub Pages. Nie jest wymagany żaden proces budowania.
