# Civics 128 — U.S. Citizenship Test Practice 🇺🇸

### 👉 Open the app / Abrir la app: **https://darkwinpr.github.io/civics-128/**

**Free study app for the U.S. naturalization test** — civics questions, English reading
and writing, and N-400 interview practice. Works on any phone, can be installed like an
app, and works offline. Interface in **English and Spanish**.

**App gratuita para estudiar el examen de ciudadanía de EE. UU.** — preguntas de cívica,
lectura y escritura en inglés, y práctica de la entrevista N-400. Funciona en cualquier
celular, se puede instalar como app y funciona sin internet. Interfaz en **español e inglés**.

> ⚠️ Independent study tool. Not affiliated with or endorsed by USCIS or the U.S.
> government, and not legal advice. Always confirm time-sensitive answers at
> [uscis.gov/citizenship/testupdates](https://www.uscis.gov/citizenship/testupdates).
>
> Herramienta independiente. No está afiliada a USCIS ni al gobierno de EE. UU. y no es
> asesoría legal.

## Features / Funciones

- **Learning path / Ruta de estudio:** questions in lessons of 10 (first with options, then from
  memory, until you know them all), a short exam to finish each section, a daily session
  (review + next lesson + one English sentence) and a study plan from your interview date.
- **Friendly start / Bienvenida:** a 3-step welcome on the first visit (test version, your state,
  interview date), a daily reminder you add to your own calendar, and an "install the app" card.
- **Easiest answer** highlighted for every question, and a hands-free **listen mode**.
- **Both civics tests / Ambas versiones:** 2025 test (128 questions, N-400 filed on or after
  Oct 20, 2025) and 2008 test (100 questions, filed before that date), including the 65/20 subsets.
- **Flashcards** with audio, auto-reveal timer and **smart review** (spaced repetition).
- **Mock exam** that follows the official rules and stops early on pass/fail.
- **Oral coach**: the "officer" reads the question aloud and you answer with your voice.
- **English test**: reading aloud with speech recognition and word-by-word feedback, dictation
  with hints and word-by-word audio, official vocabulary, **N-400 interview questions** you can
  answer by voice, helpful phrases for the officer, encouraging feedback and saved progress.
- **English mock interview**: N-400 questions, then reading and writing with the official
  3-try rules, and a friendly results screen.
- **Hardest questions**: the dashboard lists the questions you miss most, with one tap to drill them.
- **Forgiving answers**: accents and small spelling slips on long words are accepted
  ("constitución", "Jeferson").
- **Your state, auto-filled**: pick your state and district to get your current senators,
  representative, governor and capital.
- **"Ver en español"** translation helper for every question (answers stay in English).
- Daily goal, streak, larger text option, dark mode, print study sheets, share on WhatsApp.
- **Private**: no account, no ads, no tracking. Progress is saved only in your browser, and you
  can save a backup file to move it to another phone.

## Development

```bash
npm install
npm run dev
npm test
npm run build && npm run e2e   # browser tests (Playwright) incl. accessibility checks
npm run build   # output in dist/ (static site, includes the offline service worker)
```

Every push to `main` is tested and deployed to GitHub Pages (`.github/workflows/deploy.yml`).
A monthly workflow opens an issue reminding maintainers to verify officials.

See [CONTRIBUTING.md](CONTRIBUTING.md) to report mistakes, translate, or help.

## License

[MIT](LICENSE). Question text comes from public USCIS materials.
