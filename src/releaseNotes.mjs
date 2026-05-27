const MAX_RELEASE_NOTE_ITEMS = 8;

export function localizedReleaseNoteSummary(notes, lang) {
  return notes.localized?.[lang]?.summary
    || notes.localized?.en?.summary
    || firstPlainReleaseNote(notes.releaseNotes);
}

export function localizedReleaseNoteItems(notes, lang) {
  const localized = notes.localized?.[lang]?.items || notes.localized?.en?.items;
  if (Array.isArray(localized)) return localized.filter(Boolean);
  const items = parseReleaseNoteItems(notes.releaseNotes);
  const summary = firstPlainReleaseNote(notes.releaseNotes);
  return summary && items[0] === summary && items.length > 1 ? items.slice(1) : items;
}

export function hasReleaseNoteContent(notes) {
  return Boolean(
    String(notes?.releaseNotes || "").trim()
    || notes?.localized?.zh?.summary
    || notes?.localized?.zh?.items?.length
    || notes?.localized?.en?.summary
    || notes?.localized?.en?.items?.length
  );
}

export function withBuiltinReleaseNotesFallback(notes, builtin) {
  if (!notes) return builtin || null;
  if (hasReleaseNoteContent(notes) || !hasReleaseNoteContent(builtin)) return notes;
  return {
    ...notes,
    releaseName: notes.releaseName || builtin.releaseName,
    releaseUrl: notes.releaseUrl || builtin.releaseUrl || "",
    localized: builtin.localized,
  };
}

export function firstPlainReleaseNote(value) {
  const raw = String(value || "");
  const paragraph = extractHtmlParagraphs(raw)[0];
  if (paragraph) return paragraph;
  const items = parseReleaseNoteItems(raw);
  if (items[0]) return items[0];
  return rawToLines(raw)
    .map(cleanReleaseNoteLine)
    .find(Boolean) || raw.trim();
}

export function parseReleaseNoteItems(value) {
  const raw = String(value || "");
  const htmlItems = extractHtmlListItems(raw);
  const lines = htmlItems.length ? htmlItems : rawToLines(raw);
  return lines
    .map(cleanReleaseNoteLine)
    .filter(Boolean)
    .slice(0, MAX_RELEASE_NOTE_ITEMS);
}

export function parseReleaseVersion(value) {
  const match = String(value || "").match(/v?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/);
  return match ? match[1] : "";
}

function extractHtmlListItems(raw) {
  const items = [];
  const pattern = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let match = pattern.exec(raw);
  while (match) {
    items.push(match[1]);
    match = pattern.exec(raw);
  }
  return items;
}

function extractHtmlParagraphs(raw) {
  const paragraphs = [];
  const pattern = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let match = pattern.exec(raw);
  while (match) {
    const text = cleanReleaseNoteLine(match[1]);
    if (text) paragraphs.push(text);
    match = pattern.exec(raw);
  }
  return paragraphs;
}

function rawToLines(raw) {
  return htmlToText(raw).split(/\r?\n/);
}

function cleanReleaseNoteLine(line) {
  const original = String(line || "").trim();
  if (!original) return "";
  if (/^#+\s+/.test(original) || /^<h[1-6]\b/i.test(original) || /^<\/?(?:ul|ol)\b/i.test(original)) {
    return "";
  }
  return htmlToText(original)
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlToText(value) {
  return decodeHtmlEntities(String(value || "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "- ")
    .replace(/<\/(?:p|div|h[1-6]|li|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, ""));
}

function decodeHtmlEntities(value) {
  return String(value || "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_match, entity) => {
    const normalized = entity.toLowerCase();
    if (normalized[0] === "#") {
      const radix = normalized[1] === "x" ? 16 : 10;
      const number = Number.parseInt(normalized.slice(radix === 16 ? 2 : 1), radix);
      return Number.isFinite(number) ? String.fromCodePoint(number) : _match;
    }
    return ({
      amp: "&",
      lt: "<",
      gt: ">",
      quot: "\"",
      apos: "'",
      nbsp: " ",
    })[normalized] || _match;
  });
}
