// ===================================
// MISSION: IMPOSSIBLE - LAB SAFETY
// Language layer — English and Latin American Spanish
//
// One flat key space, two dictionaries. Keys are dotted for grouping only;
// there is no nesting to walk, because a missing branch and a missing leaf
// should fail the same way: fall back to English, then to the key itself.
//
// SPANISH VARIETY
// The audience is Spanish-speaking students in United States schools, the
// large majority of whom are of Mexican and Central American origin. The copy
// is therefore neutral Latin American Spanish (es-419), not Iberian:
//   · "tú" and "ustedes" throughout — never "vosotros"
//   · pan-regional safety terms (gafas de seguridad, bata, ducha de seguridad)
//   · no Peninsular-only vocabulary
// Ranks and job titles are phrased so they do not assume a student's gender —
// "DIRECCIÓN DE SEGURIDAD" rather than "DIRECTOR", "AGENTE" and "DOCENTE"
// which are already common-gender.
//
// Scenario copy lives here for Spanish only. English scenario copy stays in
// questions.js, which remains the canonical description of the mission —
// structure, correct answers and option order all come from there, and this
// file overlays nothing but words.
// ===================================

const I18N_SUPPORTED = ['en', 'es'];
const I18N_FALLBACK = 'en';
const I18N_STORAGE_KEY = 'labSafetyLang';

// Date formatting only. 'es-419' is not resolvable in every engine, so the
// certificate uses a concrete Latin American locale.
const I18N_LOCALES = { en: undefined, es: 'es-MX' };

const I18N_LANG_NAMES = { en: 'English', es: 'Español' };

// ===================================
// STRINGS
// ===================================

const I18N_STRINGS = {

en: {
    'doc.title': 'Mission: Impossible — Laboratory Protocol',
    'doc.titleTeacher': 'Set up for your class — Laboratory Safety Protocol',

    // --- language selector ---
    'lang.legend': 'LANGUAGE / IDIOMA',
    'lang.en': 'English',
    'lang.es': 'Español',
    // Each option names itself in its own language, in both dictionaries. A
    // student who cannot read the current one still has to be able to find the
    // way out, so these two are deliberately NOT translated.
    'lang.switchTo.en': 'Display this mission in English',
    'lang.switchTo.es': 'Mostrar esta misión en español',

    // --- audio ---
    'audio.music': 'Toggle music',
    'audio.sfx': 'Toggle sound effects',

    // --- intro ---
    'intro.rec': '● REC',
    'intro.classified': 'CLASSIFIED — EYES ONLY',
    'intro.subtitle': 'LABORATORY PROTOCOL',
    'intro.identify': 'AGENT IDENTIFICATION REQUIRED',
    'intro.codename': 'CODENAME:',
    'intro.codenamePlaceholder': 'Enter codename...',
    'intro.accept': 'ACCEPT MISSION',
    'intro.teacherLink': 'For teachers — set up this activity for your class',

    // --- briefing ---
    'briefing.header': 'MISSION BRIEFING',
    'briefing.dossier': 'MISSION DOSSIER — CLEARANCE LEVEL: OMEGA',
    'briefing.line1': 'Intelligence indicates a rogue scientist is developing hazardous compounds in Lab Omega-7.',
    'briefing.line2': 'Your mission, should you choose to accept it, is to navigate the facility while adhering to strict safety protocols.',
    'briefing.line3': 'Any deviation could trigger catastrophic chain reactions.',
    'briefing.selfDestruct': 'This message will self-destruct in',
    'briefing.seconds': 'seconds...',
    'briefing.skip': 'SKIP BRIEFING ▸',

    // --- violation sequence ---
    'violation.skip': 'SKIP ▸',
    'violation.caption': 'LAB OMEGA-7 · BENCH 3 · ARCHIVE FOOTAGE',
    'violation.title': '⚠ PROTOCOL VIOLATION — THERMAL EJECTION',
    'violation.body': 'Water was added to concentrated acid. Water is <strong>less dense</strong>, so it floats instead of mixing — the whole heat of dilution is released in that thin surface layer, which flashes to steam and ejects boiling acid out of the beaker.',
    'violation.never': '✗ NEVER',
    'violation.neverWhat': 'water → acid',
    'violation.always': '✓ ALWAYS',
    'violation.alwaysWhat': 'acid → water, slowly',
    'violation.continue': 'CONTINUE ▸',

    // --- clearance select ---
    'select.title': 'SELECT CLEARANCE LEVEL',
    'select.subtitle': 'Clearance sets how much time you get per scenario and whether intel support is available. Every agent starts on zero — your rank is earned from accuracy alone.',
    'select.perScenarioSuffix': 'per scenario',
    'select.intelOne': '{count} intel request',
    'select.intelMany': '{count} intel requests',
    'select.intelNone': 'No intel requests',
    'select.button': 'SELECT',
    'select.aria': 'Select {tier} clearance',

    // --- HUD ---
    'hud.agent': 'AGENT:',
    'hud.clearance': 'CLEARANCE:',
    'hud.scenario': 'SCENARIO:',
    'hud.alert': 'ALERT:',
    'hud.points': 'POINTS:',
    'hud.streak': 'STREAK:',
    'alert.secure': 'SECURE',
    'alert.elevated': 'ELEVATED',
    'alert.critical': 'CRITICAL',

    // --- scenario stage ---
    'stage.threat': 'THREAT:',
    'stage.situation': 'SITUATION ANALYSIS',
    'stage.timeRemaining': 'TIME REMAINING',
    'stage.hint': 'REQUEST INTEL',
    'stage.hintCost': '−{cost} pts',
    'threat.low': 'LOW',
    'threat.medium': 'MEDIUM',
    'threat.high': 'HIGH',

    // --- feedback dialog ---
    'feedback.correctTitle': '✅ PROTOCOL EXECUTED',
    'feedback.wrongTitle': '❌ PROTOCOL BREACH',
    'feedback.timeoutTitle': '⏱️ MISSION COMPROMISED',
    'feedback.correctScore': '+{points} POINTS · STREAK {streak}',
    'feedback.wrongScore': '−{points} POINTS · STREAK RESET',
    'feedback.timeoutScore': 'TIME EXPIRED · −{points} POINTS',
    'feedback.timeoutWhy': 'No protocol was executed. In a real incident, hesitation is itself the hazard — decide, then act.',
    'feedback.noResponse': 'No response',
    'feedback.clockRanOut': 'The clock ran out',
    'feedback.yourChoiceCorrect': 'YOUR CHOICE — CORRECT',
    'feedback.yourChoice': 'YOUR CHOICE',
    'feedback.correctProtocol': 'CORRECT PROTOCOL',
    'feedback.whyFailed': 'WHY THAT FAILS',
    'feedback.fieldNotes': 'FIELD NOTES',
    'feedback.next': 'NEXT CASE ➤',
    'feedback.finish': 'MISSION COMPLETE ➤',

    // --- results ---
    'results.status': 'MISSION STATUS',
    'results.success': 'MISSION SUCCESS',
    'results.failed': 'MISSION FAILED',
    'results.finalLevel': 'FINAL CLEARANCE LEVEL',
    'results.points': 'SECURITY POINTS',
    'results.executed': 'PROTOCOLS EXECUTED',
    'results.breaches': 'BREACH COUNT',
    'results.commendations': 'COMMENDATIONS EARNED',
    'results.noCommendations': 'No commendations earned this mission',
    'results.debriefing': 'DEBRIEFING NOTES',
    'results.certificate': 'VIEW CERTIFICATE',
    'results.review': 'REVIEW PROTOCOLS',
    'results.newMission': 'NEW MISSION',
    'results.badgeEarned': 'COMMENDATION EARNED',

    'debrief.100': 'OUTSTANDING. Every protocol executed correctly. You are cleared for advanced laboratory operations.',
    'debrief.90': 'EXCELLENT WORK. Strong command of laboratory safety. Review the one or two misses to reach a perfect record.',
    'debrief.pass': 'MISSION PASSED. Core protocols are sound, but emergency response needs sharpening. Use REVIEW PROTOCOLS on the scenarios you lost.',
    'debrief.50': 'BELOW STANDARD. You grasp the basics but not the emergency procedures that matter most. Review every breach before your next attempt.',
    'debrief.fail': 'CRITICAL DEFICIENCIES. The gaps in these answers would cause real injury in a real laboratory. Mandatory retraining before lab clearance.',

    // --- protocol review ---
    'review.header': 'PROTOCOL REVIEW',
    'review.summary': '{correct}/{total} PASSED · {percent}%',
    'review.passed': 'PASSED',
    'review.noResponse': 'NO RESPONSE',
    'review.breach': 'BREACH',
    'review.yourAnswer': 'YOUR ANSWER:',
    'review.youChose': 'YOU CHOSE:',
    'review.correct': 'CORRECT PROTOCOL:',
    'review.back': 'BACK TO DEBRIEFING',

    // --- certificate ---
    'cert.supervisor': 'SUPERVISING OFFICER',
    'cert.instructorPlaceholder': 'Instructor name...',
    'cert.setByTeacher': 'Set by your teacher',
    'cert.download': '⭳ DOWNLOAD PDF',
    'cert.print': 'PRINT',
    'cert.back': 'BACK',
    'cert.sealCertified': 'CERTIFIED',
    'cert.issuer': 'IMPOSSIBLE MISSION FORCE · SCIENCE DIVISION',
    'cert.issuerPdf': 'IMPOSSIBLE MISSION FORCE  •  SCIENCE DIVISION',
    'cert.titlePass': 'Certificate of Laboratory Safety',
    'cert.titleFail': 'Laboratory Safety — Retraining Notice',
    'cert.titleFailPdf': 'Laboratory Safety Retraining Notice',
    'cert.preamblePass': 'This certifies that operative',
    'cert.preambleFail': 'This records that operative',
    'cert.bodyPass': 'has completed the Laboratory Protocol mission, demonstrating command of personal protective equipment, hazard identification, emergency response, chemical handling and laboratory conduct at {tier} clearance.',
    'cert.bodyFail': 'attempted the Laboratory Protocol mission at {tier} clearance and did not reach the {threshold}% standard required for laboratory clearance. Retraining and a further attempt are required.',
    'cert.bodyPassPdf1': 'has completed the Laboratory Protocol mission, demonstrating command of personal',
    'cert.bodyPassPdf2': 'protective equipment, hazard identification, emergency response, chemical handling',
    'cert.bodyPassPdf3': 'and laboratory conduct at {tier} clearance.',
    'cert.bodyFailPdf1': 'attempted the Laboratory Protocol mission at {tier} clearance and did not reach',
    'cert.bodyFailPdf2': 'the {threshold}% standard required for laboratory clearance.',
    'cert.bodyFailPdf3': 'Retraining and a further attempt are required.',
    'cert.successRate': 'SUCCESS RATE',
    'cert.protocolsPassed': 'PROTOCOLS PASSED',
    'cert.clearance': 'CLEARANCE',
    'cert.rankConferred': 'RANK CONFERRED',
    'cert.signatureRole': 'Chief Lab Safety Officer · IMF Science Division',
    'cert.signatureRolePdf': 'Chief Lab Safety Officer • IMF Science Division',
    'cert.dateOfIssue': 'Date of issue',
    'cert.footer': 'Virtual Lab (https://virtuallab.az) • Laboratory Safety Protocol simulation',
    'cert.filename': 'lab-safety-certificate',
    'cert.bandHonours': 'HONOURS',
    'cert.bandMerit': 'MERIT',
    'cert.bandPass': 'PASS',
    'cert.bandFail': 'NOT CLEARED',
    'cert.retrain': 'RETRAIN',

    // --- difficulty tiers ---
    'tier.recruit': 'RECRUIT',
    'tier.recruit.blurb': 'Longest response window. Two intel requests available.',
    'tier.field': 'FIELD AGENT',
    'tier.field.blurb': 'Standard window. One intel request available.',
    'tier.specialops': 'SPECIAL OPS',
    'tier.specialops.blurb': 'Short window. No intel support.',
    'tier.director': 'IMF DIRECTOR',
    'tier.director.blurb': 'Minimum window. No intel support. Command standard.',

    // --- ranks ---
    'rank.100': 'DIRECTOR OF LABORATORY SAFETY',
    'rank.90': 'SPECIAL AGENT — HAZMAT DIVISION',
    'rank.70': 'FIELD AGENT — LAB PROTOCOL',
    'rank.50': 'PROBATIONARY OPERATIVE',
    'rank.0': 'RECRUIT — RETRAINING REQUIRED',

    // --- badges ---
    'badge.speed': 'SPEED OPERATIVE',
    'badge.speed.desc': '5 protocols answered correctly, promptly and deliberately',
    'badge.perfect': 'PERFECT PROTOCOL',
    'badge.perfect.desc': 'All scenarios executed correctly',
    'badge.safety': 'SAFETY SPECIALIST',
    'badge.safety.desc': 'Every emergency scenario handled correctly',
    'badge.streak': 'STREAK MASTER',
    'badge.streak.desc': '5 consecutive correct protocols',
    'badge.unaided': 'NO BACKUP NEEDED',
    'badge.unaided.desc': 'Mission passed without a single intel request',

    // --- scene artwork labels (kept short: they sit inside a 320-wide viewBox) ---
    'art.ppe.title': 'ENTRY REQUIREMENTS — ALL FOUR',
    'art.ppe.goggles': 'GOGGLES',
    'art.ppe.coat': 'LAB COAT',
    'art.ppe.gloves': 'GLOVES',
    'art.ppe.shoes': 'CLOSED SHOES',
    'art.hazard.container': 'UNMARKED CONTAINER',
    'art.hazard.plate': 'READ THE PICTOGRAM',
    'art.fire.sleeve': 'SLEEVE ALIGHT',
    'art.fire.shower': 'SAFETY SHOWER',
    'art.spill.plate': 'SPREADING · UNIDENTIFIED',
    'art.dilution.title': 'ORDER OF ADDITION',
    'art.dilution.acid': 'ACID',
    'art.dilution.water': 'WATER · LARGE VOLUME',
    'art.cleanup.station': 'YOUR STATION',
    'art.cleanup.routes': 'WASTE ROUTES',
    'art.cleanup.glass': 'GLASS',
    'art.cleanup.aqueous': 'AQUEOUS',
    'art.cleanup.sharps': 'SHARPS',
    'art.storage.flam': 'FLAM.',
    'art.storage.cabinet': 'APPROVED VENTED CABINET',
    'art.storage.ignition': 'IGNITION SOURCE',
    'art.storage.apart': 'KEEP APART',
    'art.access.authorised': 'AUTHORISED',
    'art.access.supervisor': 'SUPERVISOR',
    'art.conduct.hotwork': 'HOT WORK IN PROGRESS',
    'art.conduct.hot': 'HOT',
    'art.conduct.exit': 'EXIT',
    'art.conduct.plate': 'ALL STATIONS IN USE · HOT',
    'art.bio.microscope': 'MICROSCOPE',
    'art.bio.sample': 'POND WATER SAMPLE',
    'art.bio.plate': 'LIVE MICROBES',

    // --- teacher setup page ---
    'tp.eyebrow': 'Impossible Mission Force · Science Division',
    'tp.title': 'Set up this activity for your class',
    'tp.lede': 'Put your name on every certificate your students earn — without asking them to type it. Enter it once here and share the link you get back.',
    'tp.step1': 'Your name, as it should appear',
    'tp.nameLabel': 'Supervising officer',
    'tp.namePlaceholder': 'e.g. Ms. Rivera',
    'tp.previewLabel': 'On the certificate it will read:',
    'tp.step2': 'Share this link with your students',
    'tp.linkAria': 'Your class link',
    'tp.copy': 'Copy link',
    'tp.copied': 'Copied. Paste it wherever you post work.',
    'tp.copyManual': 'Press Ctrl+C (Cmd+C on a Mac) to copy the selected link.',
    'tp.copySelect': 'Select the link above and copy it.',
    'tp.pasteHint': 'Paste it into Google Classroom, Canvas, or wherever you post work. Anyone who opens it gets your name locked onto their certificate — students cannot change it.',
    'tp.openStudent': 'Open as a student',
    'tp.previewPdf': 'Preview the certificate PDF',
    'tp.langStep': 'Language for your students',
    'tp.langHint': 'The link opens the simulation in the language you pick here. Students can still switch it themselves on the first screen.',
    'tp.langAuto': 'Let students choose',
    'tp.noteTitle': 'Worth knowing',
    'tp.note1': 'Nothing is stored on a server. The name travels in the link itself, so it works on any device, in any browser, with no sign-in.',
    'tp.note2': 'Bookmark this page to make a fresh link any time — one per section if you want certificates to come back sorted by class.',
    'tp.note3': 'Students still enter their own codename at the start; that is the name the certificate is issued to.',
    'tp.note4': 'The old link keeps working if you have already shared one.',
    'tp.back': '← Back to the simulation',
    'tp.foot': 'Virtual Lab · Laboratory Safety Protocol simulation',
    'tp.warnChars': 'The certificate cannot print {chars}, so it will read “{rendered}”. Try the nearest spelling in plain letters.',
    'tp.warnCharsSome': 'some characters',
    'tp.warnLong': 'That is too long for the signature line — it will run past it. Try a shorter form, such as an initial instead of a first name.',
    'tp.sampleStudent': 'SAMPLE STUDENT'
},

es: {
    'doc.title': 'Misión: Imposible — Protocolo de Laboratorio',
    'doc.titleTeacher': 'Configura la actividad para tu clase — Protocolo de Seguridad de Laboratorio',

    // --- selector de idioma ---
    'lang.legend': 'LANGUAGE / IDIOMA',
    'lang.en': 'English',
    'lang.es': 'Español',
    // Idénticas a las del inglés a propósito: cada opción se nombra en su
    // propio idioma, para que se pueda salir de un idioma que no se lee.
    'lang.switchTo.en': 'Display this mission in English',
    'lang.switchTo.es': 'Mostrar esta misión en español',

    // --- audio ---
    'audio.music': 'Activar o desactivar la música',
    'audio.sfx': 'Activar o desactivar los efectos de sonido',

    // --- introducción ---
    'intro.rec': '● GRAB',
    'intro.classified': 'CLASIFICADO — SOLO LECTURA AUTORIZADA',
    'intro.subtitle': 'PROTOCOLO DE LABORATORIO',
    'intro.identify': 'SE REQUIERE IDENTIFICACIÓN DEL AGENTE',
    'intro.codename': 'NOMBRE CLAVE:',
    'intro.codenamePlaceholder': 'Escribe tu nombre clave...',
    'intro.accept': 'ACEPTAR LA MISIÓN',
    'intro.teacherLink': 'Para docentes — configura esta actividad para tu clase',

    // --- informe ---
    'briefing.header': 'INFORME DE LA MISIÓN',
    'briefing.dossier': 'EXPEDIENTE DE LA MISIÓN — NIVEL DE ACCESO: OMEGA',
    'briefing.line1': 'La inteligencia indica que una persona científica renegada desarrolla compuestos peligrosos en el Laboratorio Omega-7.',
    'briefing.line2': 'Tu misión, si decides aceptarla, es recorrer las instalaciones cumpliendo estrictamente los protocolos de seguridad.',
    'briefing.line3': 'Cualquier desviación podría desencadenar reacciones en cadena catastróficas.',
    'briefing.selfDestruct': 'Este mensaje se autodestruirá en',
    'briefing.seconds': 'segundos...',
    'briefing.skip': 'OMITIR EL INFORME ▸',

    // --- secuencia de la violación ---
    'violation.skip': 'OMITIR ▸',
    'violation.caption': 'LAB OMEGA-7 · MESA 3 · GRABACIÓN DE ARCHIVO',
    'violation.title': '⚠ VIOLACIÓN DEL PROTOCOLO — PROYECCIÓN TÉRMICA',
    'violation.body': 'Se agregó agua al ácido concentrado. El agua es <strong>menos densa</strong>, así que flota en lugar de mezclarse: todo el calor de dilución se libera en esa capa delgada de la superficie, que se convierte en vapor de golpe y lanza ácido hirviendo fuera del vaso.',
    'violation.never': '✗ NUNCA',
    'violation.neverWhat': 'agua → ácido',
    'violation.always': '✓ SIEMPRE',
    'violation.alwaysWhat': 'ácido → agua, despacio',
    'violation.continue': 'CONTINUAR ▸',

    // --- selección de nivel ---
    'select.title': 'ELIGE TU NIVEL DE ACCESO',
    'select.subtitle': 'El nivel de acceso define cuánto tiempo tienes en cada escenario y si puedes pedir información. Todo agente empieza en cero: tu rango se gana solo con aciertos.',
    'select.perScenarioSuffix': 'por escenario',
    'select.intelOne': '{count} consulta de información',
    'select.intelMany': '{count} consultas de información',
    'select.intelNone': 'Sin consultas de información',
    'select.button': 'ELEGIR',
    'select.aria': 'Elegir el nivel de acceso {tier}',

    // --- HUD ---
    'hud.agent': 'AGENTE:',
    'hud.clearance': 'ACCESO:',
    'hud.scenario': 'ESCENARIO:',
    'hud.alert': 'ALERTA:',
    'hud.points': 'PUNTOS:',
    'hud.streak': 'RACHA:',
    'alert.secure': 'SEGURO',
    'alert.elevated': 'ELEVADA',
    'alert.critical': 'CRÍTICA',

    // --- escenario ---
    'stage.threat': 'AMENAZA:',
    'stage.situation': 'ANÁLISIS DE LA SITUACIÓN',
    'stage.timeRemaining': 'TIEMPO RESTANTE',
    'stage.hint': 'PEDIR INFORMACIÓN',
    'stage.hintCost': '−{cost} pts',
    'threat.low': 'BAJA',
    'threat.medium': 'MEDIA',
    'threat.high': 'ALTA',

    // --- retroalimentación ---
    'feedback.correctTitle': '✅ PROTOCOLO EJECUTADO',
    'feedback.wrongTitle': '❌ FALLA DE PROTOCOLO',
    'feedback.timeoutTitle': '⏱️ MISIÓN COMPROMETIDA',
    'feedback.correctScore': '+{points} PUNTOS · RACHA {streak}',
    'feedback.wrongScore': '−{points} PUNTOS · RACHA REINICIADA',
    'feedback.timeoutScore': 'TIEMPO AGOTADO · −{points} PUNTOS',
    'feedback.timeoutWhy': 'No ejecutaste ningún protocolo. En un incidente real, dudar es en sí mismo el peligro: decide y actúa.',
    'feedback.noResponse': 'Sin respuesta',
    'feedback.clockRanOut': 'Se acabó el tiempo',
    'feedback.yourChoiceCorrect': 'TU ELECCIÓN — CORRECTA',
    'feedback.yourChoice': 'TU ELECCIÓN',
    'feedback.correctProtocol': 'PROTOCOLO CORRECTO',
    'feedback.whyFailed': 'POR QUÉ FALLA',
    'feedback.fieldNotes': 'NOTAS DE CAMPO',
    'feedback.next': 'SIGUIENTE CASO ➤',
    'feedback.finish': 'MISIÓN COMPLETA ➤',

    // --- resultados ---
    'results.status': 'ESTADO DE LA MISIÓN',
    'results.success': 'MISIÓN CUMPLIDA',
    'results.failed': 'MISIÓN FALLIDA',
    'results.finalLevel': 'NIVEL DE ACCESO FINAL',
    'results.points': 'PUNTOS DE SEGURIDAD',
    'results.executed': 'PROTOCOLOS EJECUTADOS',
    'results.breaches': 'FALLAS DE PROTOCOLO',
    'results.commendations': 'CONDECORACIONES OBTENIDAS',
    'results.noCommendations': 'No obtuviste condecoraciones en esta misión',
    'results.debriefing': 'NOTAS DEL INFORME FINAL',
    'results.certificate': 'VER EL CERTIFICADO',
    'results.review': 'REPASAR LOS PROTOCOLOS',
    'results.newMission': 'NUEVA MISIÓN',
    'results.badgeEarned': 'CONDECORACIÓN OBTENIDA',

    'debrief.100': 'EXCELENTE. Ejecutaste correctamente todos los protocolos. Quedas autorizado para operaciones avanzadas de laboratorio.',
    'debrief.90': 'MUY BUEN TRABAJO. Dominas la seguridad en el laboratorio. Repasa el error o los dos errores que tuviste para llegar a un registro perfecto.',
    'debrief.pass': 'MISIÓN APROBADA. Los protocolos básicos están firmes, pero la respuesta ante emergencias necesita más práctica. Usa REPASAR LOS PROTOCOLOS en los escenarios que perdiste.',
    'debrief.50': 'POR DEBAJO DEL ESTÁNDAR. Entiendes lo básico, pero no los procedimientos de emergencia, que son los que más importan. Repasa cada falla antes de tu siguiente intento.',
    'debrief.fail': 'DEFICIENCIAS CRÍTICAS. Los vacíos que muestran estas respuestas causarían lesiones reales en un laboratorio real. Se requiere capacitación obligatoria antes de autorizar tu acceso.',

    // --- repaso ---
    'review.header': 'REPASO DE PROTOCOLOS',
    'review.summary': '{correct}/{total} APROBADOS · {percent}%',
    'review.passed': 'APROBADO',
    'review.noResponse': 'SIN RESPUESTA',
    'review.breach': 'FALLA',
    'review.yourAnswer': 'TU RESPUESTA:',
    'review.youChose': 'ELEGISTE:',
    'review.correct': 'PROTOCOLO CORRECTO:',
    'review.back': 'VOLVER AL INFORME FINAL',

    // --- certificado ---
    'cert.supervisor': 'OFICIAL SUPERVISOR',
    'cert.instructorPlaceholder': 'Nombre del docente...',
    'cert.setByTeacher': 'Definido por tu docente',
    'cert.download': '⭳ DESCARGAR PDF',
    'cert.print': 'IMPRIMIR',
    'cert.back': 'VOLVER',
    'cert.sealCertified': 'CERTIFICADO',
    'cert.issuer': 'FUERZA DE MISIONES IMPOSIBLES · DIVISIÓN CIENTÍFICA',
    'cert.issuerPdf': 'FUERZA DE MISIONES IMPOSIBLES  •  DIVISIÓN CIENTÍFICA',
    'cert.titlePass': 'Certificado de Seguridad en el Laboratorio',
    'cert.titleFail': 'Seguridad en el Laboratorio — Aviso de Recapacitación',
    'cert.titleFailPdf': 'Aviso de Recapacitación en Seguridad de Laboratorio',
    'cert.preamblePass': 'Se certifica que la persona operativa',
    'cert.preambleFail': 'Se hace constar que la persona operativa',
    'cert.bodyPass': 'completó la misión Protocolo de Laboratorio y demostró dominio del equipo de protección personal, la identificación de peligros, la respuesta ante emergencias, el manejo de sustancias químicas y la conducta en el laboratorio en el nivel de acceso {tier}.',
    'cert.bodyFail': 'intentó la misión Protocolo de Laboratorio en el nivel de acceso {tier} y no alcanzó el estándar de {threshold} % exigido para la autorización de laboratorio. Se requiere recapacitación y un nuevo intento.',
    'cert.bodyPassPdf1': 'completó la misión Protocolo de Laboratorio y demostró dominio del equipo de',
    'cert.bodyPassPdf2': 'protección personal, la identificación de peligros, la respuesta ante emergencias,',
    'cert.bodyPassPdf3': 'el manejo de sustancias químicas y la conducta en el nivel de acceso {tier}.',
    'cert.bodyFailPdf1': 'intentó la misión Protocolo de Laboratorio en el nivel de acceso {tier} y no alcanzó',
    'cert.bodyFailPdf2': 'el estándar de {threshold} % exigido para la autorización de laboratorio.',
    'cert.bodyFailPdf3': 'Se requiere recapacitación y un nuevo intento.',
    'cert.successRate': 'TASA DE ACIERTO',
    'cert.protocolsPassed': 'PROTOCOLOS APROBADOS',
    'cert.clearance': 'NIVEL DE ACCESO',
    'cert.rankConferred': 'RANGO OTORGADO',
    'cert.signatureRole': 'Jefatura de Seguridad de Laboratorio · División Científica IMF',
    'cert.signatureRolePdf': 'Jefatura de Seguridad de Laboratorio • División Científica IMF',
    'cert.dateOfIssue': 'Fecha de emisión',
    'cert.footer': 'Virtual Lab (https://virtuallab.az) • Simulación Protocolo de Seguridad de Laboratorio',
    'cert.filename': 'certificado-seguridad-laboratorio',
    'cert.bandHonours': 'HONORES',
    'cert.bandMerit': 'MÉRITO',
    'cert.bandPass': 'APROBADO',
    'cert.bandFail': 'SIN AUTORIZAR',
    'cert.retrain': 'REPETIR',

    // --- niveles de dificultad ---
    'tier.recruit': 'RECLUTA',
    'tier.recruit.blurb': 'La ventana de respuesta más amplia. Dos consultas de información.',
    'tier.field': 'AGENTE DE CAMPO',
    'tier.field.blurb': 'Ventana estándar. Una consulta de información.',
    'tier.specialops': 'OPERACIONES ESPECIALES',
    'tier.specialops.blurb': 'Ventana corta. Sin apoyo de información.',
    'tier.director': 'DIRECCIÓN IMF',
    'tier.director.blurb': 'Ventana mínima. Sin apoyo de información. Estándar de mando.',

    // --- rangos ---
    'rank.100': 'DIRECCIÓN DE SEGURIDAD DE LABORATORIO',
    'rank.90': 'AGENTE ESPECIAL — MATERIALES PELIGROSOS',
    'rank.70': 'AGENTE DE CAMPO — PROTOCOLO DE LABORATORIO',
    'rank.50': 'AGENTE EN PERÍODO DE PRUEBA',
    'rank.0': 'RECLUTA — REQUIERE NUEVA CAPACITACIÓN',

    // --- condecoraciones ---
    'badge.speed': 'AGENTE VELOZ',
    'badge.speed.desc': '5 protocolos respondidos bien, rápido y con criterio',
    'badge.perfect': 'PROTOCOLO PERFECTO',
    'badge.perfect.desc': 'Todos los escenarios ejecutados correctamente',
    'badge.safety': 'ESPECIALISTA EN SEGURIDAD',
    'badge.safety.desc': 'Todos los escenarios de emergencia resueltos bien',
    'badge.streak': 'RACHA IMPARABLE',
    'badge.streak.desc': '5 protocolos correctos seguidos',
    'badge.unaided': 'SIN REFUERZOS',
    'badge.unaided.desc': 'Misión aprobada sin pedir información ni una vez',

    // --- etiquetas de las ilustraciones (cortas: el lienzo mide 320 de ancho) ---
    'art.ppe.title': 'REQUISITOS DE ENTRADA — LOS 4',
    'art.ppe.goggles': 'GAFAS',
    'art.ppe.coat': 'BATA',
    'art.ppe.gloves': 'GUANTES',
    'art.ppe.shoes': 'ZAPATO CERRADO',
    'art.hazard.container': 'ENVASE SIN ETIQUETA',
    'art.hazard.plate': 'LEE EL PICTOGRAMA',
    'art.fire.sleeve': 'MANGA ARDIENDO',
    'art.fire.shower': 'DUCHA DE SEGURIDAD',
    'art.spill.plate': 'SE EXTIENDE · SIN IDENTIFICAR',
    'art.dilution.title': 'ORDEN DE ADICIÓN',
    'art.dilution.acid': 'ÁCIDO',
    'art.dilution.water': 'AGUA · GRAN VOLUMEN',
    'art.cleanup.station': 'TU ESTACIÓN',
    'art.cleanup.routes': 'RUTA DE RESIDUOS',
    'art.cleanup.glass': 'VIDRIO',
    'art.cleanup.aqueous': 'ACUOSO',
    'art.cleanup.sharps': 'PUNZANTE',
    'art.storage.flam': 'INFLAM.',
    'art.storage.cabinet': 'GABINETE VENTILADO',
    'art.storage.ignition': 'FUENTE DE IGNICIÓN',
    'art.storage.apart': 'MANTENER APARTE',
    'art.access.authorised': 'AUTORIZADO',
    'art.access.supervisor': 'SUPERVISIÓN',
    'art.conduct.hotwork': 'TRABAJO EN CALIENTE',
    'art.conduct.hot': 'CALIENTE',
    'art.conduct.exit': 'SALIDA',
    'art.conduct.plate': 'ESTACIONES EN USO · CALOR',
    'art.bio.microscope': 'MICROSCOPIO',
    'art.bio.sample': 'AGUA DE ESTANQUE',
    'art.bio.plate': 'MICROBIOS VIVOS',

    // --- página de configuración para docentes ---
    'tp.eyebrow': 'Fuerza de Misiones Imposibles · División Científica',
    'tp.title': 'Configura esta actividad para tu clase',
    'tp.lede': 'Pon tu nombre en cada certificado que ganen tus estudiantes, sin pedirles que lo escriban. Escríbelo una vez aquí y comparte el enlace que se genera.',
    'tp.step1': 'Tu nombre, tal como debe aparecer',
    'tp.nameLabel': 'Oficial supervisor',
    'tp.namePlaceholder': 'p. ej. Profa. Rivera',
    'tp.previewLabel': 'En el certificado se leerá:',
    'tp.step2': 'Comparte este enlace con tus estudiantes',
    'tp.linkAria': 'El enlace de tu clase',
    'tp.copy': 'Copiar el enlace',
    'tp.copied': 'Copiado. Pégalo donde publiques las tareas.',
    'tp.copyManual': 'Presiona Ctrl+C (Cmd+C en Mac) para copiar el enlace seleccionado.',
    'tp.copySelect': 'Selecciona el enlace de arriba y cópialo.',
    'tp.pasteHint': 'Pégalo en Google Classroom, Canvas o donde publiques las tareas. Quien lo abra recibe tu nombre fijado en su certificado: el estudiantado no puede cambiarlo.',
    'tp.openStudent': 'Abrir como estudiante',
    'tp.previewPdf': 'Ver una vista previa del certificado en PDF',
    'tp.langStep': 'Idioma para tus estudiantes',
    'tp.langHint': 'El enlace abre la simulación en el idioma que elijas aquí. Tus estudiantes igual pueden cambiarlo en la primera pantalla.',
    'tp.langAuto': 'Que elijan tus estudiantes',
    'tp.noteTitle': 'Bueno saberlo',
    'tp.note1': 'No se guarda nada en un servidor. El nombre viaja dentro del propio enlace, así que funciona en cualquier dispositivo y navegador, sin iniciar sesión.',
    'tp.note2': 'Guarda esta página en tus marcadores para crear un enlace nuevo cuando quieras: uno por grupo, si prefieres que los certificados regresen ordenados por clase.',
    'tp.note3': 'Tus estudiantes siguen escribiendo su propio nombre clave al inicio; ese es el nombre al que se emite el certificado.',
    'tp.note4': 'Si ya compartiste un enlace, ese sigue funcionando.',
    'tp.back': '← Volver a la simulación',
    'tp.foot': 'Virtual Lab · Simulación Protocolo de Seguridad de Laboratorio',
    'tp.warnChars': 'El certificado no puede imprimir {chars}, así que se leerá “{rendered}”. Prueba con la grafía más cercana en letras simples.',
    'tp.warnCharsSome': 'algunos caracteres',
    'tp.warnLong': 'Es demasiado largo para la línea de firma y se saldrá de ella. Prueba una forma más corta, por ejemplo una inicial en lugar del nombre completo.',
    'tp.sampleStudent': 'ESTUDIANTE DE MUESTRA'
}

};

// ===================================
// SCENARIO COPY — Spanish overlay
//
// Keyed by scenario id, and `options` is positional: it must stay in the same
// order as the `options` array of the matching scenario in questions.js. That
// coupling is checked at load time by i18nAuditScenarios() below, which is the
// only thing standing between a reordered option and a student reading the
// wrong explanation for their answer.
// ===================================

const I18N_SCENARIOS = {

es: {
    1: {
        title: 'ESCENARIO ALFA — CONTROL DE EPP',
        situation: 'El agente debe infiltrarse en el laboratorio. La inteligencia reporta corrosivos y llamas abiertas en uso. Elige el equipo de protección necesario para entrar.',
        options: [
            {
                text: 'ROPA DE CALLE',
                description: 'Ropa diaria, zapatos descubiertos',
                feedback: 'Los zapatos descubiertos y los brazos al aire no dejan nada entre un derrame y tu piel, y el material de vidrio que se cae aterriza en tus pies.'
            },
            {
                text: 'SOLO GAFAS',
                description: 'Protección para los ojos, nada más',
                feedback: 'Tus ojos quedan cubiertos, pero tus manos y tu ropa siguen expuestas a los corrosivos y al vidrio caliente.'
            },
            {
                text: 'PROTECCIÓN COMPLETA',
                description: 'Bata, gafas, guantes y zapatos cerrados'
            },
            {
                text: 'SOLO GUANTES',
                description: 'Protección para las manos, nada más',
                feedback: 'Los guantes dejan tus ojos sin protección, y las lesiones oculares son la lesión grave más común en un laboratorio.'
            }
        ],
        explanation: 'El EPP completo es obligatorio. La bata protege la piel y la ropa, las gafas protegen los ojos de las salpicaduras, los guantes evitan la contaminación y las quemaduras químicas, y los zapatos cerrados protegen los pies de derrames y de vidrio que se cae. El EPP solo funciona como conjunto completo.',
        protocol: 'Usa bata, gafas, guantes y zapatos cerrados en cada práctica.'
    },
    2: {
        title: 'ESCENARIO BRAVO — IDENTIFICACIÓN DEL PELIGRO',
        situation: 'La vigilancia recuperó esta etiqueta de advertencia de un envase sin marcar. Identifica la clase de peligro que declara.',
        options: [
            {
                text: 'CORROSIVO',
                description: 'Ácidos y bases que queman los tejidos',
                feedback: 'Los corrosivos se marcan con un pictograma de una mano y una superficie que se van desgastando, no con tres anillos entrelazados.'
            },
            {
                text: 'INFLAMABLE',
                description: 'Se enciende y arde con facilidad',
                feedback: 'El pictograma de inflamable es una llama. Los tres anillos entrelazados son el símbolo internacional de riesgo biológico.'
            },
            {
                text: 'RIESGO BIOLÓGICO',
                description: 'Material biológico infeccioso'
            },
            {
                text: 'RADIACTIVO',
                description: 'Emite radiación ionizante',
                feedback: 'El material radiactivo usa un trébol: tres cuñas sólidas alrededor de un punto central. Se parece a primera vista, pero es un peligro completamente distinto.'
            }
        ],
        explanation: 'Tres anillos entrelazados son el símbolo internacional de riesgo biológico: bacterias, virus, cultivos, sangre y tejidos. Manéjalo solo con el nivel de contención que indique tu docente, y nunca abras un envase sin marcar que lo lleve.',
        protocol: 'Lee el pictograma antes de tocar el envase: el símbolo te dice qué precauciones aplican.'
    },
    3: {
        title: 'ESCENARIO CHARLIE — ROPA EN LLAMAS',
        situation: 'CRÍTICO: a un compañero se le prendió la manga en la mesa de trabajo. La ducha de seguridad está a tres metros, al alcance. Actúa ya.',
        options: [
            {
                text: 'DUCHA DE SEGURIDAD',
                description: 'Llévalo debajo y empápalo de inmediato'
            },
            {
                text: 'MANTA IGNÍFUGA',
                description: 'Sofoca las llamas con una manta',
                feedback: 'La manta es lo correcto cuando no hay una ducha al alcance, pero con una a tres metros, empapar es más rápido y además enfría la quemadura en lugar de atrapar el calor contra la piel.'
            },
            {
                text: 'EXTINTOR DE CO₂',
                description: 'Rociar a la persona con el extintor',
                feedback: 'Nunca apuntes un extintor de CO₂ o de polvo químico a una persona. Puede causar quemaduras por frío, incrustar material ardiendo en la piel y desplazar el aire que está respirando.'
            },
            {
                text: 'CORRER POR AYUDA',
                description: 'Salir y buscar al docente',
                feedback: 'Correr aviva las llamas con oxígeno fresco y gasta los pocos segundos que deciden qué tan profunda queda la quemadura.'
            }
        ],
        explanation: 'Empapa a la persona bajo la ducha de seguridad de inmediato: eso apaga el fuego y enfría la quemadura en una sola acción. Si no hay una ducha al alcance, sofoca con una manta ignífuga o aplica detenerse, tirarse y rodar. Nunca uses un extintor de CO₂ o de polvo sobre una persona, y manda a alguien más por ayuda en lugar de irte.',
        protocol: 'Ropa en llamas: empapa bajo la ducha de seguridad, o sofoca; nunca rocíes a una persona con un extintor.'
    },
    4: {
        title: 'ESCENARIO DELTA — ALERTA DE CONTAMINACIÓN',
        situation: 'Un derrame corrosivo se extiende por la mesa del Sector 7. No se ha identificado la sustancia. ¿Cuál es tu primera acción?',
        options: [
            {
                text: 'AVISAR A QUIEN SUPERVISA',
                description: 'Dile de inmediato a tu docente',
            },
            {
                text: 'LIMPIARLO TÚ',
                description: 'Resolverlo antes de que alguien lo note',
                feedback: 'Limpiar un corrosivo sin identificar arriesga el contacto con la piel y el neutralizante equivocado: algunas combinaciones liberan calor o gases tóxicos.'
            },
            {
                text: 'SEGUIR Y AVISAR DESPUÉS',
                description: 'Terminar primero el experimento',
                feedback: 'Un corrosivo que se extiende alcanza a otras personas, a otros reactivos y a los zapatos. Cada segundo de retraso amplía la zona contaminada.'
            },
            {
                text: 'PREGUNTAR A UN COMPAÑERO',
                description: 'Pedir ayuda primero a alguien del grupo',
                feedback: 'Tu compañero tiene la misma formación que tú y ningún acceso al kit de derrames ni al almacén de EPP. Escala el aviso, no lo pases de lado.'
            }
        ],
        explanation: 'Reporta cada derrame a tu docente o a quien supervise de inmediato. Esa persona tiene formación en descontaminación, sabe qué es la sustancia y controla el kit de derrames. Mantén a los demás alejados del área mientras esperas.',
        protocol: 'Cualquier derrame, por pequeño que sea: detente, aléjate y avisa de inmediato a quien supervisa.'
    },
    5: {
        title: 'ESCENARIO ECHO — PROTOCOLO DE DILUCIÓN',
        situation: 'La misión requiere diluir ácido sulfúrico concentrado. Elige el método que mantiene bajo control el calor de dilución.',
        options: [
            {
                text: 'AGUA AL ÁCIDO',
                description: 'Verter el agua dentro del ácido',
                feedback: 'Esta es la violación de tu informe. El agua flota sobre el ácido, que es más denso, así que todo el calor de dilución cae en una capa delgada de la superficie, se convierte en vapor de golpe y lanza ácido hirviendo.'
            },
            {
                text: 'MEZCLAR RÁPIDO',
                description: 'Combinarlos rápido y agitar fuerte',
                feedback: 'Aquí el peligro es la velocidad, no el orden. Mezclar rápido libera calor más rápido de lo que el agua puede disiparlo.'
            },
            {
                text: 'ÁCIDO AL AGUA',
                description: 'Agregar el ácido al agua despacio, agitando'
            },
            {
                text: 'PORCIONES IGUALES',
                description: 'Verter los dos al mismo tiempo',
                feedback: 'Verterlos juntos sigue creando momentos en que el ácido es el líquido principal que recibe agua. No existe una versión simultánea segura.'
            }
        ],
        explanation: 'Siempre agrega el ácido AL agua, despacio y agitando. El gran volumen de agua absorbe y reparte el calor de dilución. Al revés, ese calor se concentra en una capa delgada de agua flotando, que hierve con violencia y lanza ácido fuera del recipiente.',
        protocol: 'Ácido al agua, despacio; nunca agua al ácido.'
    },
    6: {
        title: 'ESCENARIO FOXTROT — RESPONSABILIDAD EN EL LABORATORIO',
        situation: 'El experimento terminó. La estación tiene material de vidrio usado y residuos químicos. Determina a quién le toca recogerlo.',
        options: [
            {
                text: 'SOLO EL DOCENTE',
                description: 'El personal recoge todas las estaciones',
                feedback: 'Una sola persona no puede recoger treinta estaciones con seguridad, y no vio qué se puso en tu material de vidrio.'
            },
            {
                text: 'PERSONAL TÉCNICO',
                description: 'El personal técnico se encarga de todo',
                feedback: 'El personal técnico se encarga de desechar residuos peligrosos, no de la limpieza de rutina; y pasarle residuos sin etiquetar vuelve peligroso su trabajo.'
            },
            {
                text: 'QUIENES LO USARON',
                description: 'Cada estudiante recoge su estación'
            },
            {
                text: 'LA SIGUIENTE CLASE',
                description: 'Dejarlo para el periodo que sigue',
                feedback: 'La siguiente clase hereda residuos desconocidos en una mesa que suponen limpia. Así es como tu experimento lastima a otra persona.'
            }
        ],
        explanation: 'Todos los que usan el laboratorio recogen su propia estación: lavar y devolver el material de vidrio, desechar los residuos en el contenedor indicado, limpiar la mesa y lavarse las manos. Quien use la mesa después tiene que poder confiar en que está limpia.',
        protocol: 'Recoge tu estación: vidrio devuelto, residuos en el contenedor correcto, mesa limpia y manos lavadas.'
    },
    7: {
        title: 'ESCENARIO GOLF — ALMACENAMIENTO DE INFLAMABLES',
        situation: 'Hay que guardar el etanol y otros disolventes inflamables al terminar la sesión. Identifica el lugar de almacenamiento correcto.',
        options: [
            {
                text: 'GABINETE DE INFLAMABLES',
                description: 'Gabinete aprobado, ventilado y etiquetado'
            },
            {
                text: 'JUNTO AL MECHERO',
                description: 'En la mesa, al lado de la fuente de calor',
                feedback: 'El vapor de los disolventes es más pesado que el aire y viaja por la mesa. Una fuente de ignición a esa altura puede regresar la llama por el rastro de vapor hasta el frasco.'
            },
            {
                text: 'VASO ABIERTO EN LA MESA',
                description: 'Un vaso sin etiqueta, dejado afuera',
                feedback: 'Un recipiente abierto evapora disolvente al aire toda la noche, y nadie después sabe qué es ese líquido sin etiqueta.'
            },
            {
                text: 'REFRIGERADOR DE COCINA',
                description: 'Un refrigerador doméstico lo mantiene frío',
                feedback: 'Un refrigerador doméstico tiene un termostato y una luz internos que hacen chispa: una causa clásica de explosiones por disolventes. Solo son seguros los refrigeradores de laboratorio aprobados para inflamables.'
            }
        ],
        explanation: 'Los disolventes inflamables van en un gabinete aprobado, ventilado y etiquetado, lejos del calor, de las llamas y de las fuentes eléctricas de ignición, con la tapa bien cerrada. Ten en la mesa solo la cantidad de trabajo.',
        protocol: 'Los inflamables viven en el gabinete ventilado aprobado, tapados y etiquetados, lejos de toda fuente de ignición.'
    },
    8: {
        title: 'ESCENARIO HOTEL — CONTROL DE ACCESO',
        situation: 'La puerta del laboratorio está sin llave y el salón está vacío. Determina el protocolo de entrada autorizado.',
        options: [
            {
                text: 'ENTRAR CUANDO SEA',
                description: 'Está abierto, así que está disponible',
                feedback: 'Una puerta sin llave no es un permiso. Puede haber reacciones en marcha, y un laboratorio vacío significa que nadie sabría que estás en problemas.'
            },
            {
                text: 'SOLO CON PERMISO',
                description: 'Entrar solo con autorización y supervisión'
            },
            {
                text: 'SOLO EN CLASE',
                description: 'Cuando haya una clase programada',
                feedback: 'Casi, pero una clase en el horario no es el punto: el requisito es que haya alguien supervisando que sepa que estás ahí y qué estás manejando.'
            },
            {
                text: 'CON UN COMPAÑERO',
                description: 'Dos estudiantes juntos es suficiente',
                feedback: 'Un segundo estudiante duplica las personas en riesgo sin sumar a nadie con formación para responder.'
            }
        ],
        explanation: 'Nunca entres ni trabajes en un laboratorio sin autorización y supervisión del personal. Los laboratorios guardan materiales peligrosos, equipo energizado y reacciones en marcha, y la respuesta a emergencias depende de que haya una persona adulta con formación presente.',
        protocol: 'Sin supervisión, no se entra, esté abierta la puerta o no.'
    },
    9: {
        title: 'ESCENARIO INDIA — PROTOCOLO DE CONDUCTA',
        situation: 'Varios agentes trabajan en un laboratorio lleno con parrillas encendidas. Identifica la conducta que se exige a todos.',
        options: [
            {
                text: 'CAMINAR, NO CORRER',
                description: 'Camina y deja libres pasillos y salidas'
            },
            {
                text: 'APURARSE PARA GANAR TIEMPO',
                description: 'Moverse rápido entre estaciones',
                feedback: 'Correr en un laboratorio lleno tira el material de vidrio de las mesas y te mete en la parrilla de otra persona. El tiempo ahorrado no vale una quemadura.'
            },
            {
                text: 'PROBAR PARA VERIFICAR',
                description: 'Confirmar un producto probándolo',
                feedback: 'En un laboratorio nunca se prueba nada. Incluso un producto en teoría inofensivo puede estar contaminado por el material de vidrio donde estuvo.'
            },
            {
                text: 'QUITARSE LAS GAFAS AL APAGAR',
                description: 'Quitarse la protección ocular tras apagar la llama',
                feedback: 'El vidrio caliente, la presión residual y las salpicaduras que no notaste siguen ahí mucho después de apagar la llama. Las gafas se quedan puestas hasta que todo esté recogido.'
            }
        ],
        explanation: 'Moverse con calma y de forma deliberada es un requisito de seguridad, no una regla de cortesía. Camina, mantén mochilas y bancos fuera de los pasillos, deja libres las salidas y conserva tu EPP puesto hasta que todo esté recogido. Correr y jugar provoca derrames, roturas, incendios y lesiones.',
        protocol: 'Camina, deja libres los pasillos y no te quites el EPP hasta recoger la mesa.'
    },
    10: {
        title: 'ESCENARIO JULIET — MUESTRA BIOLÓGICA',
        situation: 'CRÍTICO PARA LA MISIÓN: hay que examinar muestras de agua de estanque bajo el microscopio. Elige el protocolo de manejo requerido.',
        options: [
            {
                text: 'SOLO OBSERVAR',
                description: 'Ojos e instrumentos; guantes puestos, lavarse después'
            },
            {
                text: 'PROBAR UNA GOTA',
                description: 'Probarla directamente para comparar',
                feedback: 'El agua de estanque lleva parásitos, bacterias y escurrimientos químicos. Probar cualquier muestra de laboratorio puede causar una enfermedad grave o la muerte.'
            },
            {
                text: 'ABANICAR Y OLER',
                description: 'Abanicar el vapor hacia tu nariz',
                feedback: 'Abanicar solo se usa con una sustancia conocida y de bajo riesgo, y por indicación expresa; nunca con una muestra biológica sin caracterizar.'
            },
            {
                text: 'PIPETEAR CON LA BOCA',
                description: 'Succionar la muestra con la boca',
                feedback: 'Pipetear con la boca jala la muestra hacia tu boca y lleva más de un siglo causando infecciones de laboratorio. Usa siempre una perilla o un pipeteador.'
            }
        ],
        explanation: 'Examina las muestras biológicas solo con tus ojos y con los instrumentos. Usa guantes, mantén la muestra contenida, nunca la pruebes, la huelas ni la pipetees con la boca, desecha los portaobjetos en el contenedor indicado y lávate las manos al terminar.',
        protocol: 'Nunca pruebes, huelas ni pipetees una muestra con la boca: obsérvala con instrumentos y lávate las manos.'
    }
}

};

// ===================================
// ENGINE
//
// T() is declared here and nowhere else. These are classic scripts sharing one
// global lexical scope, so a second file declaring its own `const t` would
// throw "Identifier has already been declared" before a line of it ran.
// ===================================

let i18nCurrent = I18N_FALLBACK;
const i18nListeners = [];

function i18nNormalise(code) {
    if (!code) return null;
    const base = String(code).toLowerCase().split('-')[0];
    return I18N_SUPPORTED.includes(base) ? base : null;
}

function i18nRead() {
    try {
        return window.localStorage.getItem(I18N_STORAGE_KEY);
    } catch (e) {
        return null;
    }
}

function i18nWrite(code) {
    try {
        window.localStorage.setItem(I18N_STORAGE_KEY, code);
    } catch (e) {
        /* private browsing — the choice still holds for this session */
    }
}

// Order of authority: the link a teacher handed out, then what this student
// chose last time, then what their device asks for, then English.
function i18nResolve() {
    const fromUrl = new URLSearchParams(window.location.search).get('lang');
    const urlLang = i18nNormalise(fromUrl);
    if (urlLang) return urlLang;

    const stored = i18nNormalise(i18nRead());
    if (stored) return stored;

    const prefs = navigator.languages && navigator.languages.length
        ? navigator.languages
        : [navigator.language];

    for (const pref of prefs) {
        const match = i18nNormalise(pref);
        if (match) return match;
    }

    return I18N_FALLBACK;
}

function i18nInterpolate(template, vars) {
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (whole, key) =>
        Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : whole);
}

function T(key, vars) {
    const table = I18N_STRINGS[i18nCurrent] || I18N_STRINGS[I18N_FALLBACK];
    let value = table[key];

    if (value === undefined) value = I18N_STRINGS[I18N_FALLBACK][key];
    if (value === undefined) return key;      // loud enough to spot, quiet enough to ship

    return i18nInterpolate(value, vars);
}

// The Spanish copy for one scenario, or null when the active language is the
// one questions.js is already written in.
function i18nScenario(id) {
    const pack = I18N_SCENARIOS[i18nCurrent];
    return (pack && pack[id]) || null;
}

// Merge the active language's copy over a scenario from questions.js. Option
// text is matched by position, never by content.
function i18nLocalizeScenario(scenario) {
    const copy = i18nScenario(scenario.id);
    if (!copy) return scenario;

    return {
        ...scenario,
        title: copy.title || scenario.title,
        situation: copy.situation || scenario.situation,
        explanation: copy.explanation || scenario.explanation,
        protocol: copy.protocol || scenario.protocol,
        options: scenario.options.map((option, index) => {
            const localized = (copy.options || [])[index];
            if (!localized) return option;
            return {
                ...option,
                text: localized.text || option.text,
                description: localized.description || option.description,
                // `feedback` is absent on the correct option by design, so an
                // absent translation must not resurrect the English one.
                feedback: option.feedback ? (localized.feedback || option.feedback) : ''
            };
        })
    };
}

// ===================================
// STATIC DOM
// data-i18n            → textContent
// data-i18n-html       → innerHTML (dictionary copy only; never user input)
// data-i18n-<attr>     → that attribute, for placeholder / title / aria-label
// ===================================

const I18N_ATTRS = [
    ['data-i18n-placeholder', 'placeholder'],
    ['data-i18n-title', 'title'],
    ['data-i18n-aria-label', 'aria-label'],
    ['data-i18n-content', 'content']
];

function i18nApply(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = T(el.getAttribute('data-i18n'));
    });

    root.querySelectorAll('[data-i18n-html]').forEach(el => {
        el.innerHTML = T(el.getAttribute('data-i18n-html'));
    });

    I18N_ATTRS.forEach(([dataAttr, target]) => {
        root.querySelectorAll(`[${dataAttr}]`).forEach(el => {
            el.setAttribute(target, T(el.getAttribute(dataAttr)));
        });
    });

    const titleKey = document.documentElement.getAttribute('data-i18n-doc-title');
    if (titleKey) document.title = T(titleKey);
}

function setLang(code, { persist = true, silent = false } = {}) {
    const next = i18nNormalise(code) || I18N_FALLBACK;
    const changed = next !== i18nCurrent;

    i18nCurrent = next;
    document.documentElement.lang = next;

    if (persist) i18nWrite(next);

    i18nApply(document);

    if (!silent && changed) {
        i18nListeners.forEach(fn => {
            try { fn(next); } catch (e) { /* one bad listener must not stop the rest */ }
        });
    }

    return next;
}

function onLangChange(fn) {
    if (typeof fn === 'function') i18nListeners.push(fn);
}

function locale() {
    return I18N_LOCALES[i18nCurrent];
}

function formatDate(date = new Date()) {
    return date.toLocaleDateString(locale(), {
        year: 'numeric', month: 'long', day: 'numeric'
    });
}

// Called by questions.js once its tables exist. Catches the one failure mode
// this design has — a translated option list that has drifted out of step with
// the English one — while the page is still developer-facing.
function i18nAuditScenarios(scenarios) {
    if (!Array.isArray(scenarios)) return;

    Object.entries(I18N_SCENARIOS).forEach(([lang, pack]) => {
        scenarios.forEach(scenario => {
            const copy = pack[scenario.id];
            if (!copy) {
                console.warn(`[i18n] ${lang}: no copy for scenario ${scenario.id}`);
                return;
            }
            const got = (copy.options || []).length;
            const want = scenario.options.length;
            if (got !== want) {
                console.warn(
                    `[i18n] ${lang}: scenario ${scenario.id} has ${got} translated options, expected ${want}`);
            }
        });
    });
}

// ===================================
// LANGUAGE SELECTOR
// A segmented control. Rendered from I18N_SUPPORTED so adding a third language
// is a dictionary change and nothing else.
// ===================================

function mountLanguageSwitch(container) {
    if (!container) return;

    container.innerHTML = I18N_SUPPORTED.map(code => `
        <button type="button" class="lang-opt" data-lang="${code}"
                role="radio" aria-checked="${code === i18nCurrent}"
                lang="${code}" aria-label="${T(`lang.switchTo.${code}`)}"
                tabindex="${code === i18nCurrent ? '0' : '-1'}">
            <span class="lang-code">${code.toUpperCase()}</span>
            <span class="lang-name">${I18N_LANG_NAMES[code]}</span>
        </button>
    `).join('') + '<span class="lang-thumb" aria-hidden="true"></span>';

    const options = Array.from(container.querySelectorAll('.lang-opt'));

    const paint = () => {
        options.forEach(btn => {
            const on = btn.dataset.lang === i18nCurrent;
            btn.classList.toggle('is-active', on);
            btn.setAttribute('aria-checked', String(on));
            btn.tabIndex = on ? 0 : -1;
        });
        // Drives the sliding highlight without a per-language CSS rule.
        container.style.setProperty('--lang-index', I18N_SUPPORTED.indexOf(i18nCurrent));
        container.style.setProperty('--lang-count', I18N_SUPPORTED.length);
    };

    options.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.lang === i18nCurrent) return;
            setLang(btn.dataset.lang);
            paint();
            btn.focus();
        });

        // Arrow keys move between radios, which is what a radiogroup owes a
        // keyboard user.
        btn.addEventListener('keydown', (e) => {
            const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1
                       : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1
                       : 0;
            if (!step) return;

            e.preventDefault();
            const here = I18N_SUPPORTED.indexOf(i18nCurrent);
            const next = I18N_SUPPORTED[(here + step + I18N_SUPPORTED.length) % I18N_SUPPORTED.length];
            setLang(next);
            paint();
            container.querySelector(`.lang-opt[data-lang="${next}"]`).focus();
        });
    });

    paint();
    onLangChange(paint);
}

// Resolve before first paint so the static markup is translated in the same
// frame it appears, rather than flashing English at a Spanish-speaking student.
setLang(i18nResolve(), { persist: false, silent: true });

document.addEventListener('DOMContentLoaded', () => i18nApply(document));

window.i18n = {
    t: T,
    get lang() { return i18nCurrent; },
    supported: I18N_SUPPORTED,
    names: I18N_LANG_NAMES,
    setLang,
    apply: i18nApply,
    onChange: onLangChange,
    locale,
    formatDate,
    scenario: i18nScenario,
    localizeScenario: i18nLocalizeScenario,
    auditScenarios: i18nAuditScenarios,
    mountLanguageSwitch
};
