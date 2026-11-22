# Contributing / Cómo contribuir

Thank you for helping people prepare for their U.S. citizenship interview!
¡Gracias por ayudar a otras personas a prepararse para su entrevista de ciudadanía!

## Report a mistake / Reportar un error
Use **Issues → New issue → "Report a mistake"**. Include the question number, the test
version (2025 or 2008) and, if possible, an official source such as uscis.gov.

## Where things live / Dónde está cada cosa

| What / Qué | File / Archivo |
|---|---|
| 2025 civics questions (128) | `src/domain/questions.ts` |
| 2008 civics questions (100) + Spanish | `src/domain/questions2008.ts` |
| Spanish translation of the 2025 questions | `src/i18n/questionsEs.ts` |
| Current federal officials (President, Speaker…) | `DEFAULT_OFFICIALS` in `src/domain/questions.ts` |
| Governors and state capitals | `src/domain/states.ts` |
| English test: vocabulary, sentences, N-400 interview | `src/domain/englishTest.ts` |
| Interface text (English + Spanish) | `src/i18n/strings/*.ts` |

Senators and representatives are loaded live from the public
[@unitedstates/congress-legislators](https://github.com/unitedstates/congress-legislators) dataset.

## Add a new interface language / Agregar otro idioma
1. Add the language code to `Lang` in `src/i18n/index.ts`.
2. Add a block for it in every file in `src/i18n/strings/` (missing keys fall back to English).
3. Add a translation file for the questions like `src/i18n/questionsEs.ts`.

The civics questions themselves always stay in English, because the interview is in English.

## Run locally / Ejecutar en tu computadora
```bash
npm install
npm run dev     # http://localhost:5173
npm test
npm run build
```

Please keep the app free, private (no accounts, no tracking of personal data) and accessible.
