# Contract: npm Script Interface

The user-facing interface of icc-toolbox is its npm scripts. Names and behavior are frozen by
this feature; only the target path changes.

| Script | Before | After |
|---|---|---|
| `dev` | `node src/index.ts` | `node src/tools/css-injector/index.ts` |
| `css` | `node src/css-cli.ts` | `node src/tools/css-injector/css-cli.ts` |
| `dbg` | `node src/dbg.ts` | `node src/tools/css-injector/dbg.ts` |
| `clamp` | `node src/clamp.ts` | `node src/tools/units/clamp.ts` |
| `vw` | `node src/vw.ts` | `node src/tools/units/vw.ts` |
| `vh` | `node src/vh.ts` | `node src/tools/units/vh.ts` |
| `build` | `vite build` (entry `src/index.ts`) | `vite build` (entry `src/tools/css-injector/index.ts`) |
| `start` | `node dist/index.js` | unchanged |
| `typecheck` | `tsc --noEmit` (`src/**/*`) | unchanged |

**Invariants**
- Same arguments, same stdout/stderr, same exit codes.
- Same files read/written, relative to the project root.
- `bin.icc-toolbox` stays `./dist/index.js`.

**Future scripts** (not in this feature) use a namespaced prefix, e.g. `img:png`, `img:compress`.
