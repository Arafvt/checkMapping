export const DEFAULT_CONFIG = {
  requireTokenJaccardForStrict: false,
  tokenJaccardMinForStrict: 0.92,
  countNoMatchAsFail: true,
  strictUnitConsistency: true,
};

const FLAVORS = [
  "клубника", "клубнич", "яблоко", "яблоч", "вишня", "вишнев", "виноград", "арбуз", "дыня",
  "апельсин", "лимон", "лайм", "мята", "ментол", "ваниль", "шоколад", "какао", "банан",
  "малина", "черника", "смородина", "персик", "манго", "ананас", "орех", "фундук", "миндаль",
  "кокос", "кофе", "капучино", "мед", "карамель", "корица"
];

const MODIFIERS = [
  "без сахара", "с сахаром", "zero", "0%", "безлактозн", "без лактоз", "light", "лайт",
  "classic", "классич", "original", "оригинал", "без глютена", "безглютен"
];

const STOPWORDS = new Set([
  "и", "в", "на", "для", "по", "штук", "уп", "упак", "упаковка", "пак", "пакет",
  "бут", "бутылка", "стакан", "банка", "коробка", "цена", "со", "с", "от"
]);

const DROP_TOKENS = new Set([
  "набор", "мини", "minis", "минис", "шоколад", "шоколадный", "конфеты", "конфета",
  "ассорти", "подарочный", "праздничный", "premium", "премиум", "новинка",
  "снеговик", "елка", "елочка", "дед", "мороз"
]);

function normalizeText(s) {
  if (!s) return "";
  return String(s)
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[®™]/g, " ")
    .replace(/[\(\)\[\]\{\}]/g, " ")
    .replace(/[.,;:!?/\\|'"`~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(s) {
  if (!s) return [];

  let t = String(s)
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/(\d),(\d)/g, "$1.$2");
  t = t
    .replace(/(\d+(?:[.,]\d+)?)([a-zа-я]+)/gi, "$1 $2")
    .replace(/([a-zа-я]+)(\d+(?:[.,]\d+)?)/gi, "$1 $2"); 

  // Нормализация "число + единица" -> "число <каноническая_единица>"
  t = t
    .replace(/(\d+(?:[.,]\d+)?)\s*(л|l|литр|литра|литров)\b/gi, "$1 л")
    .replace(/(\d+(?:[.,]\d+)?)\s*(мл|ml)\b/gi, "$1 мл")
    .replace(/(\d+(?:[.,]\d+)?)\s*(кг|kg)\b/gi, "$1 кг")
    .replace(/(\d+(?:[.,]\d+)?)\s*(г|гр|грамм|грамма|граммов|g|gram)\b/gi, "$1 г")
    .replace(/(\d+(?:[.,]\d+)?)\s*(%|процента|процентов)\b/gi, "$1 %")
    .replace(/(\d+(?:[.,]\d+)?)\s*(шт|штук|pcs|piece)\b/gi, "$1 шт");

  // Сохраняем десятичные точки
  t = t.replace(/(\d)\.(\d)/g, "$1__DOT__$2");

  t = t
    .replace(/[®™]/g, " ")
    .replace(/[\(\)\[\]\{\}]/g, " ")
    .replace(/[.,;:!?/\\|'"`~]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/__DOT__/g, ".");

  const tokens = t.split(" ").filter(Boolean);

  return tokens.filter(w => !STOPWORDS.has(w));
}

function canonicalKey(text) {
  const toks = tokenize(text)
    .filter(t => !DROP_TOKENS.has(t))
    .filter(t => !/^\d+(\.\d+)?$/.test(t))
    .filter(t => !/^\d+%$/.test(t))
    .filter(t => !/^\d+(\.\d+)?(г|гр|кг|мл|л|шт|%)$/.test(t));

  return toks.sort().join(" ");
}


function extractVolumeOrWeight(text) {
  const raw = String(text ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[\u00A0\u202F]/g, " ")
    .trim();

  const num = (x) => {
    const v = parseFloat(String(x).replace(",", "."));
    return Number.isNaN(v) ? null : v;
  };

  let m = raw.match(/(?:^|[^0-9])(\d+(?:[.,]\d+)?)[\s ]*(л|l|литр|литра|литров)(?:$|[^а-яa-z])/i);
  if (m) {
    const v = num(m[1]);
    if (v !== null) return { kind: "ml", value: Math.round(v * 1000) };
  }

  m = raw.match(/(?:^|[^0-9])(\d+(?:[.,]\d+)?)[\s ]*(мл|ml)(?:$|[^а-яa-z])/i);
  if (m) {
    const v = num(m[1]);
    if (v !== null) return { kind: "ml", value: Math.round(v) };
  }

  m = raw.match(/(?:^|[^0-9])(\d+(?:[.,]\d+)?)[\s ]*(кг|kg)(?:$|[^а-яa-z])/i);
  if (m) {
    const v = num(m[1]);
    if (v !== null) return { kind: "g", value: Math.round(v * 1000) };
  }

  m = raw.match(/(?:^|[^0-9])(\d+(?:[.,]\d+)?)[\s ]*(г|гр|грамм|грамма|граммов|g|gram)(?:$|[^а-яa-z])/i);
  if (m) {
    const v = num(m[1]);
    if (v !== null) return { kind: "g", value: Math.round(v) };
  }

  return null;
}

function extractPercent(text) {
  const raw = String(text ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[\u00A0\u202F]/g, " ")
    .trim();

  const m = raw.match(/(?:^|[^0-9])(\d+(?:[.,]\d+)?)[\s ]*%(?:$|[^0-9])/);
  if (!m) return null;

  const v = parseFloat(String(m[1]).replace(",", "."));
  return Number.isNaN(v) ? null : v;
}

function extractUnitOnly(text) {
  const s = String(text ?? "").toLowerCase().replace(/ё/g, "е");

  if (/\bкг\b/.test(s) || /\bkg\b/.test(s)) return "kg_only";
  if (/\bшт\b/.test(s) || /\bштук\b/.test(s)) return "pcs_only";
  if (/\bуп\b/.test(s) || /\bупак\b/.test(s) || /\bупаковк/.test(s)) return "pack_only";

  return null;
}

function getProductType(text) {
  if (!text) return "unknown";

  const s = String(text).toLowerCase().replace(/ё/g, "е");

  // Проверяем в порядке приоритета
  if (/\b(кг|kg)\b/.test(s)) return "weight";
  if (/\b(г|гр|грамм|g)\b/.test(s)) return "weight";
  if (/\b(литр|л)\b/.test(s)) return "volume";
  if (/\b(ml|мл)\b/.test(s)) return "volume";
  if (/\b(шт|штук|pcs|piece)\b/.test(s)) return "pcs";
  if (/\b(уп|упак|pack|упаковк)\b/.test(s)) return "pack";

  return "unknown";
}

// Проверка, есть ли явная единица измерения
function hasExplicitUnit(text) {
  return getProductType(text) !== "unknown";
}

function buildDetails(sourceName, targetName, srcProductType, tgtProductType) {
  return {
    source: {
      title: sourceName ?? "",
      volumeOrWeight: extractVolumeOrWeight(sourceName),
      percent: extractPercent(sourceName),
      unitOnly: extractUnitOnly(sourceName),
      productType: srcProductType,
      hasExplicitUnit: srcProductType !== "unknown",
      flavor: extractFlavor(sourceName),
      modifiers: extractModifiers(sourceName),
      canonicalKey: canonicalKey(sourceName),
      tokens: tokenize(sourceName),
    },
    target: {
      title: targetName ?? "",
      volumeOrWeight: extractVolumeOrWeight(targetName),
      percent: extractPercent(targetName),
      unitOnly: extractUnitOnly(targetName),
      productType: tgtProductType,
      hasExplicitUnit: tgtProductType !== "unknown",
      flavor: extractFlavor(targetName),
      modifiers: extractModifiers(targetName),
      canonicalKey: canonicalKey(targetName),
      tokens: tokenize(targetName),
    },
    tokenJaccard: 0,
  };
}

function canonicalFlavor(f) {
  if (f.startsWith("клубнич")) return "клубника";
  if (f.startsWith("яблоч")) return "яблоко";
  if (f.startsWith("вишнев")) return "вишня";
  return f;
}

function extractFlavor(text) {
  const s = normalizeText(text);
  for (const f of FLAVORS) if (s.includes(f)) return canonicalFlavor(f);
  return null;
}

function extractModifiers(text) {
  const s = normalizeText(text);
  const set = new Set();
  for (const m of MODIFIERS) if (s.includes(m)) set.add(m);
  if (set.has("0%")) set.add("zero");
  return Array.from(set).sort();
}

function jaccard(aArr, bArr) {
  const a = new Set(aArr);
  const b = new Set(bArr);
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 1 : inter / union;
}

export function checkMapping(sourceName, targetName, config = DEFAULT_CONFIG) {
  const reasons = [];

  const srcProductType = getProductType(sourceName);
  const tgtProductType = getProductType(targetName);

  // Базовые проверки
  if (!targetName || String(targetName).trim() === "") {
    reasons.push("NO_MATCH_TITLE");
    const details = buildDetails(sourceName, targetName, srcProductType, tgtProductType);
    return { feature_ok: false, strict_ok: false, reasons, tokenJaccard: 0, details };
  }

  let feature_ok = true;

  // ГЛАВНОЕ ПРАВИЛО: если в источнике есть единица измерения, а в цели нет - ОШИБКА
  if (config.strictUnitConsistency) {
    if (srcProductType !== "unknown" && tgtProductType === "unknown") {
      reasons.push("UNIT_MISSING_IN_TARGET");
      feature_ok = false;
    }
    // Также проверяем несоответствие типов (вес vs штуки и т.д.)
    else if (srcProductType !== "unknown" && tgtProductType !== "unknown" && srcProductType !== tgtProductType) {
      reasons.push("UNIT_TYPE_MISMATCH");
      feature_ok = false;
    }
  }

  // Подготавливаем детали для остальных проверок
  const details = buildDetails(sourceName, targetName, srcProductType, tgtProductType);

  if (!feature_ok && reasons.includes("UNIT_MISSING_IN_TARGET")) {
    const jac = jaccard(details.source.tokens, details.target.tokens);
    details.tokenJaccard = jac;

    const srcKey = details.source.canonicalKey;
    const tgtKey = details.target.canonicalKey;
    const strict_ok = false; 

    return { feature_ok, strict_ok, reasons, tokenJaccard: jac, details };
  }

  // Продолжаем остальные проверки, если ошибки единиц нет
  const srcVol = details.source.volumeOrWeight;
  const tgtVol = details.target.volumeOrWeight;
  if (srcVol || tgtVol) {
    if (!srcVol || !tgtVol) {
      reasons.push("VOLUME_MISSING_ONE_SIDE");
      feature_ok = false;
    } else if (srcVol.kind !== tgtVol.kind || srcVol.value !== tgtVol.value) {
      reasons.push("VOLUME_MISMATCH");
      feature_ok = false;
    }
  }

  // Проверка unitOnly
  const srcU = details.source.unitOnly;
  const tgtU = details.target.unitOnly;
  if (srcU || tgtU) {
    if (!srcU || !tgtU) {
      reasons.push("UNIT_ONLY_MISSING_ONE_SIDE");
      feature_ok = false;
    } else if (srcU !== tgtU) {
      reasons.push("UNIT_ONLY_MISMATCH");
      feature_ok = false;
    }
  }

  // Проверка процентов
  const srcPct = details.source.percent;
  const tgtPct = details.target.percent;
  if (srcPct !== null || tgtPct !== null) {
    if (srcPct === null || tgtPct === null) {
      reasons.push("PERCENT_MISSING_ONE_SIDE");
      feature_ok = false;
    } else if (srcPct !== tgtPct) {
      reasons.push("PERCENT_MISMATCH");
      feature_ok = false;
    }
  }

  // Проверка вкуса
  const srcFlavor = details.source.flavor;
  const tgtFlavor = details.target.flavor;
  if (srcFlavor !== null || tgtFlavor !== null) {
    if (srcFlavor === null || tgtFlavor === null) {
      reasons.push("FLAVOR_MISSING_ONE_SIDE");
      feature_ok = false;
    } else if (srcFlavor !== tgtFlavor) {
      reasons.push("FLAVOR_MISMATCH");
      feature_ok = false;
    }
  }

  // Проверка модификаторов
  const srcMods = details.source.modifiers;
  const tgtMods = details.target.modifiers;
  if (srcMods.join("|") !== tgtMods.join("|")) {
    if (!(srcMods.length === 0 && tgtMods.length === 0)) {
      reasons.push("MODIFIER_MISMATCH");
      feature_ok = false;
    }
  }

  // Jaccard similarity
  const jac = jaccard(details.source.tokens, details.target.tokens);
  details.tokenJaccard = jac;

  // Проверка canonical key
  const srcKey = details.source.canonicalKey;
  const tgtKey = details.target.canonicalKey;

  let strict_ok = feature_ok && (srcKey === tgtKey);

  if (strict_ok && config.requireTokenJaccardForStrict && jac < config.tokenJaccardMinForStrict) {
    strict_ok = false;
    reasons.push(`TOKEN_DIFF_FOR_STRICT(jaccard=${jac.toFixed(3)})`);
  }

  if (feature_ok && !strict_ok) reasons.push("CANONICAL_KEY_DIFF");

  return { feature_ok, strict_ok, reasons, tokenJaccard: jac, details };
}

export function evaluateRow(item, config = DEFAULT_CONFIG) {
  const title = item?.title ?? "";
  const matched = item?.matched_csv_title ?? "";
  const bestMatch = item?.best_match ?? "";
  const baseReasons = [];

  if (bestMatch === "no_match") baseReasons.push("BEST_MATCH_NO_MATCH");

  const v = checkMapping(title, matched, config);
  const reasonsArr = [...baseReasons, ...v.reasons];

  const ok = config.countNoMatchAsFail
    ? (v.strict_ok && bestMatch !== "no_match")
    : v.strict_ok;

  return {
    ok,
    feature_ok: v.feature_ok,
    strict_ok: v.strict_ok,
    reasons: reasonsArr.join("|"),
    tokenJaccard: Number(v.tokenJaccard),

    id: item?.id ?? item?.product_id ?? item?._id ?? "",
    source: item?.source ?? "",
    best_match: bestMatch,
    match_confidence: item?.match_confidence ?? "",
    matched_uuid: item?.matched_uuid ?? "",

    title,
    matched_csv_title: matched,

    __raw: item,
    __details: v.details,
    __reasonsArr: reasonsArr,
  };
}

export function buildReasonStats(rows) {
  const stats = {};
  for (const r of rows) {
    const parts = String(r.reasons || "").split("|").filter(Boolean);
    for (const p of parts) stats[p] = (stats[p] || 0) + 1;
  }
  return stats;
}

export function summarize(rows) {
  const total = rows.length;
  const ok = rows.filter(r => r.ok).length;
  const fail = total - ok;
  return { total, ok, fail };
}

// Дополнительная функция для отладки
export function debugProductTypes(rows) {
  return rows.map(row => ({
    title: row.title,
    matched: row.matched_csv_title,
    sourceType: getProductType(row.title),
    targetType: getProductType(row.matched_csv_title),
    sourceCanonical: canonicalKey(row.title),
    targetCanonical: canonicalKey(row.matched_csv_title),
    hasError: getProductType(row.title) !== "unknown" && getProductType(row.matched_csv_title) === "unknown"
  }));
}

export const REASON_LABELS = {
  BEST_MATCH_NO_MATCH: "Лучший матч: не найдено совпадение",
  NO_MATCH_TITLE: "Нет названия совпадения (matched пустой)",
  CANONICAL_KEY_DIFF: "Ключевые слова отличаются (canonical key)",
  UNIT_MISSING_IN_TARGET: "В цели отсутствует единица измерения",
  UNIT_TYPE_MISMATCH: "Единицы измерения разного типа (вес/объем/шт/уп)",
  VOLUME_MISSING_ONE_SIDE: "Отсутствует объём/вес у одной из сторон",
  VOLUME_MISMATCH: "Объём/вес не совпадает",
  UNIT_ONLY_MISSING_ONE_SIDE: "Единица (только тип) указана лишь у одной стороны",
  UNIT_ONLY_MISMATCH: "Единица (только тип) не совпадает",
  PERCENT_MISSING_ONE_SIDE: "Процент указан лишь у одной стороны",
  PERCENT_MISMATCH: "Процент не совпадает",
  FLAVOR_MISSING_ONE_SIDE: "Вкус указан лишь у одной стороны",
  FLAVOR_MISMATCH: "Вкус не совпадает",
  MODIFIER_MISMATCH: "Модификаторы (без сахара/zero/…) не совпадают",
  MANUAL_OK: "Подтверждено вручную",
};
