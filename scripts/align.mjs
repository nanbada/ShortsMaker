// Forced alignment → phrase times (design §7.2). S1 has only the character mapping (step 3–4);
// the API call, checks (steps 5–6), and cache arrive in S2.

const isSpace = (c) => /\s/u.test(c);

// spokenLines: spoken text per sentence (joined with '\n' for alignment).
// characters: [{text, start, end}] from the API (seconds). phrases: from buildPhrasing.
// Whitespace is skipped on both sides; other characters must match one to one.
export function phraseTimes(spokenLines, characters, phrases, sentenceIds) {
  const ours = [];
  let offset = 0;
  const lineStart = new Map();
  spokenLines.forEach((line, k) => {
    lineStart.set(sentenceIds[k], offset);
    [...line].forEach((c, i) => { if (!isSpace(c)) ours.push({ c, pos: offset + i }); });
    offset += [...line].length + 1;
  });
  const theirs = characters.filter((ch) => !isSpace(ch.text));
  if (theirs.length !== ours.length || theirs.some((ch, i) => ch.text !== ours[i].c)) {
    const k = theirs.findIndex((ch, j) => ch.text !== ours[j]?.c);
    const i = k >= 0 ? k : Math.min(theirs.length, ours.length);
    throw new Error(`mapping-error at non-space character ${i}: ours "${ours[i]?.c}" vs aligner "${theirs[i]?.text}"`);
  }
  const at = new Map(ours.map((o, i) => [o.pos, theirs[i]]));
  return phrases.map((p) => {
    const base = lineStart.get(p.sentenceId);
    const hits = [];
    for (let q = base + p.spokenRange[0]; q < base + p.spokenRange[1]; q++) if (at.has(q)) hits.push(at.get(q));
    return { id: p.id, startMs: Math.round(hits[0].start * 1000), endMs: Math.round(hits[hits.length - 1].end * 1000) };
  });
}
