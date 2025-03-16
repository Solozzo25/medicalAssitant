# MedDiagnosis - Aplikacja diagnostyczna dla lekarzy

Aplikacja wspomagająca lekarzy w procesie diagnozy i rekomendacji leczenia, wykorzystująca dwa modele AI: GPT i Perplexity.

## Funkcje

- Analiza danych pacjenta (wiek, płeć, objawy)
- Generowanie diagnozy głównej i różnicowej
- Rekomendacje dotyczące leczenia
- Charakterystyka kluczowego leku
- Wskazanie odpowiedniego towarzystwa medycznego
- Możliwość eksportu raportu

## Struktura projektu

```
├── index.html             # Główny plik HTML
├── js/
│   ├── api.js             # Funkcje do komunikacji z API
│   └── main.js            # Główny skrypt aplikacji
├── netlify/
│   └── functions/
│       ├── gpt-diagnosis.js       # Funkcja łącząca się z GPT
│       └── perplexity-treatment.js # Funkcja łącząca się z Perplexity
├── netlify.toml           # Konfiguracja Netlify
└── package.json           # Zależności projektu
```

## Zmienne środowiskowe

Aplikacja wymaga następujących zmiennych środowiskowych ustawionych w Netlify:

- `OPENAI_API_KEY` - klucz API dla OpenAI
- `PERPLEXITY_API_KEY` - klucz API dla Perplexity

## Uruchomienie lokalnie

1. Zainstaluj zależności:
```
npm install
```

2. Utwórz plik `.env` z kluczami API:
```
OPENAI_API_KEY=twój_klucz_openai
PERPLEXITY_API_KEY=twój_klucz_perplexity
```

3. Uruchom serwer deweloperski:
```
npm run dev
```

## Wdrożenie

1. Połącz repozytorium GitHub z Netlify
2. Ustaw zmienne środowiskowe w panelu Netlify
3. Wdrożenie nastąpi automatycznie po push do repozytorium

## Technologie

- Frontend: HTML, CSS, JavaScript
- Backend: Netlify Functions (serverless)
- API: OpenAI GPT, Perplexity AI
