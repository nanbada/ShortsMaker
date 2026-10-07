// Pronunciation substitution (design §4.3) and caption phrase splitting (§7.1).
import { graphemeCount, cpSlice, sha256Hex, hashJson, phraseHash, phraseIdsForSentence } from './canon.mjs';

const PUNCT = new Set([',', '.', '?', '!', '…', ';', ':', '。', '，', '？', '！', '、']);
// Closing marks right after a cut stay with the piece they close.
const CLOSERS = new Set(['"', "'", ')', ']', '”', '’', '」', '』', '）']);
const isDigit = (c) => c !== undefined && c >= '0' && c <= '9';
const isSpace = (c) => /\s/u.test(c);

// Merge dictionaries in order; later entries win for the same display key.
export function mergeDicts(dicts) {
  const map = new Map();
  for (const d of dicts) for (const e of d.entries) map.set(e.display, e.spoken);
  return [...map].map(([display, spoken]) => ({ display, spoken }));
}

// Left to right, longest key first at each position, exact match, no overlap.
// Returns spoken text and substitution ranges in code points.
export function applyPronounce(display, entries) {
  const d = [...display];
  const keys = entries.map((e) => ({ k: [...e.display], s: [...e.spoken] })).sort((a, b) => b.k.length - a.k.length);
  const out = [];
  const subs = [];
  let i = 0;
  while (i < d.length) {
    const m = keys.find((e) => i + e.k.length <= d.length && e.k.every((c, j) => d[i + j] === c));
    if (m) {
      subs.push({ display: [i, i + m.k.length], spoken: [out.length, out.length + m.s.length] });
      out.push(...m.s);
      i += m.k.length;
    } else {
      out.push(d[i]);
      i += 1;
    }
  }
  return { spoken: out.join(''), subs };
}

// Display position (never strictly inside a substitution) → spoken position.
const mapPos = (p, subs) => subs.reduce(
  (pos, s) => (s.display[1] <= p ? pos + (s.spoken[1] - s.spoken[0]) - (s.display[1] - s.display[0]) : pos),
  p,
);
const inSub = (i, subs) => subs.some((s) => s.display[0] <= i && i < s.display[1]);

function trimRange(chars, a, b) {
  while (a < b && isSpace(chars[a])) a++;
  while (b > a && isSpace(chars[b - 1])) b--;
  return [a, b];
}

// First-level ranges: cut after a run of punctuation, except inside substitutions and
// between digits (1,200 / 3.14).
function punctuationRanges(chars, subs) {
  const ranges = [];
  let start = 0;
  for (let i = 0; i < chars.length; i++) {
    if (!PUNCT.has(chars[i]) || inSub(i, subs) || PUNCT.has(chars[i + 1])) continue;
    if ((chars[i] === ',' || chars[i] === '.') && isDigit(chars[i - 1]) && isDigit(chars[i + 1])) continue;
    let end = i + 1;
    while (end < chars.length && CLOSERS.has(chars[end]) && !inSub(end, subs)) end++;
    ranges.push([start, end]);
    start = end;
    i = end - 1;
  }
  ranges.push([start, chars.length]);
  return ranges.map(([a, b]) => trimRange(chars, a, b)).filter(([a, b]) => a < b);
}

// Whitespace tokens inside [a, b), merged so no substitution spans two tokens.
function tokens(chars, a, b, subs) {
  const toks = [];
  let i = a;
  while (i < b) {
    while (i < b && isSpace(chars[i])) i++;
    if (i >= b) break;
    let j = i;
    while (j < b && !isSpace(chars[j])) j++;
    toks.push([i, j]);
    i = j;
  }
  const merged = [];
  for (const t of toks) {
    const prev = merged[merged.length - 1];
    if (prev && subs.some((s) => s.display[0] < prev[1] && s.display[1] > t[0])) prev[1] = t[1];
    else merged.push([...t]);
  }
  return merged;
}

// Splits one sentence. Returns { ranges: [[a,b)...] } or { error }.
export function splitSentence(display, subs, maxGraphemes) {
  const chars = [...display];
  const g = (a, b) => graphemeCount(chars.slice(a, b).join(''));
  const out = [];
  for (const [a, b] of punctuationRanges(chars, subs)) {
    if (g(a, b) <= maxGraphemes) {
      out.push([a, b]);
      continue;
    }
    let cur = null;
    for (const t of tokens(chars, a, b, subs)) {
      if (g(t[0], t[1]) > maxGraphemes) {
        return { error: `"${chars.slice(t[0], t[1]).join('')}" exceeds ${maxGraphemes} graphemes and cannot be split` };
      }
      if (cur && g(cur[0], t[1]) <= maxGraphemes) cur[1] = t[1];
      else {
        if (cur) out.push(cur);
        cur = [...t];
      }
    }
    out.push(cur);
  }
  return { ranges: out };
}

// script: parsed script.json (NFC). dicts: pronounce dictionaries, common first.
// lang: languages.json entry for the script language; alias: 'ko', 'en', ...
export function buildPhrasing(script, dicts, lang, alias) {
  const entries = mergeDicts(dicts);
  const errors = [];
  const warnings = [];
  const phrases = [];
  const spokenLines = [];
  const ttsLines = [];
  for (const s of script.sentences) {
    let spoken;
    let ranges;
    if (s.spoken !== undefined) {
      spoken = s.spoken;
      const chars = [...s.display];
      const [a, b] = trimRange(chars, 0, chars.length);
      if (graphemeCount(chars.slice(a, b).join('')) > lang.maxCaptionGraphemes) {
        errors.push({ code: 'spoken-override-too-long', sentenceId: s.id,
          message: `sentence with "spoken" must fit one caption (${lang.maxCaptionGraphemes} graphemes)` });
        continue;
      }
      ranges = [{ display: [a, b], spoken: [0, [...spoken].length] }];
    } else {
      const r = applyPronounce(s.display, entries);
      spoken = r.spoken;
      const split = splitSentence(s.display, r.subs, lang.maxCaptionGraphemes);
      if (split.error) {
        errors.push({ code: 'unsplittable', sentenceId: s.id, message: split.error });
        continue;
      }
      ranges = split.ranges.map(([a, b]) => ({ display: [a, b], spoken: [mapPos(a, r.subs), mapPos(b, r.subs)] }));
    }
    if (alias === 'ko' && /[0-9]/.test(spoken)) {
      warnings.push({ code: 'spoken-digits', sentenceId: s.id, message: `digits left in spoken text: ${spoken}` });
    }
    spokenLines.push(spoken);
    ttsLines.push(s.tag ? `[${s.tag}] ${spoken}` : spoken);
    const displays = ranges.map((r) => cpSlice(s.display, r.display[0], r.display[1]));
    const ids = phraseIdsForSentence(s.id, displays);
    const byHash = new Map();
    displays.forEach((d) => {
      const h = phraseHash(d);
      if (byHash.has(h) && byHash.get(h) !== d) {
        errors.push({ code: 'phrase-id-collision', sentenceId: s.id, message: `"${byHash.get(h)}" and "${d}" share ${h}` });
      }
      byHash.set(h, d);
    });
    ranges.forEach((r, k) => phrases.push({
      id: ids[k],
      sentenceId: s.id,
      display: displays[k],
      spoken: cpSlice(spoken, r.spoken[0], r.spoken[1]),
      displayRange: r.display,
      spokenRange: r.spoken,
    }));
  }
  const spokenText = spokenLines.join('\n');
  return {
    errors,
    warnings,
    phrases,
    spokenLines,
    spokenText,
    ttsText: ttsLines.join('\n'),
    spokenSha256: sha256Hex(Buffer.from(spokenText, 'utf8')),
    phrasingSha256: hashJson(phrases),
  };
}
