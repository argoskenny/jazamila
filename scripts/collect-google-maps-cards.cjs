#!/usr/bin/env node

const { spawnSync } = require("node:child_process");

const city = process.argv[2];
const district = process.argv[3];
const slug = process.argv[4] || `${city}-${district}`;
const terms = process.argv.slice(5).length > 0
  ? process.argv.slice(5)
  : ["餐廳", "小吃", "早餐", "早午餐", "火鍋", "麵店", "便當", "咖啡"];
const storageKey = `codex.google.cards.${slug}`;
const cliPath = "/Users/strongbuy/.codex/skills/playwright/scripts/playwright_cli.sh";
const session = process.env.PLAYWRIGHT_SESSION || "restaurant-maps";

if (!city || !district) throw new Error("Usage: collect-google-maps-cards.cjs <city> <district> [slug] [terms...]");

const code = `async () => {
  const city = ${JSON.stringify(city)};
  const district = ${JSON.stringify(district)};
  const terms = ${JSON.stringify(terms)};
  const storageKey = ${JSON.stringify(storageKey)};
  const existing = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '[]'), storageKey);
  const byHref = new Map(existing.filter((item) => item && item.href).map((item) => [item.href, item]));
  const progress = [];
  for (const term of terms) {
    const query = city + district + ' ' + term;
    const url = 'https://www.google.com/maps/search/' + encodeURIComponent(query);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1800);
      const feed = page.locator('div[role="feed"]');
      for (let index = 0; index < 8; index += 1) {
        if (await feed.count()) await feed.evaluate((element) => element.scrollTo(0, element.scrollHeight));
        await page.waitForTimeout(650);
      }
      const cards = await page.locator('div[role="article"], main article').evaluateAll((articles) => articles.map((article) => {
        const link = article.querySelector('a[href*="/maps/place/"]');
        const text = article.innerText || '';
        const ratingLabel = article.querySelector('img[aria-label*="顆星"], img[aria-label*="stars"]')?.getAttribute('aria-label') || '';
        const ratingMatch = (ratingLabel || text).match(/([0-5](?:\\.[0-9])?)/i);
        return link ? { href: link.href, text, rating: ratingMatch ? Number(ratingMatch[1]) : null } : null;
      }).filter(Boolean));
      for (const card of cards) {
        if (card.rating === null || /永久關閉|已歇業|停業中/.test(card.text)) continue;
        byHref.set(card.href, { ...card, city, district, query });
      }
      progress.push({ term, cards: cards.length, stored: byHref.size });
    } catch (error) {
      progress.push({ term, error: String(error?.message || error) });
    }
  }
  const result = [...byHref.values()];
  await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [storageKey, result]);
  return { storageKey, stored: result.length, progress };
}`;

const result = spawnSync(cliPath, [`-s=${session}`, "run-code", code], { stdio: "inherit" });
if (result.status !== 0) process.exit(result.status || 1);
