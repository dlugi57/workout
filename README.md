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
    ├── rehafit-lydki.json
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
- ćwiczenia na czas **oraz na powtórzenia** — seria na powtórzenia czeka na przycisk „Zrobione ✓” i mierzy czas w górę,
- ilość serii przy każdym ćwiczeniu (np. 5 serii po 40 s) oraz obiegi całego treningu z osobną przerwą,
- ekran nie gaśnie podczas treningu (Screen Wake Lock API, z trybem zastępczym),
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

## Serie i powtórzenia

Aplikacja rozróżnia dwa niezależne poziomy powtarzania:

- **Ilość serii** (pole przy ćwiczeniu) — ile razy z rzędu wykonujesz to konkretne ćwiczenie, z jego przerwą po każdej serii. Tak zapisane są typowe plany rehabilitacyjne i siłowe, np. „ćwiczenie 1: 5 serii, ćwiczenie 2: 3 serie”.
- **Obiegi całego treningu** (pole przy treningu) — ile razy powtarzana jest cała lista ćwiczeń od początku (1–20). Do tego **Przerwa między obiegami (s)**; `0` oznacza użycie zwykłej przerwy ostatniego ćwiczenia.

Oba można łączyć: 3 obiegi treningu, w którym ćwiczenie ma 2 serie, dadzą 6 bloków pracy tego ćwiczenia.

Każde ćwiczenie ma pole **Typ ćwiczenia**:

- **Na czas** — klasyczny odliczany interwał (pole `Czas serii (s)`),
- **Na powtórzenia** — timer nie odlicza, tylko mierzy czas serii w górę, a trening przechodzi dalej dopiero po naciśnięciu dużego przycisku „Zrobione ✓” (albo samej liczby powtórzeń). Pole `Szacowany czas (s)` służy wyłącznie do wyliczenia łącznego czasu i paska postępu; `0` oznacza szacunek 3 s na powtórzenie. Czas z szacunku jest oznaczany tyldą, np. `~12:30`.

## Ekran, który nie gaśnie

Podczas treningu aplikacja prosi system o blokadę wygaszania ekranu (Screen Wake Lock API) i odbiera ją ponownie po powrocie do karty. Blokada jest zwalniana po zakończeniu lub przerwaniu treningu.

Wake Lock API wymaga **bezpiecznego kontekstu**: `https://`, `http://localhost` albo `http://127.0.0.1`. Otwarcie aplikacji na telefonie po zwykłym `http://192.168.x.x` z serwera WAMP nie spełnia tego warunku — wtedy uruchamiany jest tryb zastępczy: ukryty, wyciszony filmik odtwarzany w pętli, który w większości przeglądarek mobilnych również powstrzymuje wygaszanie. Który tryb jest aktywny, widać w małym podpisie pod nazwą treningu na ekranie odtwarzacza.

Aby mieć pełną, systemową blokadę na telefonie, warto podać aplikację przez HTTPS (np. certyfikat w WAMP, tunel typu Cloudflare/ngrok albo GitHub Pages).

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
  "rounds": 3,
  "roundRest": 90,
  "exercises": [
    {
      "id": "przysiad",
      "name": "Przysiad z hantlami",
      "mode": "time",
      "sets": 3,
      "duration": 40,
      "rest": 25,
      "weight": "2 × 8 kg",
      "muscles": "uda, pośladki, brzuch",
      "description": "Cofnij biodra i zejdź do przysiadu.",
      "tips": "Kolana prowadź w kierunku palców stóp."
    },
    {
      "id": "wioslowanie",
      "name": "Wiosłowanie hantlem",
      "mode": "reps",
      "sets": 3,
      "reps": 12,
      "duration": 0,
      "rest": 30,
      "weight": "1 × 10 kg"
    }
  ]
}
```

Pola `id`, `description`, `weight`, `muscles`, `tips` i `includeLastRest` mogą zostać pominięte. Wymagane są: nazwa treningu, tablica `exercises`, nazwa każdego ćwiczenia oraz liczbowy `duration` i `rest` większe lub równe zero.

Pola dodane dla serii i powtórzeń są opcjonalne i mają domyślne wartości:

| pole | poziom | domyślnie | znaczenie |
| --- | --- | --- | --- |
| `rounds` | trening | `1` | ile razy powtórzyć całą listę ćwiczeń (1–20) |
| `roundRest` | trening | `0` | przerwa między obiegami w sekundach; `0` = zwykła przerwa ostatniego ćwiczenia |
| `mode` | ćwiczenie | `"time"` | `"time"` albo `"reps"` |
| `sets` | ćwiczenie | `1` | ile serii tego ćwiczenia z rzędu, z przerwą po każdej (1–20) |
| `reps` | ćwiczenie | `10` | liczba powtórzeń przy `mode: "reps"` (1–999) |

Przy `mode: "reps"` pole `duration` przestaje odliczać i służy tylko jako szacowany czas serii; `0` oznacza automatyczny szacunek 3 s na powtórzenie.

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
