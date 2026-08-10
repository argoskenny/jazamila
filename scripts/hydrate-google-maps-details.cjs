#!/usr/bin/env node

const { spawnSync } = require("node:child_process");

const selectionKey = process.argv[2] || "codex.google.selected.shulin";
const detailsKey = process.argv[3] || "codex.google.details.shulin";
const start = Number(process.argv[4] || 0);
const end = Number(process.argv[5] || 70);
const cliPath = "/Users/strongbuy/.codex/skills/playwright/scripts/playwright_cli.sh";
const session = process.env.PLAYWRIGHT_SESSION || "restaurant-maps";

const code = `async () => {
  const selection = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{"cards":[]}'), ${JSON.stringify(selectionKey)});
  const cards = (selection.cards || []).slice(${start}, ${end});
  const existing = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '[]'), ${JSON.stringify(detailsKey)});
  const detailPage = await page.context().newPage();
  const results = [];
  for (let index = 0; index < cards.length; index += 1) {
    const card = cards[index];
    try {
      await detailPage.goto(card.href, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await detailPage.waitForTimeout(900);
      const body = await detailPage.locator('body').innerText({ timeout: 10000 });
      results.push({ ...card, body, error: null });
    } catch (error) {
      results.push({ ...card, body: '', error: String(error?.message || error) });
    }
    if ((index + 1) % 10 === 0 || index + 1 === cards.length) {
      console.log(JSON.stringify({ hydrated: index + 1, total: cards.length, start: ${start}, end: ${end} }));
    }
    await detailPage.waitForTimeout(250);
  }
  await detailPage.close();
  const merged = existing.filter((item) => !results.some((item2) => item2.href === item.href)).concat(results);
  await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [${JSON.stringify(detailsKey)}, merged]);
  return { hydrated: results.length, total: cards.length, stored: merged.length, failures: results.filter((item) => item.error).length };
}`;

const result = spawnSync(cliPath, [`-s=${session}`, "run-code", code], { stdio: "inherit" });
if (result.status !== 0) process.exit(result.status || 1);
