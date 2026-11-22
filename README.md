# Civics 128 — U.S. Citizenship Test Practice 🇺🇸

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

- **Both civics tests / Ambas versiones:** 2025 test (128 questions, N-400 filed on or after
  Oct 20, 2025) and 2008 test (100 questions, filed before that date), including the 65/20 subsets.
- **Flashcards** with audio, auto-reveal timer and **smart review** (spaced repetition).
- **Mock exam** that follows the official rules and stops early on pass/fail.
- **Oral coach**: the "officer" reads the question aloud and you answer with your voice.
- **English test**: reading aloud with speech recognition, dictation for writing, official
  vocabulary lists and **N-400 interview questions** with Spanish help.
- **Your state, auto-filled**: pick your state and district to get your current senators,
  representative, governor and capital.
- **"Ver en español"** translation helper for every question (answers stay in English).
- Daily goal, streak, larger text option, dark mode, print study sheets, share on WhatsApp.
- **Private**: no account, no ads, no tracking. Progress is saved only in your browser.

## Development

```bash
npm install
npm run dev
npm test
npm run build   # output in dist/ (static site, includes the offline service worker)
```

Every push to `main` is tested and deployed to GitHub Pages (`.github/workflows/deploy.yml`).
A monthly workflow opens an issue reminding maintainers to verify officials.

See [CONTRIBUTING.md](CONTRIBUTING.md) to report mistakes, translate, or help.

## License

[MIT](LICENSE). Question text comes from public USCIS materials.
