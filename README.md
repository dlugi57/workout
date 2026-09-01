# Tempo — timer treningów interwałowych

Lekka aplikacja działająca całkowicie w przeglądarce. Nie wymaga instalacji, serwera, npm ani połączenia z internetem.

## Uruchomienie

Otwórz plik `index.html` w dowolnej współczesnej przeglądarce.

## Możliwości

- tworzenie, edycja, usuwanie, duplikowanie i zmiana kolejności ćwiczeń,
- automatyczne zapisywanie treningów oraz ustawienia dźwięku w `localStorage`,
- precyzyjny timer oparty na timestampach,
- osobny ekran pracy i przerwy z opisem kolejnego ćwiczenia,
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
