// Normalization and hashing rules shared by every contract file (design §4).
import { createHash } from 'node:crypto';

export const nfc = (s) => s.normalize('NFC');

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
export const graphemeCount = (s) => {
  let n = 0;
  for (const _ of segmenter.segment(s)) n++;
  return n;
};

// Code point length; ranges in contracts are code point offsets.
export const cpLength = (s) => [...s].length;
export const cpSlice = (s, start, end) => [...s].slice(start, end).join('');

export const sha256Hex = (data) => createHash('sha256').update(data).digest('hex');

// Keys sorted recursively, no whitespace, finite numbers only, JSON.stringify number form.
export function canonicalJson(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`non-finite number in canonical JSON: ${value}`);
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  throw new Error(`unsupported type in canonical JSON: ${typeof value}`);
}

export const hashJson = (value) => sha256Hex(Buffer.from(canonicalJson(value), 'utf8'));

// Phrase ID: <sentenceId>-<first 8 hex of sha256(NFC display)>, with -2, -3 for repeats in a sentence.
export const phraseHash = (display) => sha256Hex(Buffer.from(nfc(display), 'utf8')).slice(0, 8);

export function phraseIdsForSentence(sentenceId, displays) {
  const seen = new Map();
  return displays.map((d) => {
    const n = (seen.get(d) ?? 0) + 1;
    seen.set(d, n);
    const base = `${sentenceId}-${phraseHash(d)}`;
    return n === 1 ? base : `${base}-${n}`;
  });
}
