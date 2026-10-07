# AGENTS.md — ShortsMaker

Code-rendered short-form video pipeline (YouTube Shorts / Reels) for a personal monetized channel. No generative video. Languages: ko, en first; ja, zh later.

Status: S0 implemented (v2 contracts, validator, time-conversion lib; 2026-10-07) except the ko/en listening sign-off. No renderer, TTS adapter, `/short` skill, or motion tool exists yet. Next work is S1 (templates, resolve, assemble, render) via the manual audio + timings path.

## Source of truth

Read only the sections a task needs, in this order:

1. `planning/2026-10-04-claude-code-render-plan-v2.md` — direction, data contract (§6), stages S0–S5 (§10)
2. `planning/2026-10-04-motion-catalog-and-preset-tool.md` — motion registry and assembly (§3), M0–M3
3. `planning/2026-10-04-plan-review.md` §7 — which review items were adopted
4. `planning/2026-10-04-implementation-design.md` — S0–S3 file layout, contract fields, script I/O, cache/run/approval rules, tests

`planning/archive/**` is history, not instructions. Do not revert to its defaults (Remotion-first, Azure TTS, VM night queue, English-only). If code and plan disagree, treat the plan as not yet implemented.

## Layout

```
planning/            current docs, handoff.md, worklog.md
planning/archive/    v1 and pre-v2 history
schemas/v1/          frozen v1.0.0 contract + validator (do not modify)
```

Create these only when their stage starts (plan v2 §6): `schemas/v2/`, `templates/`, `scripts/`, `motion/`, `jobs/<id>/<lang>/`, `cache/tts/`, `out/<id>/<lang>/<run-id>/`.

## Commands

```sh
npm test                                   # node --test, v2 contracts and libs
node scripts/gen.mjs [--check]             # regenerate / check schemas/v2/scenes.schema.json
node scripts/validate.mjs --job <id> --lang ko
node scripts/env-check.mjs                 # HyperFrames CLI + plugin vs config/tools.lock.json
python3 schemas/v1/validate_spec.py schemas/v1/video-spec.example.json
python3 -m unittest discover -s schemas/v1 -p 'test_*.py'
```

## Fixed design rules

- In production the AI writes data only (`scenes.json`). Templates and motion code are written and verified once during development; never generate HTML/GSAP per video.
- Narration is the master timeline. Each language runs its own script → TTS → alignment → scenes; never reuse another language's timeline.
- Deterministic render: no `Date.now()`, unseeded `Math.random()`, `requestAnimationFrame` loops, or network calls during render. Seeking to any frame must give the same image.
- Time units: screen time in integer frames (30 fps), audio and captions in ms. Convert to seconds only inside the engine adapter.
- Never overwrite outputs. Each run writes `out/<id>/<lang>/<run-id>/`; reuse a step only when its recorded hashes match.
- Unverified (language, effect, font) combinations are rejected before render, not discovered after.

## Ask the user first

Paid API calls beyond an approved budget, creating API keys, uploading or publishing, `git push`, deleting files, adding a dependency or service the plan does not name.

## Working rules

- Think before coding: state design, assumptions, and approach; implement after the user agrees. Ask instead of guessing; stop when confused.
- Simplicity first: no unrequested features, abstractions, options, or error handling.
- Surgical changes: touch only what the task needs and report exactly what changed.
- Turn tasks into verifiable goals (a test passes, an error is gone) and verify before reporting done.
- When versions or API specs affect a decision, check current official docs first. HyperFrames and the ElevenLabs API change often.
- Code comments and identifiers in English. Docs and user-facing text in Korean.
- Korean prose: lead with the point, paragraphs over bullets, no filler or meta phrases, no unsupported intensifiers, no closing summary. Never invent facts; mark what is unverified.

## Docs and handoff

- Record significant decisions and verification results as a dated entry in `planning/worklog.md`.
- Revise plan docs in place and note the revision at the top; do not fork new versions.
- Hand work to another agent with the form in `planning/handoff.md`, including actual HEAD and `git status` (a commit hash does not carry untracked files).
