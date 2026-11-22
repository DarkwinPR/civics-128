/**
 * Spanish (Latin American) translations of the 128 civics questions (2025 version).
 * Keys match the `id` of each item in CIVICS_QUESTIONS (src/domain/questions.ts).
 * Each `a` array has the same length and order as the English `answers` array.
 */
export interface QuestionTranslation {
  q: string;
  a: string[];
  note?: string;
}

const VERIFY_NOTE =
  'Respuesta que cambia con el tiempo. Verifique quién ocupa el cargo actualmente en uscis.gov/citizenship/testupdates o actualícelo en Configuración.';

export const QUESTIONS_2025_ES: Record<number, QuestionTranslation> = {
  // ===== Gobierno estadounidense — A: Principios del gobierno estadounidense (1–15)
  1: {
    q: '¿Cuál es la forma de gobierno de los Estados Unidos?',
    a: ['República', 'República federal basada en la Constitución', 'Democracia representativa'],
  },
  2: {
    q: '¿Cuál es la ley suprema del país?',
    a: ['La Constitución (de los EE. UU.)'],
  },
  3: {
    q: 'Mencione una cosa que hace la Constitución de los EE. UU.',
    a: [
      'Forma el gobierno',
      'Define los poderes del gobierno',
      'Define las partes del gobierno',
      'Protege los derechos del pueblo',
    ],
  },
  4: {
    q: 'La Constitución de los EE. UU. empieza con las palabras "Nosotros, el Pueblo" ("We the People"). ¿Qué significa "Nosotros, el Pueblo"?',
    a: [
      'Autogobierno',
      'Soberanía popular',
      'Consentimiento de los gobernados',
      'El pueblo debe gobernarse a sí mismo',
      '(Ejemplo de) contrato social',
    ],
  },
  5: {
    q: '¿Cómo se hacen cambios a la Constitución de los EE. UU.?',
    a: ['Enmiendas', 'El proceso de enmienda'],
  },
  6: {
    q: '¿Qué protege la Carta de Derechos (Bill of Rights)?',
    a: [
      'Los derechos (básicos) de los estadounidenses',
      'Los derechos (básicos) de las personas que viven en los Estados Unidos',
    ],
  },
  7: {
    q: '¿Cuántas enmiendas tiene la Constitución de los EE. UU.?',
    a: ['Veintisiete (27)'],
  },
  8: {
    q: '¿Por qué es importante la Declaración de Independencia?',
    a: [
      'Dice que Estados Unidos es libre del control británico.',
      'Dice que todas las personas son creadas iguales.',
      'Identifica derechos inherentes.',
      'Identifica libertades individuales.',
    ],
  },
  9: {
    q: '¿Qué documento fundador dijo que las colonias americanas eran libres de Gran Bretaña?',
    a: ['La Declaración de Independencia'],
  },
  10: {
    q: 'Mencione dos ideas importantes de la Declaración de Independencia y de la Constitución de los EE. UU.',
    a: [
      'Igualdad',
      'Libertad',
      'Contrato social',
      'Derechos naturales',
      'Gobierno limitado',
      'Autogobierno',
    ],
  },
  11: {
    q: '¿En qué documento fundador están las palabras "Vida, Libertad y la búsqueda de la Felicidad"?',
    a: ['La Declaración de Independencia'],
  },
  12: {
    q: '¿Cuál es el sistema económico de los Estados Unidos?',
    a: ['Capitalismo', 'Economía de libre mercado'],
  },
  13: {
    q: '¿Qué es el estado de derecho (rule of law)?',
    a: [
      'Todos deben obedecer la ley.',
      'Los líderes deben obedecer la ley.',
      'El gobierno debe obedecer la ley.',
      'Nadie está por encima de la ley.',
    ],
  },
  14: {
    q: 'Muchos documentos influyeron en la Constitución de los EE. UU. Mencione uno.',
    a: [
      'La Declaración de Independencia',
      'Los Artículos de la Confederación',
      'Los Documentos Federalistas (Federalist Papers)',
      'Los Documentos Antifederalistas (Anti-Federalist Papers)',
      'La Declaración de Derechos de Virginia',
      'Las Órdenes Fundamentales de Connecticut',
      'El Pacto del Mayflower',
      'La Gran Ley de la Paz de los iroqueses',
    ],
  },
  15: {
    q: 'Hay tres poderes (ramas) de gobierno. ¿Por qué?',
    a: [
      'Para que ninguna parte se vuelva demasiado poderosa',
      'Pesos y contrapesos',
      'Separación de poderes',
    ],
  },

  // ===== Gobierno estadounidense — B: Sistema de gobierno (16–62)
  16: {
    q: 'Mencione los tres poderes (ramas) del gobierno.',
    a: ['Legislativo, ejecutivo y judicial', 'El Congreso, el presidente y los tribunales'],
  },
  17: {
    q: '¿De qué poder (rama) del gobierno está a cargo el Presidente de los Estados Unidos?',
    a: ['El poder ejecutivo'],
  },
  18: {
    q: '¿Qué parte del gobierno federal escribe las leyes?',
    a: [
      'El Congreso (de los EE. UU.)',
      'La legislatura (de los EE. UU. o nacional)',
      'El poder legislativo',
    ],
  },
  19: {
    q: '¿Cuáles son las dos partes del Congreso de los EE. UU.?',
    a: ['El Senado y la Cámara (de Representantes)'],
  },
  20: {
    q: 'Mencione un poder del Congreso de los EE. UU.',
    a: ['Escribe leyes', 'Declara la guerra', 'Hace el presupuesto federal'],
  },
  21: {
    q: '¿Cuántos senadores de los EE. UU. hay?',
    a: ['Cien (100)'],
  },
  22: {
    q: '¿Cuánto dura el mandato (período) de un senador de los EE. UU.?',
    a: ['Seis (6) años'],
  },
  23: {
    q: '¿Quién es uno de los senadores de los EE. UU. de su estado actualmente?',
    a: ['Las respuestas varían. Escriba el nombre de su senador estatal en Configuración.'],
    note: 'Los residentes del Distrito de Columbia y de los territorios de los EE. UU. deben responder que D.C. (o el territorio donde vive el solicitante) no tiene senadores de los EE. UU.',
  },
  24: {
    q: '¿Cuántos miembros con derecho a voto hay en la Cámara de Representantes?',
    a: ['Cuatrocientos treinta y cinco (435)'],
  },
  25: {
    q: '¿Cuánto dura el mandato (período) de un miembro de la Cámara de Representantes?',
    a: ['Dos (2) años'],
  },
  26: {
    q: '¿Por qué los representantes de los EE. UU. tienen mandatos más cortos que los senadores de los EE. UU.?',
    a: ['Para seguir más de cerca la opinión pública'],
  },
  27: {
    q: '¿Cuántos senadores tiene cada estado?',
    a: ['Dos (2)'],
  },
  28: {
    q: '¿Por qué cada estado tiene dos senadores?',
    a: [
      'Representación igual (para los estados pequeños)',
      'El Gran Compromiso (Compromiso de Connecticut)',
    ],
  },
  29: {
    q: 'Mencione el nombre de su representante de los EE. UU.',
    a: ['Las respuestas varían. Escriba el nombre de su representante de los EE. UU. en Configuración.'],
    note: 'Los residentes de territorios con Delegados sin derecho a voto o Comisionados Residentes pueden dar el nombre de ese Delegado o Comisionado. También se acepta cualquier respuesta que diga que el territorio no tiene representantes (con derecho a voto) en el Congreso.',
  },
  30: {
    q: '¿Cómo se llama actualmente el Presidente (Speaker) de la Cámara de Representantes?',
    a: ['Mike Johnson', 'James Michael Johnson'],
    note: VERIFY_NOTE,
  },
  31: {
    q: '¿A quién representa un senador de los EE. UU.?',
    a: ['A los ciudadanos de su estado', 'A las personas de su estado'],
  },
  32: {
    q: '¿Quién elige a los senadores de los EE. UU.?',
    a: ['Los ciudadanos de su estado'],
  },
  33: {
    q: '¿A quién representa un miembro de la Cámara de Representantes?',
    a: [
      'A los ciudadanos de su distrito (congresional)',
      'A los ciudadanos de su distrito',
      'A las personas de su distrito (congresional)',
      'A las personas de su distrito',
    ],
  },
  34: {
    q: '¿Quién elige a los miembros de la Cámara de Representantes?',
    a: ['Los ciudadanos de su distrito (congresional)'],
  },
  35: {
    q: 'Algunos estados tienen más representantes que otros. ¿Por qué?',
    a: [
      '(Por) la población del estado',
      '(Porque) tienen más habitantes',
      '(Porque) algunos estados tienen más habitantes',
    ],
  },
  36: {
    q: '¿Por cuántos años se elige al Presidente de los Estados Unidos?',
    a: ['Cuatro (4) años'],
  },
  37: {
    q: 'El Presidente de los Estados Unidos solo puede servir dos mandatos. ¿Por qué?',
    a: [
      '(Por) la Enmienda 22',
      'Para evitar que el presidente se vuelva demasiado poderoso',
    ],
  },
  38: {
    q: '¿Cómo se llama actualmente el Presidente de los Estados Unidos?',
    a: ['Donald J. Trump', 'Donald Trump', 'Trump'],
    note: VERIFY_NOTE,
  },
  39: {
    q: '¿Cómo se llama actualmente el Vicepresidente de los Estados Unidos?',
    a: ['JD Vance', 'Vance'],
    note: VERIFY_NOTE,
  },
  40: {
    q: 'Si el presidente ya no puede servir, ¿quién se convierte en presidente?',
    a: ['El Vicepresidente (de los Estados Unidos)'],
  },
  41: {
    q: 'Mencione un poder del presidente.',
    a: [
      'Firma proyectos de ley para convertirlos en ley',
      'Veta proyectos de ley',
      'Hace cumplir las leyes',
      'Comandante en Jefe (de las fuerzas armadas)',
      'Jefe de la diplomacia',
      'Nombra a los jueces federales',
    ],
  },
  42: {
    q: '¿Quién es el Comandante en Jefe de las fuerzas armadas de los EE. UU.?',
    a: ['El Presidente (de los Estados Unidos)'],
  },
  43: {
    q: '¿Quién firma los proyectos de ley para que se conviertan en leyes?',
    a: ['El Presidente (de los Estados Unidos)'],
  },
  44: {
    q: '¿Quién veta los proyectos de ley?',
    a: ['El Presidente (de los Estados Unidos)'],
  },
  45: {
    q: '¿Quién nombra a los jueces federales?',
    a: ['El Presidente (de los Estados Unidos)'],
  },
  46: {
    q: 'El poder ejecutivo tiene muchas partes. Mencione una.',
    a: [
      'El Presidente (de los Estados Unidos)',
      'El Gabinete',
      'Los departamentos y agencias federales',
    ],
  },
  47: {
    q: '¿Qué hace el Gabinete del Presidente?',
    a: ['Aconseja al Presidente (de los Estados Unidos)'],
  },
  48: {
    q: '¿Cuáles son dos cargos a nivel de Gabinete?',
    a: [
      'Fiscal General (Procurador General)',
      'Secretario de Agricultura',
      'Secretario de Comercio',
      'Secretario de Educación',
      'Secretario de Energía',
      'Secretario de Salud y Servicios Humanos',
      'Secretario de Seguridad Nacional',
      'Secretario de Vivienda y Desarrollo Urbano',
      'Secretario del Interior',
      'Secretario del Trabajo',
      'Secretario de Estado',
      'Secretario de Transporte',
      'Secretario del Tesoro',
      'Secretario de Asuntos de Veteranos',
      'Secretario de Guerra (Defensa)',
      'Vicepresidente',
      'Administrador de la Agencia de Protección Ambiental',
      'Administrador de la Administración de Pequeñas Empresas',
      'Director de la Agencia Central de Inteligencia (CIA)',
      'Director de la Oficina de Administración y Presupuesto',
      'Director de Inteligencia Nacional',
      'Representante Comercial de los Estados Unidos',
    ],
  },
  49: {
    q: '¿Por qué es importante el Colegio Electoral?',
    a: [
      'Decide quién es elegido presidente.',
      'Ofrece un punto medio (compromiso) entre la elección del presidente por voto popular y la selección por el Congreso.',
    ],
  },
  50: {
    q: '¿Cuál es una parte del poder judicial?',
    a: ['La Corte Suprema', 'Los tribunales federales'],
  },
  51: {
    q: '¿Qué hace el poder judicial?',
    a: [
      'Revisa las leyes',
      'Explica las leyes',
      'Resuelve disputas (desacuerdos) sobre la ley',
      'Decide si una ley va en contra de la Constitución (de los EE. UU.)',
    ],
  },
  52: {
    q: '¿Cuál es el tribunal más alto de los Estados Unidos?',
    a: ['La Corte Suprema'],
  },
  53: {
    q: '¿Cuántos puestos (asientos) hay en la Corte Suprema?',
    a: ['Nueve (9)'],
  },
  54: {
    q: '¿Cuántos jueces de la Corte Suprema se necesitan normalmente para decidir un caso?',
    a: ['Cinco (5)'],
  },
  55: {
    q: '¿Por cuánto tiempo sirven los jueces de la Corte Suprema?',
    a: ['(De por) vida', 'Nombramiento vitalicio', '(Hasta) jubilarse'],
  },
  56: {
    q: 'Los jueces de la Corte Suprema sirven de por vida. ¿Por qué?',
    a: [
      'Para ser independientes (de la política)',
      'Para limitar la influencia (política) externa',
    ],
  },
  57: {
    q: '¿Quién es actualmente el Presidente de la Corte Suprema (Chief Justice) de los Estados Unidos?',
    a: ['John Roberts', 'John G. Roberts, Jr.'],
    note: VERIFY_NOTE,
  },
  58: {
    q: 'Mencione un poder que pertenece solamente al gobierno federal.',
    a: [
      'Imprimir billetes (dinero de papel)',
      'Acuñar monedas',
      'Declarar la guerra',
      'Crear un ejército',
      'Hacer tratados',
      'Establecer la política exterior',
    ],
  },
  59: {
    q: 'Mencione un poder que pertenece solamente a los estados.',
    a: [
      'Proveer escuelas y educación',
      'Proveer protección (policía)',
      'Proveer seguridad (departamentos de bomberos)',
      'Dar licencias de manejo (de conducir)',
      'Aprobar la zonificación y el uso del suelo',
    ],
  },
  60: {
    q: '¿Cuál es el propósito de la Enmienda 10?',
    a: [
      '(Establece que) los poderes que no se le dan al gobierno federal pertenecen a los estados o al pueblo.',
    ],
  },
  61: {
    q: '¿Quién es actualmente el gobernador de su estado?',
    a: ['Las respuestas varían. Escriba el nombre del gobernador de su estado en Configuración.'],
    note: 'Los residentes del Distrito de Columbia deben responder que D.C. no tiene gobernador.',
  },
  62: {
    q: '¿Cuál es la capital de su estado?',
    a: ['Las respuestas varían. Escriba la capital de su estado en Configuración.'],
    note: 'Los residentes del Distrito de Columbia deben responder que D.C. no es un estado y no tiene capital. Los residentes de los territorios de los EE. UU. deben mencionar la capital del territorio.',
  },

  // ===== Gobierno estadounidense — C: Derechos y responsabilidades (63–72)
  63: {
    q: 'Hay cuatro enmiendas a la Constitución de los EE. UU. sobre quién puede votar. Describa una de ellas.',
    a: [
      'Los ciudadanos de dieciocho (18) años o más (pueden votar).',
      'No hay que pagar (un impuesto electoral) para votar.',
      'Cualquier ciudadano puede votar. (Las mujeres y los hombres pueden votar).',
      'Un ciudadano hombre de cualquier raza (puede votar).',
    ],
  },
  64: {
    q: '¿Quién puede votar en las elecciones federales, postularse para un cargo federal y servir en un jurado en los Estados Unidos?',
    a: ['Los ciudadanos', 'Los ciudadanos de los Estados Unidos', 'Los ciudadanos estadounidenses'],
  },
  65: {
    q: '¿Cuáles son tres derechos de todas las personas que viven en los Estados Unidos?',
    a: [
      'Libertad de expresión',
      'Libertad de palabra',
      'Libertad de reunión',
      'Libertad de presentar peticiones al gobierno',
      'Libertad de religión',
      'El derecho a portar armas',
    ],
  },
  66: {
    q: '¿A qué mostramos lealtad cuando decimos el Juramento a la Bandera (Pledge of Allegiance)?',
    a: ['A los Estados Unidos', 'A la bandera'],
  },
  67: {
    q: 'Mencione dos promesas que hacen los nuevos ciudadanos en el Juramento de Lealtad (Oath of Allegiance).',
    a: [
      'Renunciar a la lealtad a otros países',
      'Defender la Constitución (de los EE. UU.)',
      'Obedecer las leyes de los Estados Unidos',
      'Servir en las fuerzas armadas (si es necesario)',
      'Servir (ayudar, hacer un trabajo importante para) la nación (si es necesario)',
      'Ser leal a los Estados Unidos',
    ],
  },
  68: {
    q: '¿Cómo pueden las personas convertirse en ciudadanos de los Estados Unidos?',
    a: [
      'Nacer en los Estados Unidos, bajo las condiciones establecidas por la Enmienda 14',
      'Naturalizarse',
      'Derivar (obtener) la ciudadanía (bajo las condiciones establecidas por el Congreso)',
    ],
  },
  69: {
    q: '¿Cuáles son dos ejemplos de participación cívica en los Estados Unidos?',
    a: [
      'Votar',
      'Postularse para un cargo',
      'Unirse a un partido político',
      'Ayudar en una campaña',
      'Unirse a un grupo cívico',
      'Unirse a un grupo comunitario',
      'Darle su opinión (sobre un tema) a un funcionario electo',
      'Comunicarse con los funcionarios electos',
      'Apoyar u oponerse a un tema o una política',
      'Escribirle a un periódico',
    ],
  },
  70: {
    q: '¿Cuál es una forma en que los estadounidenses pueden servir a su país?',
    a: [
      'Votar',
      'Pagar impuestos',
      'Obedecer la ley',
      'Servir en las fuerzas armadas',
      'Postularse para un cargo',
      'Trabajar para el gobierno local, estatal o federal',
    ],
  },
  71: {
    q: '¿Por qué es importante pagar los impuestos federales?',
    a: [
      'Lo exige la ley',
      'Todas las personas pagan para financiar el gobierno federal',
      'Lo exige la Constitución (de los EE. UU.) (Enmienda 16)',
      'Es un deber cívico',
    ],
  },
  72: {
    q: 'Es importante que todos los hombres de 18 a 25 años se inscriban en el Servicio Selectivo. Mencione una razón.',
    a: [
      'Lo exige la ley',
      'Es un deber cívico',
      'Hace que el reclutamiento militar sea justo, si es necesario',
    ],
  },

  // ===== Historia estadounidense — A: Período colonial e independencia (73–89)
  73: {
    q: 'Los colonos vinieron a América por muchas razones. Mencione una.',
    a: [
      'Libertad',
      'Libertad política',
      'Libertad religiosa',
      'Oportunidades económicas',
      'Escapar de la persecución',
    ],
  },
  74: {
    q: '¿Quiénes vivían en América antes de que llegaran los europeos?',
    a: ['Los indígenas americanos (indios americanos)', 'Los nativos americanos'],
  },
  75: {
    q: '¿Qué grupo de personas fue traído a la fuerza y vendido como esclavos?',
    a: ['Los africanos', 'Personas de África'],
  },
  76: {
    q: '¿Qué guerra pelearon los estadounidenses para ganar la independencia de Gran Bretaña?',
    a: [
      'La Revolución estadounidense',
      'La Guerra Revolucionaria (estadounidense)',
      'La Guerra de Independencia (de los Estados Unidos)',
    ],
  },
  77: {
    q: 'Mencione una razón por la que los estadounidenses declararon su independencia de Gran Bretaña.',
    a: [
      'Impuestos altos',
      'Impuestos sin representación',
      'Los soldados británicos se alojaban en las casas de los estadounidenses (alojamiento, acuartelamiento)',
      'No tenían autogobierno',
      'La Masacre de Boston',
      'El Motín del Té de Boston (Ley del Té)',
      'La Ley del Timbre (Stamp Act)',
      'La Ley del Azúcar (Sugar Act)',
      'Las Leyes Townshend',
      'Las Leyes Intolerables (Coercitivas)',
    ],
  },
  78: {
    q: '¿Quién escribió la Declaración de Independencia?',
    a: ['(Thomas) Jefferson'],
  },
  79: {
    q: '¿Cuándo se adoptó la Declaración de Independencia?',
    a: ['El 4 de julio de 1776'],
  },
  80: {
    q: 'La Revolución estadounidense tuvo muchos eventos importantes. Mencione uno.',
    a: [
      '(La Batalla de) Bunker Hill',
      'La Declaración de Independencia',
      'Washington cruza el río Delaware (Batalla de Trenton)',
      '(La Batalla de) Saratoga',
      'Valley Forge (el campamento)',
      '(La Batalla de) Yorktown (la rendición británica en Yorktown)',
    ],
  },
  81: {
    q: 'Hubo 13 estados originales. Mencione cinco.',
    a: [
      'New Hampshire',
      'Massachusetts',
      'Rhode Island',
      'Connecticut',
      'New York (Nueva York)',
      'New Jersey (Nueva Jersey)',
      'Pennsylvania (Pensilvania)',
      'Delaware',
      'Maryland',
      'Virginia',
      'North Carolina (Carolina del Norte)',
      'South Carolina (Carolina del Sur)',
      'Georgia',
    ],
  },
  82: {
    q: '¿Qué documento fundador se escribió en 1787?',
    a: ['La Constitución (de los EE. UU.)'],
  },
  83: {
    q: 'Los Documentos Federalistas (Federalist Papers) apoyaron la aprobación de la Constitución de los EE. UU. Mencione a uno de sus autores.',
    a: ['(James) Madison', '(Alexander) Hamilton', '(John) Jay', 'Publius'],
  },
  84: {
    q: '¿Por qué fueron importantes los Documentos Federalistas (Federalist Papers)?',
    a: [
      'Ayudaron a la gente a entender la Constitución (de los EE. UU.).',
      'Apoyaron la aprobación de la Constitución (de los EE. UU.).',
    ],
  },
  85: {
    q: 'Benjamin Franklin es famoso por muchas cosas. Mencione una.',
    a: [
      'Fundó las primeras bibliotecas públicas gratuitas',
      'Primer Director General de Correos de los Estados Unidos',
      'Ayudó a escribir la Declaración de Independencia',
      'Inventor',
      'Diplomático de los EE. UU.',
    ],
  },
  86: {
    q: 'George Washington es famoso por muchas cosas. Mencione una.',
    a: [
      '"Padre de Nuestra Patria"',
      'Primer presidente de los Estados Unidos',
      'General del Ejército Continental',
      'Presidente de la Convención Constitucional',
    ],
  },
  87: {
    q: 'Thomas Jefferson es famoso por muchas cosas. Mencione una.',
    a: [
      'Autor de la Declaración de Independencia',
      'Tercer presidente de los Estados Unidos',
      'Duplicó el tamaño de los Estados Unidos (la Compra de Luisiana)',
      'Primer Secretario de Estado',
      'Fundó la Universidad de Virginia',
      'Autor del Estatuto de Virginia sobre la Libertad Religiosa',
    ],
  },
  88: {
    q: 'James Madison es famoso por muchas cosas. Mencione una.',
    a: [
      '"Padre de la Constitución"',
      'Cuarto presidente de los Estados Unidos',
      'Presidente durante la Guerra de 1812',
      'Uno de los autores de los Documentos Federalistas (Federalist Papers)',
    ],
  },
  89: {
    q: 'Alexander Hamilton es famoso por muchas cosas. Mencione una.',
    a: [
      'Primer Secretario del Tesoro',
      'Uno de los autores de los Documentos Federalistas (Federalist Papers)',
      'Ayudó a establecer el Primer Banco de los Estados Unidos',
      'Asistente (ayudante) del General George Washington',
      'Miembro del Congreso Continental',
    ],
  },

  // ===== Historia estadounidense — B: Los años 1800 (90–99)
  90: {
    q: '¿Qué territorio le compró Estados Unidos a Francia en 1803?',
    a: ['El Territorio de Luisiana', 'Luisiana'],
  },
  91: {
    q: 'Mencione una guerra en la que peleó Estados Unidos en los años 1800.',
    a: [
      'La Guerra de 1812',
      'La Guerra entre México y Estados Unidos',
      'La Guerra Civil',
      'La Guerra Hispano-Estadounidense',
    ],
  },
  92: {
    q: 'Mencione la guerra de los EE. UU. entre el Norte y el Sur.',
    a: ['La Guerra Civil'],
  },
  93: {
    q: 'La Guerra Civil tuvo muchos eventos importantes. Mencione uno.',
    a: [
      '(La Batalla de) Fort Sumter',
      'La Proclamación de Emancipación',
      '(La Batalla de) Vicksburg',
      '(La Batalla de) Gettysburg',
      'La Marcha de Sherman',
      '(La rendición en) Appomattox',
      '(La Batalla de) Antietam/Sharpsburg',
      'Lincoln fue asesinado.',
    ],
  },
  94: {
    q: 'Abraham Lincoln es famoso por muchas cosas. Mencione una.',
    a: [
      'Liberó a los esclavos (Proclamación de Emancipación)',
      'Salvó (o preservó) la Unión',
      'Dirigió a los Estados Unidos durante la Guerra Civil',
      'Presidente número 16 de los Estados Unidos',
      'Pronunció el Discurso de Gettysburg',
    ],
  },
  95: {
    q: '¿Qué hizo la Proclamación de Emancipación?',
    a: [
      'Liberó a los esclavos',
      'Liberó a los esclavos de la Confederación',
      'Liberó a los esclavos de los estados confederados',
      'Liberó a los esclavos de la mayoría de los estados del Sur',
    ],
  },
  96: {
    q: '¿Qué guerra de los EE. UU. terminó con la esclavitud?',
    a: ['La Guerra Civil'],
  },
  97: {
    q: '¿Qué enmienda dice que todas las personas nacidas o naturalizadas en los Estados Unidos, y sujetas a su jurisdicción, son ciudadanos de los EE. UU.?',
    a: ['La Enmienda 14'],
  },
  98: {
    q: '¿Cuándo obtuvieron todos los hombres el derecho a votar?',
    a: [
      'Después de la Guerra Civil',
      'Durante la Reconstrucción',
      '(Con la) Enmienda 15',
      '1870',
    ],
  },
  99: {
    q: 'Mencione a una líder del movimiento por los derechos de la mujer en los años 1800.',
    a: [
      'Susan B. Anthony',
      'Elizabeth Cady Stanton',
      'Sojourner Truth',
      'Harriet Tubman',
      'Lucretia Mott',
      'Lucy Stone',
    ],
  },

  // ===== Historia estadounidense — C: Historia reciente y otra información histórica importante (100–118)
  100: {
    q: 'Mencione una guerra en la que peleó Estados Unidos en los años 1900.',
    a: [
      'La Primera Guerra Mundial',
      'La Segunda Guerra Mundial',
      'La Guerra de Corea',
      'La Guerra de Vietnam',
      'La Guerra del Golfo (Pérsico)',
    ],
  },
  101: {
    q: '¿Por qué entró Estados Unidos en la Primera Guerra Mundial?',
    a: [
      'Porque Alemania atacó barcos (civiles) de los EE. UU.',
      'Para apoyar a las Potencias Aliadas (Inglaterra, Francia, Italia y Rusia)',
      'Para oponerse a las Potencias Centrales (Alemania, Austria-Hungría, el Imperio otomano y Bulgaria)',
    ],
  },
  102: {
    q: '¿Cuándo obtuvieron todas las mujeres el derecho a votar?',
    a: ['1920', 'Después de la Primera Guerra Mundial', '(Con la) Enmienda 19'],
  },
  103: {
    q: '¿Qué fue la Gran Depresión?',
    a: ['La recesión económica más larga de la historia moderna'],
  },
  104: {
    q: '¿Cuándo empezó la Gran Depresión?',
    a: ['El Gran Colapso (Crac) (1929)', 'La caída de la bolsa de valores de 1929'],
  },
  105: {
    q: '¿Quién fue presidente durante la Gran Depresión y la Segunda Guerra Mundial?',
    a: ['(Franklin) Roosevelt'],
  },
  106: {
    q: '¿Por qué entró Estados Unidos en la Segunda Guerra Mundial?',
    a: [
      '(El bombardeo de) Pearl Harbor',
      'Los japoneses atacaron Pearl Harbor',
      'Para apoyar a las Potencias Aliadas (Inglaterra, Francia y Rusia)',
      'Para oponerse a las Potencias del Eje (Alemania, Italia y Japón)',
    ],
  },
  107: {
    q: 'Dwight Eisenhower es famoso por muchas cosas. Mencione una.',
    a: [
      'General durante la Segunda Guerra Mundial',
      'Presidente al final de (durante) la Guerra de Corea',
      'Presidente número 34 de los Estados Unidos',
      'Firmó la Ley Federal de Ayuda para Carreteras de 1956 (creó el Sistema Interestatal de autopistas)',
    ],
  },
  108: {
    q: '¿Quién fue el principal rival de los Estados Unidos durante la Guerra Fría?',
    a: ['La Unión Soviética', 'La URSS (USSR)', 'Rusia'],
  },
  109: {
    q: 'Durante la Guerra Fría, ¿cuál fue una de las principales preocupaciones de los Estados Unidos?',
    a: ['El comunismo', 'La guerra nuclear'],
  },
  110: {
    q: '¿Por qué entró Estados Unidos en la Guerra de Corea?',
    a: ['Para detener la expansión del comunismo'],
  },
  111: {
    q: '¿Por qué entró Estados Unidos en la Guerra de Vietnam?',
    a: ['Para detener la expansión del comunismo'],
  },
  112: {
    q: '¿Qué hizo el movimiento por los derechos civiles?',
    a: ['Luchó para acabar con la discriminación racial'],
  },
  113: {
    q: 'Martin Luther King, Jr. es famoso por muchas cosas. Mencione una.',
    a: [
      'Luchó por los derechos civiles',
      'Trabajó por la igualdad de todos los estadounidenses',
      'Trabajó para que las personas "no fueran juzgadas por el color de su piel, sino por su carácter"',
    ],
  },
  114: {
    q: '¿Por qué entró Estados Unidos en la Guerra del Golfo Pérsico?',
    a: ['Para sacar a las fuerzas armadas iraquíes de Kuwait'],
  },
  115: {
    q: '¿Qué evento importante ocurrió el 11 de septiembre de 2001 en los Estados Unidos?',
    a: [
      'Terroristas atacaron los Estados Unidos',
      'Terroristas tomaron el control de dos aviones y los estrellaron contra el World Trade Center en la ciudad de Nueva York',
      'Terroristas tomaron el control de un avión y lo estrellaron contra el Pentágono en Arlington, Virginia',
      'Terroristas tomaron el control de un avión que originalmente iba hacia Washington, D.C., y se estrelló en un campo en Pensilvania',
    ],
  },
  116: {
    q: 'Mencione un conflicto militar de los EE. UU. después de los ataques del 11 de septiembre de 2001.',
    a: ['La Guerra (Global) contra el Terrorismo', 'La Guerra en Afganistán', 'La Guerra en Irak'],
  },
  117: {
    q: 'Mencione una tribu indígena americana de los Estados Unidos.',
    a: [
      'Apache',
      'Blackfeet',
      'Cayuga',
      'Cherokee',
      'Cheyenne',
      'Chippewa',
      'Choctaw',
      'Creek',
      'Crow',
      'Hopi',
      'Huron (Hurón)',
      'Inupiat',
      'Lakota',
      'Mohawk',
      'Mohegan',
      'Navajo',
      'Oneida',
      'Onondaga',
      'Pueblo',
      'Seminole',
      'Seneca',
      'Shawnee',
      'Sioux',
      'Teton',
      'Tuscarora',
    ],
    note: 'Para ver la lista completa de tribus, visite bia.gov.',
  },
  118: {
    q: 'Mencione un ejemplo de una innovación estadounidense.',
    a: [
      'El foco (la bombilla)',
      'El automóvil (los carros, el motor de combustión interna)',
      'Los rascacielos',
      'El avión',
      'La línea de ensamblaje (producción en cadena)',
      'La llegada a la Luna',
      'El circuito integrado (CI)',
    ],
  },

  // ===== Símbolos y días festivos — A: Símbolos (119–124)
  119: {
    q: '¿Cuál es la capital de los Estados Unidos?',
    a: ['Washington, D.C.'],
  },
  120: {
    q: '¿Dónde está la Estatua de la Libertad?',
    a: [
      '(El puerto de) Nueva York',
      'La Isla de la Libertad (Liberty Island)',
      'Nueva Jersey',
      'Cerca de la ciudad de Nueva York',
      'En el (río) Hudson',
    ],
    note: 'USCIS acepta (el puerto de) Nueva York y la Isla de la Libertad, y también Nueva Jersey, cerca de la ciudad de Nueva York y en el (río) Hudson.',
  },
  121: {
    q: '¿Por qué la bandera tiene 13 franjas?',
    a: [
      '(Porque hubo) 13 colonias originales',
      '(Porque las franjas) representan las colonias originales',
    ],
  },
  122: {
    q: '¿Por qué la bandera tiene 50 estrellas?',
    a: [
      '(Porque hay) una estrella por cada estado',
      '(Porque) cada estrella representa un estado',
      '(Porque hay) 50 estados',
    ],
  },
  123: {
    q: '¿Cómo se llama el himno nacional?',
    a: ['The Star-Spangled Banner (La bandera adornada de estrellas)'],
  },
  124: {
    q: 'El primer lema de la Nación fue "E Pluribus Unum". ¿Qué significa?',
    a: ['De muchos, uno', 'Todos nos convertimos en uno'],
  },

  // ===== Símbolos y días festivos — B: Días festivos (125–128)
  125: {
    q: '¿Qué es el Día de la Independencia?',
    a: [
      'Un día festivo para celebrar la independencia de los EE. UU. (de Gran Bretaña)',
      'El cumpleaños del país',
    ],
  },
  126: {
    q: 'Mencione tres días festivos nacionales de los EE. UU.',
    a: [
      'Día de Año Nuevo',
      'Día de Martin Luther King, Jr.',
      'Día de los Presidentes (Natalicio de Washington)',
      'Día de los Caídos (Memorial Day)',
      'Juneteenth (Día de la Liberación)',
      'Día de la Independencia',
      'Día del Trabajo',
      'Día de la Raza (Día de Colón)',
      'Día de los Veteranos',
      'Día de Acción de Gracias',
      'Día de Navidad',
    ],
  },
  127: {
    q: '¿Qué es el Día de los Caídos (Memorial Day)?',
    a: ['Un día festivo para honrar a los soldados que murieron en el servicio militar'],
  },
  128: {
    q: '¿Qué es el Día de los Veteranos?',
    a: [
      'Un día festivo para honrar a las personas de las fuerzas armadas (de los EE. UU.)',
      'Un día festivo para honrar a las personas que han servido (en las fuerzas armadas de los EE. UU.)',
    ],
  },
};
