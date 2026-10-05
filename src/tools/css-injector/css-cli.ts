#!/usr/bin/env node

import { Cdp } from "./cdp.ts";
import { loadConfig } from "./config.ts";
import { readSources } from "./sources.ts";
import { defaultState, readState, writeState } from "./state.ts";

function printUsage() {
  console.log(`Usage: npm run css -- <command> [args]

Commands:
  list                     Show local files and remote stylesheets, on/off
  off <name>                Disable a local file (by id) or remote pattern
  on <name>                 Re-enable a local file (by id) or remote pattern
  solo <id>                 Disable every local file except <id>
  remote-off-all            Disable every remote stylesheet
  remote-on-all             Re-enable every remote stylesheet
  reset                     Reset to the config defaults
  help                      Show this help`);
}

async function cmdList(config: Awaited<ReturnType<typeof loadConfig>>) {
  const cdp = await Cdp.connectToSite(config.url);
  try {
    const result = await cdp.evaluate(() => (window as any).__cssInjector?.list() ?? null);
    if (!result) {
      console.error("[css] Injector runtime not found in the page. Is `npm run dev` running?");
      process.exit(1);
    }
    console.log("LOCAL");
    for (const s of result.local) {
      console.log(`  ${s.enabled ? "on  " : "off "} ${s.id}  (${s.bytes} B)`);
    }
    console.log("REMOTE");
    for (const r of result.remote) {
      console.log(`  ${r.enabled ? "on  " : "off "} ${r.href}`);
    }
  } finally {
    cdp.close();
  }
}

async function localIds(config: Awaited<ReturnType<typeof loadConfig>>): Promise<string[]> {
  const sources = await readSources(config.dir, config.include, config.exclude);
  return sources.map((s) => s.id);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "help") {
    printUsage();
    return;
  }

  const config = await loadConfig();

  switch (command) {
    case "list": {
      await cmdList(config);
      break;
    }
    case "off": {
      const name = args[1];
      if (!name) {
        console.error("Usage: npm run css -- off <name>");
        process.exit(1);
      }
      const state = await readState(config);
      const ids = await localIds(config);
      if (ids.includes(name)) {
        if (!state.disabledLocal.includes(name)) state.disabledLocal.push(name);
        console.log(`[css] Disabled local file: ${name}`);
      } else {
        if (!state.disabledRemote.includes(name)) state.disabledRemote.push(name);
        console.log(`[css] Disabled remote pattern: ${name}`);
      }
      await writeState(state);
      break;
    }
    case "on": {
      const name = args[1];
      if (!name) {
        console.error("Usage: npm run css -- on <name>");
        process.exit(1);
      }
      const state = await readState(config);
      const beforeLocal = state.disabledLocal.length;
      const beforeRemote = state.disabledRemote.length;
      state.disabledLocal = state.disabledLocal.filter((id) => id !== name);
      state.disabledRemote = state.disabledRemote.filter((p) => p !== name);
      if (state.disabledLocal.length === beforeLocal && state.disabledRemote.length === beforeRemote) {
        console.log(
          `[css] "${name}" is not disabled. Disabled local: ${state.disabledLocal.join(", ") || "none"}; disabled remote: ${state.disabledRemote.join(", ") || "none"}`,
        );
      } else {
        console.log(`[css] Enabled: ${name}`);
      }
      await writeState(state);
      break;
    }
    case "solo": {
      const id = args[1];
      if (!id) {
        console.error("Usage: npm run css -- solo <id>");
        process.exit(1);
      }
      const ids = await localIds(config);
      if (!ids.includes(id)) {
        console.error(`[css] "${id}" is not a local file. Local files: ${ids.join(", ") || "none"}`);
        process.exit(1);
      }
      const state = await readState(config);
      state.disabledLocal = ids.filter((otherId) => otherId !== id);
      await writeState(state);
      console.log(`[css] Solo: only ${id} is enabled (${state.disabledLocal.length} other file(s) off)`);
      break;
    }
    case "remote-off-all": {
      const state = await readState(config);
      if (!state.disabledRemote.includes("*")) state.disabledRemote.push("*");
      await writeState(state);
      console.log("[css] All remote stylesheets disabled");
      break;
    }
    case "remote-on-all": {
      const state = await readState(config);
      state.disabledRemote = [];
      await writeState(state);
      console.log("[css] All remote stylesheets enabled");
      break;
    }
    case "reset": {
      await writeState(defaultState(config));
      console.log("[css] Reset to config defaults");
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

main();
