#!/usr/bin/env node

const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

const selectionPath = process.argv[2];
const storageKey = process.argv[3] || "codex.google.selected.shulin";
const cliPath = "/Users/strongbuy/.codex/skills/playwright/scripts/playwright_cli.sh";
const session = process.env.PLAYWRIGHT_SESSION || "restaurant-maps";

if (!selectionPath) throw new Error("Usage: set-google-maps-selection.cjs <selection-json> [storage-key]");
const payload = Buffer.from(fs.readFileSync(selectionPath)).toString("base64");
const code = `(() => { localStorage.setItem('${storageKey}', atob('${payload}')); return JSON.parse(localStorage.getItem('${storageKey}')).hrefs.length; })()`;
const result = spawnSync(cliPath, [`-s=${session}`, "--raw", "eval", code], { stdio: "inherit" });
if (result.status !== 0) process.exit(result.status || 1);
