import type { StringModule } from '../index';

/** Strings for the dashboard screen. Keys are prefixed with "dashboard.". */
const strings: StringModule = {
  en: {
    'dashboard.eyebrow': 'Official USCIS {year} Naturalization Test',
    // {total} is replaced with trusted markup (the highlighted number).
    'dashboard.heroTitle': 'Master All {total} Civics Questions in English',
    'dashboard.lead2008':
      'You are studying the 2008 test (N-400 filed before Oct 20, 2025): 10 questions asked, 6 correct to pass.',
    'dashboard.lead2025':
      'Practice for the real oral interview: 20 questions asked, 12 correct to pass (or 6 of 10 for 65/20 applicants).',
    'dashboard.leadTrain':
      'Train with flashcards, realistic mock exams, voice coaching and English test practice.',
    'dashboard.startExam': 'Start Mock Exam',
    'dashboard.oralCoach': 'Oral Voice Coach',
    'dashboard.studyFlashcards': 'Study Flashcards',
    'dashboard.readinessAria': '{pct}% of {total} questions mastered',
    'dashboard.masteredCaption': 'Mastered',
    'dashboard.personalizeTitle': 'Personalize your state answers:',
    'dashboard.personalizeBody':
      '{count} state-specific questions (Senator, Representative, Governor ★, State Capital) are not set yet.',
    'dashboard.setOfficials': 'Set State Officials',
    'dashboard.todayAria': 'Today',
    'dashboard.streakOne': 'day streak',
    'dashboard.streakMany': 'day streak',
    'dashboard.goalReached': 'Daily goal reached! 🎉',
    'dashboard.questionsToday': 'questions today',
    'dashboard.dueLabel': 'cards due for smart review',
    'dashboard.reviewNow': 'Review now',
    'dashboard.shareHelp': 'Help a friend study too',
    'dashboard.statsAria': 'Study metrics',
    'dashboard.statMastered': 'Mastered',
    'dashboard.remaining': '{n} remaining to master',
    'dashboard.statReview': 'Needs Review',
    'dashboard.practiceFlagged': 'Practice flagged cards',
    'dashboard.noFlagged': 'No cards flagged for review',
    'dashboard.stat6520': '65/20 Starred',
    'dashboard.study6520': 'Study 65/20 subset',
    'dashboard.statExams': 'Mock Exams Passed',
    'dashboard.firstExam': 'Take your first {n}-question test',
    'dashboard.passedThreshold': 'Passed official threshold',
    'dashboard.categoryHeading': 'Mastery by Official Category',
    'dashboard.categoryAria': '{category} mastery: {done} of {total}',
    'dashboard.historyHeading': 'Recent Mock Exams',
    'dashboard.noExams':
      'No mock exams completed yet. The official {year} exam asks up to {max} questions and stops as soon as you reach {pass} correct (pass) or {fail} incorrect (fail).',
    'dashboard.exam6520': '65/20 Exam ★',
    'dashboard.examStandard': 'Standard {year} Exam',
    'dashboard.historyMeta': '{date} · {n} asked',
    'dashboard.passed': 'PASSED',
    'dashboard.notPassed': 'NOT PASSED',
  },
  es: {
    'dashboard.eyebrow': 'Examen oficial de naturalización USCIS {year}',
    'dashboard.heroTitle': 'Domina las {total} preguntas de cívica en inglés',
    'dashboard.lead2008':
      'Estás estudiando el examen 2008 (N-400 presentado antes del 20 de octubre de 2025): te hacen 10 preguntas y necesitas 6 correctas para aprobar.',
    'dashboard.lead2025':
      'Practica para la entrevista oral real: te hacen 20 preguntas y necesitas 12 correctas para aprobar (o 6 de 10 si calificas para 65/20).',
    'dashboard.leadTrain':
      'Estudia con tarjetas, exámenes de práctica realistas, práctica con voz y práctica del examen de inglés.',
    'dashboard.startExam': 'Empezar examen de práctica',
    'dashboard.oralCoach': 'Práctica oral con voz',
    'dashboard.studyFlashcards': 'Estudiar con tarjetas',
    'dashboard.readinessAria': '{pct}% de las {total} preguntas dominadas',
    'dashboard.masteredCaption': 'Dominadas',
    'dashboard.personalizeTitle': 'Personaliza las respuestas de tu estado:',
    'dashboard.personalizeBody':
      'Todavía no has configurado {count} preguntas de tu estado (senador, representante, gobernador ★, capital del estado).',
    'dashboard.setOfficials': 'Configurar funcionarios',
    'dashboard.todayAria': 'Hoy',
    'dashboard.streakOne': 'día seguido',
    'dashboard.streakMany': 'días seguidos',
    'dashboard.goalReached': '¡Meta del día cumplida! 🎉',
    'dashboard.questionsToday': 'preguntas hoy',
    'dashboard.dueLabel': 'tarjetas para repasar hoy',
    'dashboard.reviewNow': 'Repasar ahora',
    'dashboard.shareHelp': 'Ayuda a un amigo a estudiar también',
    'dashboard.statsAria': 'Tu progreso',
    'dashboard.statMastered': 'Dominadas',
    'dashboard.remaining': 'Te faltan {n} por dominar',
    'dashboard.statReview': 'Por repasar',
    'dashboard.practiceFlagged': 'Practicar tarjetas marcadas',
    'dashboard.noFlagged': 'No tienes tarjetas marcadas para repasar',
    'dashboard.stat6520': 'Preguntas 65/20 ★',
    'dashboard.study6520': 'Estudiar solo las 65/20',
    'dashboard.statExams': 'Exámenes aprobados',
    'dashboard.firstExam': 'Haz tu primer examen de {n} preguntas',
    'dashboard.passedThreshold': 'Llegaste a la nota oficial para aprobar',
    'dashboard.categoryHeading': 'Progreso por categoría oficial',
    'dashboard.categoryAria': '{category}: {done} de {total} dominadas',
    'dashboard.historyHeading': 'Exámenes de práctica recientes',
    'dashboard.noExams':
      'Todavía no has hecho ningún examen de práctica. El examen oficial {year} hace hasta {max} preguntas y termina cuando llegas a {pass} correctas (apruebas) o {fail} incorrectas (no apruebas).',
    'dashboard.exam6520': 'Examen 65/20 ★',
    'dashboard.examStandard': 'Examen estándar {year}',
    'dashboard.historyMeta': '{date} · {n} preguntas',
    'dashboard.passed': 'APROBADO',
    'dashboard.notPassed': 'NO APROBADO',
  },
};

export default strings;
