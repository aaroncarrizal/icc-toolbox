#!/usr/bin/env node

import { Command } from "commander";
import { resolve } from "node:path";
import fg from "fast-glob";
import { Cdp, pickSitePage, wsUrlFor } from "./cdp.ts";
import { launchChrome, getOrCreatePage } from "./chrome.ts";
import { loadConfig, type Config } from "./config.ts";
import { readSources } from "./sources.ts";
import { ensureStateFile, readState, STATE_FILE, type State } from "./state.ts";
import { applyViewport, describeSync, enableBasicAuth, syncCss, syncJs } from "./injector.ts";
import { watch } from "./watcher.ts";
import { captureConsoleAndNetwork } from "./console-log.ts";
import { findInvalidDeclarations } from "./css-lint.ts";

const program = new Command();

program
  .name("icc-toolbox")
  .description("Inject CSS into any website with hot reload")
  .version("1.0.0")
  .option("-u, --url <url>", "Target URL to open")
  .option("-d, --dir <path>", "CSS directory")
  .option("-i, --include <glob>", "Include glob pattern")
  .option("-e, --exclude <glob>", "Exclude glob pattern")
  .option("--headless", "Run in headless mode")
  .option("-s, --strip-patterns <patterns>", "Comma-separated patterns to strip remote stylesheets by href")
  .option("--username <username>", "HTTP Basic Auth username")
  .option("--password <password>", "HTTP Basic Auth password")
  .action(async (cliOptions) => {
    const cliArgs: Partial<Config> = {};
    if (cliOptions.url) cliArgs.url = cliOptions.url;
    if (cliOptions.dir) cliArgs.dir = cliOptions.dir;
    if (cliOptions.include) cliArgs.include = cliOptions.include;
    if (cliOptions.exclude) cliArgs.exclude = cliOptions.exclude;
    if (cliOptions.headless !== undefined) cliArgs.headless = cliOptions.headless;
    if (cliOptions.stripPatterns) cliArgs.stripPatterns = cliOptions.stripPatterns.split(",");
    if (cliOptions.username) cliArgs.username = cliOptions.username;
    if (cliOptions.password) cliArgs.password = cliOptions.password;

    const config = await loadConfig(cliArgs);

    if (!config.url) {
      console.error("[css-injector] Error: --url is required (or set in config)");
      process.exit(1);
    }

    console.log(`[css-injector] Opening ${config.url}`);
    console.log(`[css-injector] CSS directory: ${resolve(config.dir)}`);

    const chrome = await launchChrome(config.chromePath, config.headless);

    const target = await getOrCreatePage(config.url);
    const cdp = await Cdp.connect(wsUrlFor(target));

    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");
    captureConsoleAndNetwork(cdp);

    if (config.username) {
      await enableBasicAuth(cdp, config.url, config.username, config.password);
    }

    await ensureStateFile(config);
    let state: State = await readState(config);

    const syncAllCss = async () => {
      try {
        const sources = await readSources(config.dir, config.include, config.exclude);
        state = await readState(config);
        await syncCss(cdp, sources, state);
        console.log(`[css-injector] ${describeSync(sources, state)}`);
        try {
          const invalid = await findInvalidDeclarations(cdp, sources);
          for (const d of invalid) {
            console.log(`[css-injector] WARNING ${d.id}:${d.line} invalid declaration "${d.prop}: ${d.value}"`);
          }
        } catch {
          // this is a hint, not a hard error — never let it break a sync
        }
      } catch (err) {
        console.error("[css-injector] Error syncing CSS:", err);
      }
    };

    await syncAllCss();
    await applyViewport(cdp, state.viewport);

    if (config.scripts) {
      const js = await readSources(config.jsDir, config.jsInclude, "");
      await syncJs(cdp, js);
      console.log(`[css-injector] JS injection enabled (last resort): ${js.length} file(s)`);
    } else {
      const jsFiles = await fg(config.jsInclude, { cwd: resolve(config.jsDir) }).catch(() => []);
      if (jsFiles.length > 0) {
        console.log(
          `[css-injector] scripts/ has ${jsFiles.length} file(s) but "scripts" is false in .cssinjector.json, so they are NOT injected`,
        );
      }
    }

    // Navigate only if this tab isn't already on the site (a reused Chrome may already be there).
    const alreadyOnSite = pickSitePage([target], config.url) !== undefined;
    if (!alreadyOnSite) {
      await cdp.send("Page.navigate", { url: config.url });
    }

    console.log(`[css-injector] CDP available at http://127.0.0.1:9222`);

    const stopWatchers: (() => void)[] = [];
    stopWatchers.push(watch(resolve(config.dir), syncAllCss));
    stopWatchers.push(
      watch(STATE_FILE, async () => {
        await syncAllCss();
        await applyViewport(cdp, state.viewport);
      }),
    );
    if (config.scripts) {
      stopWatchers.push(
        watch(resolve(config.jsDir), async () => {
          try {
            const js = await readSources(config.jsDir, config.jsInclude, "");
            await syncJs(cdp, js);
            console.log(`[css-injector] JS updated (${js.length} file(s))`);
          } catch (err) {
            console.error("[css-injector] Error updating JS:", err);
          }
        }),
      );
    }

    console.log(
      "[css-injector] Ready. CDP on http://127.0.0.1:9222. Toggle sources with npm run css; debug with npm run dbg.",
    );

    let cleaningUp = false;
    const cleanup = async () => {
      if (cleaningUp) return;
      cleaningUp = true;
      console.log("\n[css-injector] Shutting down...");
      stopWatchers.forEach((stop) => stop());
      cdp.close();
      chrome?.kill();
      process.exit(0);
    };

    cdp.on("close", () => {
      console.log("[css-injector] Tab closed / Chrome exited. Stopping.");
      void cleanup();
    });

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
  });

program.parse();
