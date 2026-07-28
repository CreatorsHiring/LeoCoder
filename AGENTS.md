# LeoCoder — Agent Instructions

## Commands

| Command | Action |
|---------|--------|
| `npm run build` | Compile `src/` → `dist/` (via `tsc`) |
| `npm run dev` | Run from source via `ts-node src/index.ts` |
| `npm start` | Run compiled: `node dist/index.js chat` |
| `npm run lint` | ESLint on `src/**/*.ts` (no ESLint config file found — may need one) |

No test framework exists. No CI pipeline configured.

## Architecture

- **Entry:** `src/index.ts` (Commander CLI) → compiled to `dist/index.js` (bin: `leocoder`)
- **Providers:** `src/providers/` — Ollama, LM Studio (local), Groq, Gemini (cloud)
- **Router:** `src/utils/router.ts` — classifies tasks by complexity, routes local vs. cloud, tracks token budgets
- **Context:** `src/context/` — auto-generates `.leocoder/` (gitignored) on first run: project map, rules, session state
- **Tools:** `src/tools/filesystem.ts` (read/write/edit/search), `src/tools/shell.ts` (safe shell execution)
- **Config:** `config.yaml` at root — local model prefs, cloud provider keys, routing thresholds, vibe coding settings
- **Env:** `.env` (gitignored) holds `GROQ_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`

## Gotchas

- **`dist/` is in `.gitignore`** — rebuild after every change before testing via `npm start`
- **No ESLint config file** exists (devDependencies are installed but no `.eslintrc*` or `eslintConfig` in package.json); `npm run lint` will fail until one is added
- **Auto-generated `.leocoder/`** is gitignored — delete it to force context regeneration
- **Single package, npm only** — no monorepo, no pnpm/yarn, `package-lock.json` only
- **Node >=16** required; cross-platform (win32, darwin, linux)
- **`config.yaml` is published to npm** (in `"files"` of package.json) — sensitive production values should stay in `.env`
- **Agent-friendly:** The `.leocoder/leocodercontext.md` and `.leocoder/rules.md` files are the project's own agent instructions, generated at runtime