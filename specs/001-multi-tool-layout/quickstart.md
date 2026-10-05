# Quickstart: Validate the Multi-Tool Layout

## Prerequisites

- Node 24+, `npm install` done, Chrome installed
- `.cssinjector.json` configured for a reachable site (for the injector checks)

## 1. Baseline (before moving)

Capture outputs that must stay identical:

```bash
npm run clamp -- 24 > baseline-clamp.txt
npm run vw -- 24    > baseline-vw.txt
npm run vh -- 24    > baseline-vh.txt
```

(Keep these in the scratchpad, not in the repo.)

## 2. Static checks (after moving)

```bash
npm run typecheck          # exits 0
npm run build              # produces dist/index.js
```

Cross-tool import check — must print nothing:

```bash
grep -rnE "from \"\.\./" src/tools/
```

No stale paths in docs/skills — must print nothing:

```bash
grep -rnE "src/(index|css-cli|dbg|cdp|chrome|config|console-log|css-lint|injector|page-runtime|sources|state|watcher|clamp|vw|vh)\.ts" AGENTS.md README.md .claude/skills/set-up .claude/skills/custom-forms
```

## 3. Command smoke tests

| Command | Expected |
|---|---|
| `npm run clamp -- 24` / `vw` / `vh` | identical to baseline |
| `npm run dev` | Chrome opens the site, CSS injected; editing `styles/home.css` hot-reloads |
| `npm run css -- list` (injector running) | lists local + remote sources |
| `npm run dbg -- styles body` (injector running) | JSON computed styles |
| `npm start` | same as `npm run dev`, from `dist/` |

## 4. History

```bash
git log --follow --oneline src/tools/css-injector/cdp.ts   # shows pre-move commits
```
