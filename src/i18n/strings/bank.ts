import type { StringModule } from '../index';

/** Strings for the bank screen. Keys are prefixed with "bank.". */
const strings: StringModule = {
  en: {
    'bank.title': 'All {total} Official Questions',
    'bank.lead2008':
      'Complete USCIS 2008 civics question bank (100 questions) with search, category filters, audio playback, and status tracking.',
    'bank.lead2025':
      'Complete USCIS 2025 (Form M-1778) question bank with search, category filters, audio playback, and status tracking.',
    'bank.print': '🖨️ Print study sheet',
    'bank.searchLabel': 'Search by number, keyword, or answer',
    'bank.searchPlaceholder': 'e.g. Constitution, 1776, Lincoln, Q38…',
    'bank.statusLabel': 'Progress Status',
    'bank.allStatuses': 'All Statuses',
    'bank.unseen': 'Unseen',
    'bank.categoryFilter': 'Category filter',
    'bank.allCount': 'All (128)',
    'bank.count6520': '65/20 ★ (20)',
    'bank.resultsCount': 'Showing {shown} of {total} official questions',
    'bank.noResults': 'No questions match your search and filters.',
    'bank.cardAria': 'Question {id}',
    // Status words used inside sentences (aria-label and announcements).
    'bank.statusWord.unseen': 'unseen',
    'bank.statusWord.mastered': 'mastered',
    'bank.statusWord.review': 'review',
    'bank.statusAria': 'Question {id} status: {status}. Activate to change.',
    'bank.statusAnnounce': 'Question {id} marked as {status}.',
    'bank.stopQuestionAria': 'Stop reading question {id}',
    'bank.listenQuestionAria': 'Question: listen to question {id}',
    'bank.stopAnswersAria': 'Stop reading answers for question {id}',
    'bank.listenAnswersAria': 'Answers: listen to answers for question {id}',
    'bank.stop': 'Stop',
    'bank.question': 'Question',
    'bank.answers': 'Answers',
  },
  es: {
    'bank.title': 'Las {total} preguntas oficiales',
    'bank.lead2008':
      'Todas las preguntas de cívica del examen USCIS 2008 (100 preguntas), con búsqueda, filtros por categoría, audio y seguimiento de tu progreso.',
    'bank.lead2025':
      'Todas las preguntas del examen USCIS 2025 (formulario M-1778), con búsqueda, filtros por categoría, audio y seguimiento de tu progreso.',
    'bank.print': '🖨️ Imprimir hoja de estudio',
    'bank.searchLabel': 'Busca por número, palabra o respuesta (en inglés)',
    'bank.searchPlaceholder': 'p. ej. Constitution, 1776, Lincoln, Q38…',
    'bank.statusLabel': 'Estado de tu progreso',
    'bank.allStatuses': 'Todos los estados',
    'bank.unseen': 'Sin ver',
    'bank.categoryFilter': 'Filtrar por categoría',
    'bank.allCount': 'Todas (128)',
    'bank.count6520': '65/20 ★ (20)',
    'bank.resultsCount': 'Mostrando {shown} de {total} preguntas oficiales',
    'bank.noResults': 'Ninguna pregunta coincide con tu búsqueda y filtros.',
    'bank.cardAria': 'Pregunta {id}',
    'bank.statusWord.unseen': 'sin ver',
    'bank.statusWord.mastered': 'dominada',
    'bank.statusWord.review': 'para repasar',
    'bank.statusAria': 'Pregunta {id}, estado: {status}. Actívalo para cambiarlo.',
    'bank.statusAnnounce': 'Pregunta {id} marcada como {status}.',
    'bank.stopQuestionAria': 'Dejar de leer la pregunta {id}',
    'bank.listenQuestionAria': 'Pregunta: escuchar la pregunta {id}',
    'bank.stopAnswersAria': 'Dejar de leer las respuestas de la pregunta {id}',
    'bank.listenAnswersAria': 'Respuestas: escuchar las respuestas de la pregunta {id}',
    'bank.stop': 'Detener',
    'bank.question': 'Pregunta',
    'bank.answers': 'Respuestas',
  },
};

export default strings;
