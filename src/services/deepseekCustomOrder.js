function compactText(value, maxLength = 1800) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizeForMatch(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeMessages(messages = []) {
  if (!Array.isArray(messages)) return [];

  return messages
    .map(message => ({
      role: message && message.role === 'assistant' ? 'assistant' : 'user',
      content: compactText(message && message.content, 2400)
    }))
    .filter(message => message.content)
    .slice(-18);
}

function normalizeReferenceImages(referenceImages = []) {
  if (!Array.isArray(referenceImages)) return [];

  return referenceImages
    .map(item => {
      if (typeof item === 'string') return { url: item, name: '' };
      return {
        url: String(item && item.url ? item.url : '').trim(),
        name: String(item && item.name ? item.name : '').trim(),
        size: Number(item && item.size ? item.size : 0),
        mimeType: String(item && item.mimeType ? item.mimeType : '').trim()
      };
    })
    .filter(item => item.url)
    .slice(0, 6);
}

function normalizeSummary(summary = {}) {
  const source = summary && typeof summary === 'object' ? summary : {};

  return {
    title: compactText(source.title || source.titulo || 'Pedido personalizado', 140),
    what: compactText(source.what || source.que || source.pieza || '', 900),
    how: compactText(source.how || source.como || source.estilo || '', 900),
    pieces: compactText(source.pieces || source.piezas || source.cantidad || '', 160),
    dateNeeded: compactText(source.dateNeeded || source.fecha || source.fechaNecesaria || '', 120),
    baseProduct: compactText(source.baseProduct || source.modeloBase || source.productoBase || '', 240),
    modifications: compactText(source.modifications || source.modificaciones || '', 900),
    referenceImagesCount: Math.max(0, Number(source.referenceImagesCount || source.referencias || 0)),
    deliveryType: compactText(source.deliveryType || source.entrega || 'Por confirmar', 120),
    notesForAdmin: compactText(source.notesForAdmin || source.notasAdmin || source.notas || '', 1500),
    customerFriendlySummary: compactText(source.customerFriendlySummary || source.resumenCliente || source.resumen || '', 1500)
  };
}

function parseJsonObject(rawText) {
  const text = String(rawText || '').trim();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (firstError) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;

    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch (secondError) {
      return null;
    }
  }
}

function getUserText(messages = []) {
  return normalizeMessages(messages)
    .filter(message => message.role === 'user')
    .map(message => message.content)
    .join('\n');
}

function getLatestUserText(messages = []) {
  const normalized = normalizeMessages(messages);
  const latest = [...normalized].reverse().find(message => message.role === 'user');
  return latest ? latest.content : '';
}

function cleanCapturedPhrase(value = '') {
  return compactText(String(value || '')
    .replace(/^(me\s+podr[ií]as\s+hacer|podr[ií]as\s+hacerme|quiero|quisiera|necesito|ocupo|hacerme|hacer|crear|crear\s+un|crear\s+una)\s+/i, '')
    .replace(/[?¿!¡]+/g, '')
    .replace(/\b(por\s+favor|xfa|porfa)\b/ig, '')
    .replace(/\s+de\s+\d{1,3}(?:[.,]\d{1,2})?\s*(?:cm|cent[ií]metros?|mm|mil[ií]metros?|m|metros?|pulgadas?|in)\b.*$/i, '')
    .replace(/\s+para\s+(?:el\s+)?\d{1,2}\s*(?:de\s*)?(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b.*$/i, '')
    .replace(/\s*(?:,?\s*)?(?:es\s+de|mide|medida\s+de)\s*\d{1,3}(?:[.,]\d{1,2})?\s*(?:cm|cent[ií]metros?|mm|mil[ií]metros?|m|metros?|pulgadas?|in)\b.*$/i, '')
    .replace(/\s+(?:es|mide|medida)\s*$/i, '')
    .trim(), 180);
}

function extractWhatText(text, selectedProduct) {
  if (selectedProduct && selectedProduct.name) {
    return `Personalización basada en ${selectedProduct.name}`;
  }

  const source = String(text || '');
  const productWords = 'llaveros?|figuras?|topper(?:s)?|tazas?|playeras?|stickers?|viniles?|cuadros?|adornos?|recuerdos?|regalos?|decoraciones?|nombres?|logos?|letreros?|piezas?|cajas?|separadores?|aretes?|pulseras?';
  const patterns = [
    new RegExp(`(?:me\\s+podr[ií]as\\s+hacer|podr[ií]as\\s+hacerme|quiero|quisiera|necesito|ocupo|hacerme|hacer|crear)\\s+(?:un|una|unos|unas)?\\s*((?:${productWords})[^.\\n,;]*)`, 'i'),
    new RegExp(`\\b(?:un|una|unos|unas)\\s+((?:${productWords})[^.\\n,;]*)`, 'i'),
    new RegExp(`\\b((?:${productWords})\\s+(?:de|con|para)\\s+[^.\\n,;]*)`, 'i')
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match && match[1]) return cleanCapturedPhrase(match[1]);
  }

  const firstMeaningful = source
    .split(/[.\n;]/)
    .map(cleanCapturedPhrase)
    .find(item => item.length >= 18);

  return firstMeaningful || '';
}

function extractPiecesText(text) {
  const source = String(text || '');
  const unitWords = 'piezas?|llaveros?|figuras?|productos?|sets?|cajas?|recuerdos?|pares?|unidades?|topper(?:s)?|tazas?|playeras?|stickers?|viniles?|adornos?';
  const measureAfterNumber = /\b\d{1,4}\s*(cm|cent[ií]metros?|mm|mil[ií]metros?|m|metros?|pulgadas?|in)\b/i;

  const direct = source.match(new RegExp(`\\b(\\d{1,4})\\s*((?:${unitWords}))\\b`, 'i'));
  if (direct && !measureAfterNumber.test(direct[0])) return `${direct[1]} ${direct[2]}`;

  const wordNumbers = {
    una: 1,
    un: 1,
    uno: 1,
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
    seis: 6,
    siete: 7,
    ocho: 8,
    nueve: 9,
    diez: 10,
    once: 11,
    doce: 12,
    trece: 13,
    catorce: 14,
    quince: 15,
    veinte: 20
  };

  const wordPattern = Object.keys(wordNumbers).join('|');
  const wordMatch = source.match(new RegExp(`\\b(${wordPattern})\\s+((?:${unitWords}))\\b`, 'i'));
  if (wordMatch) return `${wordNumbers[normalizeForMatch(wordMatch[1])]} ${wordMatch[2]}`;

  const singular = source.match(new RegExp(`\\b(un|una)\\s+((?:${unitWords}))\\b`, 'i'));
  if (singular) return `1 ${singular[2].replace(/s$/i, '')}`;

  const quantityAfter = source.match(/\b(?:cantidad|ser[ií]an|serian|son|quiero|necesito|ocupo)\s*(?:de\s*)?(\d{1,4})\b(?!\s*(cm|cent[ií]metros?|mm|mil[ií]metros?|m|metros?|pulgadas?|in)\b)/i);
  if (quantityAfter) return `${quantityAfter[1]} piezas`;

  return '';
}

function extractMeasurementText(text) {
  const source = String(text || '');
  const matches = [];
  const patterns = [
    /\b\d{1,3}(?:[.,]\d{1,2})?\s*(?:x|por)\s*\d{1,3}(?:[.,]\d{1,2})?\s*(?:cm|cent[ií]metros?|mm|mil[ií]metros?|m|metros?|pulgadas?|in)\b/ig,
    /\b\d{1,3}(?:[.,]\d{1,2})?\s*(?:cm|cent[ií]metros?|mm|mil[ií]metros?|m|metros?|pulgadas?|in)\b/ig,
    /\b(?:tama[ñn]o|medida|medidas?)\s*(?:de|aprox(?:imado)?|aproximada|aproximadamente)?\s*[^.\n,;]{1,80}/ig
  ];

  patterns.forEach(pattern => {
    const found = source.match(pattern);
    if (found) matches.push(...found.map(item => compactText(item, 80)));
  });

  return [...new Set(matches)].slice(0, 3).join(', ');
}

function extractColorText(text) {
  const source = String(text || '');
  const colors = ['lila', 'lilas', 'morado', 'morados', 'rosa', 'rosas', 'azul', 'azules', 'rojo', 'rojos', 'verde', 'verdes', 'amarillo', 'amarillos', 'negro', 'negros', 'blanco', 'blancos', 'dorado', 'dorados', 'plateado', 'plateados', 'naranja', 'cafe', 'café', 'beige', 'turquesa', 'pastel', 'neon', 'neón'];
  const found = colors.filter(color => new RegExp(`\\b${color}\\b`, 'i').test(source));
  const tone = source.match(/\b(?:tonos?|colores?)\s+[^.\n,;]{1,80}/i);
  if (tone) return compactText(tone[0], 100);
  return [...new Set(found)].join(', ');
}

function extractTextOrName(text) {
  const source = String(text || '');
  const match = source.match(/\b(?:con\s+(?:el\s+)?nombre|nombre|texto|frase|leyenda)\s*(?:de|:)?\s*[^.\n,;]{1,80}/i);
  return match ? compactText(match[0], 100) : '';
}

function extractDateText(text) {
  const source = String(text || '');
  const iso = source.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return iso[0];

  const slash = source.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}))?\b/);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]);
    const year = Number(slash[3] || new Date().getFullYear());
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const months = {
    enero: 1,
    febrero: 2,
    marzo: 3,
    abril: 4,
    mayo: 5,
    junio: 6,
    julio: 7,
    agosto: 8,
    septiembre: 9,
    setiembre: 9,
    octubre: 10,
    noviembre: 11,
    diciembre: 12
  };
  const monthNames = Object.keys(months).join('|');
  const named = source.match(new RegExp(`\\b(\\d{1,2})\\s*(?:de\\s*)?(${monthNames})(?:\\s*(?:de|del)?\\s*(20\\d{2}))?\\b`, 'i'));
  if (named) {
    const day = Number(named[1]);
    const month = months[normalizeForMatch(named[2])];
    const year = Number(named[3] || new Date().getFullYear());
    if (day >= 1 && day <= 31 && month) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const relative = source.match(/\b(mañana|hoy|pasado mañana|esta semana|pr[oó]xima semana|fin de semana|urgente|sin fecha|solo cotizaci[oó]n|no tengo fecha)\b/i);
  if (relative) return compactText(relative[0], 80);

  return '';
}

function hasUsefulWhat(text, selectedProduct) {
  return Boolean(extractWhatText(text, selectedProduct));
}

function hasStyleDetails(text) {
  const source = String(text || '');
  return Boolean(extractMeasurementText(source) || extractColorText(source) || extractTextOrName(source))
    || /\b(material|resina|madera|vinil|acr[ií]lico|tema|estilo|acabado|brillante|mate|personaje|mapache|flor|coraz[oó]n|forma|redondo|cuadrado|modificar|cambiar|igual|parecido|basado|conmemorativo|cumplea[ñn]os|boda|bautizo|comuni[oó]n)\b/i.test(source);
}

function hasColorFinishOrTheme(text) {
  const source = String(text || '');
  return Boolean(extractColorText(source) || extractTextOrName(source))
    || /\b(acabado|brillante|mate|tema|estilo|material|resina|madera|vinil|acr[ií]lico|personaje|mapache|flor|coraz[oó]n|forma|redondo|cuadrado)\b/i.test(source);
}

function hasDateDetails(text) {
  const source = String(text || '');
  return Boolean(extractDateText(source)) || /\b(fecha|para el|antes del|antes de|d[ií]a|semana|mes|entrega el|entregar el|lo necesito el|tenerlo el|solo cotizaci[oó]n|sin fecha)\b/i.test(source);
}

function hasReferenceDescription(text) {
  const source = String(text || '');
  return /\b(referencia|foto|imagen|tomar|toma|usar|usa|basado|basada|parecido|similar|igual|forma|color|colores|pose|textura|composici[oó]n|estilo|personaje|cara|figura|modelo|ignorar|solo)\b/i.test(source);
}

function getExtractedDetails(userText, selectedProduct) {
  const measurement = extractMeasurementText(userText);
  const colors = extractColorText(userText);
  const textOrName = extractTextOrName(userText);
  const parts = [];

  if (measurement) parts.push(`Medida: ${measurement}`);
  if (colors) parts.push(`Color/tono: ${colors}`);
  if (textOrName) parts.push(`Texto/nombre: ${textOrName}`);

  const styleMatch = String(userText || '').match(/\b(?:estilo|tema|acabado|material|forma)\s*(?:de|:)?\s*[^.\n,;]{1,90}/i);
  if (styleMatch) parts.push(compactText(styleMatch[0], 120));

  if (!parts.length && selectedProduct) parts.push(`Tomar como punto de partida el modelo ${selectedProduct.name}.`);

  return compactText(parts.join(' · '), 900);
}

function detectCustomOrderState(input = {}) {
  const messages = normalizeMessages(input.messages);
  const referenceImages = normalizeReferenceImages(input.referenceImages);
  const selectedProduct = input.selectedProduct || null;
  const userText = getUserText(messages);
  const whatText = extractWhatText(userText, selectedProduct);
  const piecesText = extractPiecesText(userText);
  const dateText = extractDateText(userText);
  const detailText = getExtractedDetails(userText, selectedProduct);

  const checks = {
    what: hasUsefulWhat(userText, selectedProduct),
    pieces: Boolean(piecesText),
    style: hasStyleDetails(userText),
    colorFinishOrTheme: hasColorFinishOrTheme(userText),
    date: hasDateDetails(userText),
    referenceDetails: referenceImages.length === 0 || hasReferenceDescription(userText)
  };

  const missingFields = [];
  if (!checks.what) missingFields.push('qué pieza quiere');
  if (!checks.pieces) missingFields.push('cantidad de piezas');
  if (!checks.style) missingFields.push('detalles de tamaño, color, texto o estilo');
  if (checks.style && !checks.colorFinishOrTheme) missingFields.push('color, acabado o estilo');
  if (!checks.date) missingFields.push('fecha en la que lo necesita');
  if (!checks.referenceDetails) missingFields.push('qué debe tomarse de la referencia');

  return {
    messages,
    referenceImages,
    selectedProduct,
    userText,
    latestUserText: getLatestUserText(messages),
    whatText,
    piecesText,
    dateText,
    detailText,
    checks,
    missingFields,
    isComplete: missingFields.length === 0
  };
}

function getMissingPrompts(missingFields = []) {
  const guides = {
    'qué pieza quiere': {
      field: 'Qué pieza quieres',
      prompt: 'Describe la pieza principal: llavero, figura, topper, decoración, regalo, nombre, personaje o idea base.',
      example: 'Ejemplo: quiero un llavero de mapache con estilo tierno.'
    },
    'cantidad de piezas': {
      field: 'Cantidad',
      prompt: 'Indica cuántas piezas o sets necesitas. Si es una sola, dilo también.',
      example: 'Ejemplo: necesito 1 figura o 12 llaveros.'
    },
    'detalles de tamaño, color, texto o estilo': {
      field: 'Detalles',
      prompt: 'Agrega tamaño, colores, texto/nombre, tema, material o estilo general.',
      example: 'Ejemplo: de 15 cm, tonos lilas, con nombre y acabado brillante.'
    },
    'color, acabado o estilo': {
      field: 'Color o acabado',
      prompt: 'Ya hay una idea base; falta indicar color, acabado o estilo visual. También puedes decir que lo deje a criterio del admin.',
      example: 'Ejemplo: azul y blanco, acabado brillante, estilo tierno.'
    },
    'fecha en la que lo necesita': {
      field: 'Fecha necesaria',
      prompt: 'Di para cuándo lo necesitas o si solo quieres cotización sin fecha urgente.',
      example: 'Ejemplo: lo necesito para el 15 de junio, o solo quiero cotizar.'
    },
    'qué debe tomarse de la referencia': {
      field: 'Uso de la referencia',
      prompt: 'La foto queda guardada, pero debes decir qué parte importa: forma, color, personaje, textura, pose o composición.',
      example: 'Ejemplo: de la foto toma solo la forma y los colores, no el texto.'
    }
  };

  return missingFields.map(field => guides[field]).filter(Boolean);
}

function buildOneSentenceExample(missingFields = []) {
  const needs = new Set(missingFields);
  const parts = [];

  if (needs.has('qué pieza quiere')) parts.push('quiero una figura personalizada');
  if (needs.has('cantidad de piezas')) parts.push('sería 1 pieza');
  if (needs.has('detalles de tamaño, color, texto o estilo')) parts.push('de 15 cm, en tonos azul y blanco, con acabado brillante');
  if (needs.has('color, acabado o estilo')) parts.push('en tonos azul y blanco, con acabado brillante');
  if (needs.has('fecha en la que lo necesita')) parts.push('para el 15 de junio');
  if (needs.has('qué debe tomarse de la referencia')) parts.push('de la referencia toma solo la forma y los colores');

  return parts.length ? parts.join(', ') + '.' : '';
}

function isQuestionAboutOptions(text) {
  return /\b(qu[eé] puedo pedir|qu[eé] hacen|ideas|opciones|ejemplos|c[oó]mo funciona|qu[eé] necesito|ayuda)\b/i.test(text || '');
}

function isGreetingOnly(text) {
  return /^(hola|buenas|hey|ola|holaa|qué tal|que tal)[!.\s]*$/i.test(String(text || '').trim());
}

function isQuestionAboutImage(text) {
  return /\b(foto|imagen|referencia|puedes ver|ves la imagen|ves la foto|sub[ií] foto)\b/i.test(text || '');
}

function isGenericAiReply(text = '') {
  const source = normalizeForMatch(text);
  if (!source) return true;

  return /todavia necesito precisar cantidad de piezas y colores/.test(source)
    || /voy armando la solicitud.*todavia necesito precisar/.test(source)
    || /para cerrar bien la solicitud/.test(source)
    || /escribelo normal/.test(source)
    || /d[ií]melo en una frase y cierro el resumen/.test(text)
    || /revisa el resumen/.test(source)
    || /resumen de la derecha/.test(source)
    || source.length < 18;
}

function sanitizeAiReply(text = '') {
  return compactText(String(text || '')
    .replace(/\b[Ee]scr[ií]belo normal,?\s*(como mensaje)?:?/g, 'Dímelo así:')
    .replace(/\b[Pp]ara cerrar bien la solicitud\s*(me falta|necesito)?/g, 'Me falta')
    .replace(/\b[Rr]evisa el resumen(?: de la derecha)?\s*y\s*/g, '')
    .replace(/\s+/g, ' '), 1200);
}

function readableMissingList(missingFields = []) {
  const prompts = getMissingPrompts(missingFields);
  const names = prompts.map(item => item.field.toLowerCase());
  if (!names.length) return '';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

function missingFieldSet(detection) {
  return new Set(Array.isArray(detection.missingFields) ? detection.missingFields : []);
}

function buildProgressPhrase(detection) {
  const known = [];

  if (detection.whatText) known.push('la pieza');
  if (detection.piecesText) known.push('la cantidad');
  if (detection.detailText) {
    if (/^Medida:/i.test(detection.detailText)) known.push('la medida');
    else if (/Color\/tono:/i.test(detection.detailText)) known.push('los colores');
    else known.push('los detalles principales');
  }
  if (detection.dateText) known.push('la fecha');
  if (detection.referenceImages.length) known.push('la referencia');

  if (!known.length) return '';
  if (known.length === 1) return `Ya tengo ${known[0]}. `;
  return `Ya tengo ${known.slice(0, -1).join(', ')} y ${known[known.length - 1]}. `;
}

function buildNaturalMissingReply(detection) {
  const missing = missingFieldSet(detection);
  const latest = detection.latestUserText;
  const progress = buildProgressPhrase(detection);
  const hasOnly = (...fields) => missing.size === fields.length && fields.every(field => missing.has(field));

  if (isGreetingOnly(latest)) {
    return 'Va, armemos tu solicitud. Cuéntame qué pieza quieres, cuántas serían y para cuándo la necesitas. Si ya tienes color, medida o foto de referencia, también sirve.';
  }

  if (isQuestionAboutOptions(latest)) {
    return 'Puedes pedir una pieza nueva o modificar algo del catálogo: llaveros, figuras, piezas de resina, decoración o recuerdos. Cuéntame la idea principal y yo la voy acomodando.';
  }

  if (isQuestionAboutImage(latest) || missing.has('qué debe tomarse de la referencia')) {
    return 'La imagen ya queda como apoyo para el admin. Solo dime qué debe tomarse de ella: la forma, los colores, la pose, la textura, el personaje o únicamente la inspiración.';
  }

  if (hasOnly('color, acabado o estilo')) {
    return `${progress}Solo falta decidir el color o acabado. Puede ser, por ejemplo: azul y blanco, brillante, mate, pastel o al gusto del admin.`;
  }

  if (hasOnly('fecha en la que lo necesita')) {
    return `${progress}Solo falta la fecha. Dime para cuándo lo necesitas, o si por ahora solo quieres cotizar.`;
  }

  if (hasOnly('cantidad de piezas')) {
    return `${progress}Solo falta la cantidad. Dime cuántas piezas serían; si es una sola, con decir “1 pieza” basta.`;
  }

  if (hasOnly('detalles de tamaño, color, texto o estilo')) {
    return `${progress}Solo falta el detalle visual: medida, colores, texto, tema o acabado. Con una idea sencilla alcanza para que el admin pueda cotizar.`;
  }

  if (missing.has('color, acabado o estilo') && missing.has('fecha en la que lo necesita')) {
    return `${progress}Me faltan dos cosas: color o acabado, y la fecha. Por ejemplo: “en azul y blanco, acabado brillante, para el 15 de junio”.`;
  }

  if (missing.has('detalles de tamaño, color, texto o estilo') && missing.has('fecha en la que lo necesita')) {
    return `${progress}Me faltan los detalles de cómo la imaginas y la fecha. Puedes decirme medida, colores, texto o acabado, y para cuándo la necesitas.`;
  }

  if (missing.has('cantidad de piezas') && missing.has('fecha en la que lo necesita')) {
    return `${progress}Me falta saber cuántas piezas serían y para cuándo las necesitas.`;
  }

  if (missing.has('qué pieza quiere')) {
    return 'Todavía necesito la idea principal: qué pieza quieres crear o modificar. Puede ser una figura, llavero, topper, decoración, nombre, personaje o algo basado en una referencia.';
  }

  const missingText = readableMissingList(detection.missingFields);
  return `${progress}Me falta ${missingText}. Dime ese dato y lo acomodo en la solicitud.`;
}

function buildSpecificReply(input = {}, detection = detectCustomOrderState(input), aiReply = '') {
  if (detection.isComplete) {
    const cleanCompleteReply = sanitizeAiReply(aiReply);
    return compactText(cleanCompleteReply && !isGenericAiReply(cleanCompleteReply)
      ? cleanCompleteReply
      : 'Con eso ya queda lista la solicitud para revisión. Puedes enviarla cuando la información se vea correcta.', 1200);
  }

  const cleanAiReply = sanitizeAiReply(aiReply);
  if (cleanAiReply && !isGenericAiReply(cleanAiReply)) {
    return compactText(cleanAiReply, 1200);
  }

  return buildNaturalMissingReply(detection);
}

function buildCustomerFriendlySummary(detection) {
  const parts = [];

  if (detection.whatText) parts.push(detection.whatText);
  if (detection.piecesText) parts.push(detection.piecesText);
  if (detection.detailText) parts.push(detection.detailText);
  if (detection.dateText) parts.push(`Fecha: ${detection.dateText}`);
  if (detection.selectedProduct) parts.push(`Modelo base: ${detection.selectedProduct.name}.`);
  if (detection.referenceImages.length) parts.push(`Referencias subidas: ${detection.referenceImages.length}.`);

  return compactText(parts.join(' · '), 1500) || 'Solicitud personalizada pendiente de detallar.';
}

function buildNotesForAdmin(detection) {
  const parts = [];
  if (detection.whatText) parts.push(`Pieza solicitada: ${detection.whatText}.`);
  if (detection.piecesText) parts.push(`Cantidad: ${detection.piecesText}.`);
  if (detection.detailText) parts.push(`Detalles: ${detection.detailText}.`);
  if (detection.dateText) parts.push(`Fecha requerida: ${detection.dateText}.`);
  if (detection.selectedProduct) parts.push(`Modelo base: ${detection.selectedProduct.name}.`);
  if (detection.referenceImages.length) parts.push(`Referencias subidas: ${detection.referenceImages.length}. Revisar archivos adjuntos.`);
  if (detection.userText) parts.push(`Conversación del cliente: ${compactText(detection.userText, 900)}`);
  return compactText(parts.join(' '), 1500);
}

function buildLocalSummary(input = {}) {
  const detection = detectCustomOrderState(input);
  const selectedProduct = detection.selectedProduct;
  const what = detection.whatText || selectedProduct?.name || '';
  const title = what ? compactText(what, 80) : 'Pedido personalizado';

  return {
    reply: buildSpecificReply(input, detection),
    isComplete: detection.isComplete,
    missingFields: detection.missingFields,
    missingPrompts: getMissingPrompts(detection.missingFields),
    summary: normalizeSummary({
      title,
      what,
      how: detection.detailText,
      pieces: detection.piecesText,
      dateNeeded: detection.dateText,
      baseProduct: selectedProduct ? `${selectedProduct.name} (${selectedProduct.slug || selectedProduct.id})` : '',
      modifications: selectedProduct ? compactText(detection.userText, 900) : '',
      referenceImagesCount: detection.referenceImages.length,
      deliveryType: 'Por confirmar',
      notesForAdmin: buildNotesForAdmin(detection),
      customerFriendlySummary: buildCustomerFriendlySummary(detection)
    }),
    provider: 'local'
  };
}

function buildPrompt(input = {}) {
  const detection = detectCustomOrderState(input);
  const referenceImages = detection.referenceImages;
  const selectedProduct = detection.selectedProduct;
  const missingPrompts = getMissingPrompts(detection.missingFields);

  return `Eres el asistente de pedidos personalizados de Caja de Creaciones, un negocio de manualidades, resina, piezas 3D, llaveros, decoración y regalos hechos a mano.

Tu trabajo es conversar como asistente de mostrador: entender lo que el cliente escribe, acomodarlo en resumen y preguntar solamente lo que falte. El cliente no conoce los campos internos; no le hables como formulario.

Reglas duras:
- No prometas precio final, disponibilidad ni entrega final. El admin confirma todo.
- DeepSeek V4 por API trabaja texto; no estás interpretando visualmente las imágenes subidas. Si hay referencias, solo sabes que existen y debes pedir al cliente qué se toma de ellas.
- No repitas frases genéricas. Si ya entendiste algo, dilo de forma breve y pregunta solo lo que falte.
- No repitas el resumen completo en cada respuesta; el resumen ya se muestra en pantalla.
- No uses frases internas o raras para el cliente como “escríbelo normal”, “para cerrar bien la solicitud” o “dímelo en una frase”.
- Si falta información, pregunta máximo 1 o 2 cosas en lenguaje humano y amable.
- No confundas medidas con cantidad. "15 cm" es tamaño, no 15 piezas.
- Si el cliente dice "una figura" o "un llavero", eso puede contar como 1 pieza.
- Si el cliente elige un modelo del catálogo como base, úsalo como contexto y pregunta cambios concretos.
- Devuelve únicamente JSON válido. No markdown.

Campos faltantes detectados por el sistema:
${detection.missingFields.length ? JSON.stringify(detection.missingFields) : '[]'}

Instrucciones exactas para esos campos faltantes:
${missingPrompts.length ? JSON.stringify(missingPrompts) : '[]'}

Lectura local preliminar:
${JSON.stringify({
  what: detection.whatText,
  pieces: detection.piecesText,
  details: detection.detailText,
  dateNeeded: detection.dateText,
  isComplete: detection.isComplete
})}

Contexto del modelo base:
${selectedProduct ? JSON.stringify({ id: selectedProduct.id, slug: selectedProduct.slug, name: selectedProduct.name, category: selectedProduct.category, measures: selectedProduct.measures, material: selectedProduct.material, productionTime: selectedProduct.time, detail: selectedProduct.detail }) : 'Sin modelo base seleccionado.'}

Referencias subidas:
${referenceImages.length ? JSON.stringify(referenceImages.map((item, index) => ({ index: index + 1, url: item.url, name: item.name || 'referencia', note: 'Archivo guardado para revisión del admin. No se interpreta visualmente por DeepSeek en este flujo.' }))) : 'Sin referencias subidas.'}

Formato obligatorio:
{
  "reply": "mensaje natural y específico para el cliente. Debe ser breve, no repetir el resumen completo, no decir escríbelo normal, y preguntar solo lo que falta.",
  "isComplete": false,
  "missingFields": ["campo faltante"],
  "missingPrompts": [{ "field": "campo", "prompt": "qué debe escribir el cliente", "example": "ejemplo corto" }],
  "summary": {
    "title": "título corto del pedido",
    "what": "qué quiere el cliente",
    "how": "cómo lo quiere: estilo, colores, medidas, tema, material, texto, etc.",
    "pieces": "cantidad de piezas o lotes; no uses cm como cantidad",
    "dateNeeded": "fecha deseada o urgencia en texto claro",
    "baseProduct": "modelo base elegido o vacío",
    "modifications": "cambios solicitados sobre el modelo base o referencias",
    "referenceImagesCount": 0,
    "deliveryType": "tipo de entrega si se mencionó, si no Por confirmar",
    "notesForAdmin": "resumen operativo para que el admin cotice y revise",
    "customerFriendlySummary": "resumen claro para mostrar al cliente antes de enviar"
  }
}`;
}

function summaryLooksLikeWholeText(value, detection) {
  const a = normalizeForMatch(value);
  const b = normalizeForMatch(detection.userText);
  return a && b && (a === b || a.length > 24 && b.includes(a) && a.length > b.length * 0.78);
}

function repairSummary(summary, detection, fallbackSummary) {
  const repaired = normalizeSummary(summary);
  const fallback = normalizeSummary(fallbackSummary);

  if (!repaired.what || summaryLooksLikeWholeText(repaired.what, detection)) {
    repaired.what = fallback.what || repaired.what;
  }

  if (!repaired.how || summaryLooksLikeWholeText(repaired.how, detection)) {
    repaired.how = fallback.how || repaired.how;
  }

  const repairedPiecesNorm = normalizeForMatch(repaired.pieces);
  if (!repaired.pieces || (/\b15\s*piezas\b/.test(repairedPiecesNorm) && /\b15\s*cm\b/i.test(detection.userText))) {
    repaired.pieces = fallback.pieces || '';
  }

  if (!repaired.dateNeeded) repaired.dateNeeded = fallback.dateNeeded || '';
  if (!repaired.baseProduct) repaired.baseProduct = fallback.baseProduct || '';

  if (!repaired.modifications || (!detection.selectedProduct && summaryLooksLikeWholeText(repaired.modifications, detection))) {
    repaired.modifications = fallback.modifications || '';
  }

  repaired.referenceImagesCount = detection.referenceImages.length;
  repaired.notesForAdmin = repaired.notesForAdmin || fallback.notesForAdmin;
  repaired.customerFriendlySummary = repaired.customerFriendlySummary || fallback.customerFriendlySummary;

  return repaired;
}

function normalizeAiResponse(parsed, fallbackInput = {}) {
  const detection = detectCustomOrderState(fallbackInput);
  const fallback = buildLocalSummary(fallbackInput);
  const source = parsed && typeof parsed === 'object' ? parsed : {};
  const sourceMissingPrompts = Array.isArray(source.missingPrompts) ? source.missingPrompts : [];
  const missingFields = detection.missingFields.length
    ? detection.missingFields
    : Array.isArray(source.missingFields)
      ? source.missingFields.map(item => compactText(item, 140)).filter(Boolean).slice(0, 8)
      : [];
  const missingPrompts = missingFields.length
    ? getMissingPrompts(missingFields)
    : sourceMissingPrompts;
  const summary = repairSummary(source.summary || fallback.summary, detection, fallback.summary);

  return {
    reply: buildSpecificReply(fallbackInput, { ...detection, missingFields, isComplete: missingFields.length === 0 }, source.reply || ''),
    isComplete: missingFields.length === 0,
    missingFields,
    missingPrompts,
    summary,
    provider: 'deepseek'
  };
}

async function analyzeCustomOrder(input = {}) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseUrl = String(process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
  const model = process.env.DEEPSEEK_JSON_MODEL || process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
  const timeoutMs = Math.max(8000, Number(process.env.DEEPSEEK_TIMEOUT_MS || 45000));
  const messages = normalizeMessages(input.messages);
  const normalizedInput = {
    ...input,
    messages,
    referenceImages: normalizeReferenceImages(input.referenceImages)
  };

  if (!apiKey) {
    return {
      ...buildLocalSummary(normalizedInput),
      aiEnabled: false
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: buildPrompt(normalizedInput) },
          ...messages.map(message => ({ role: message.role, content: message.content }))
        ]
      }),
      signal: controller.signal
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error?.message || data.message || 'No se pudo consultar DeepSeek.');
      error.status = response.status >= 400 && response.status < 500 ? 400 : 502;
      throw error;
    }

    const content = data.choices?.[0]?.message?.content || '';
    const parsed = parseJsonObject(content);
    const normalized = normalizeAiResponse(parsed, normalizedInput);

    return {
      ...normalized,
      raw: parsed || null,
      aiEnabled: true
    };
  } catch (error) {
    console.warn('[deepseek-custom-order]', error.message);
    return {
      ...buildLocalSummary(normalizedInput),
      aiEnabled: false,
      warning: error.name === 'AbortError' ? 'DeepSeek tardó demasiado. Se usó resumen local temporal.' : error.message
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  analyzeCustomOrder,
  normalizeMessages,
  normalizeReferenceImages,
  normalizeSummary,
  detectCustomOrderState,
  getMissingPrompts
};
