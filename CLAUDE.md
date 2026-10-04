@AGENTS.md

## Claude Code

- Delegate by task: Explore subagents for broad search, Plan for implementation design, parallel subagents for independent work. Keep the main context for decisions and integration.
- When requirements are ambiguous, interview the user with AskUserQuestion instead of guessing.
- Hard problems (contract design, timing, determinism, architecture): consult a higher-tier model as advisor before committing to an approach.
- Simple or repetitive work (link fixes, renames, boilerplate, git chores): hand to a lower-tier subagent (`model: haiku` or `sonnet`).
- Independent, verifiable code tasks can go to Codex; review its diff, not its description.
- After S0 installs the HyperFrames skill, use it for composition work instead of writing GSAP from memory.
- Do not read `planning/archive/**` unless the task asks for history.
