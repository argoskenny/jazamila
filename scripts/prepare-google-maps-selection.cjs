#!/usr/bin/env node

const fs = require("node:fs");

const basePath = process.argv[2];
const cityName = process.argv[3] || "新北市";
const districtName = process.argv[4] || "樹林區";
const targetCount = Number(process.argv[5] || 100);

if (!basePath) throw new Error("Usage: prepare-google-maps-selection.cjs <base-json> [city] [district] [count]");

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s\u3000，,。．.、:：()（）【】「」『』'"“”‘’《》<>\-—_]/g, "");
}

function meaningfulLines(text) {
  return String(text || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseCard(card) {
  const lines = meaningfulLines(card.text);
  const name = lines.find((line) => !/^\d(?:\.\d)?$/.test(line) && !line.includes("·") && !/^(營業中|暫時關閉|永久關閉|已歇業|永久歇業)/.test(line)) || "";
  const ratingLine = lines.find((line) => /^[0-5](?:\.\d)?$/.test(line));
  const rating = ratingLine ? Number(ratingLine) : null;
  const locationLine = lines.find((line) => line.includes("·"));
  const parts = locationLine ? locationLine.split("·").map((part) => part.trim()).filter(Boolean) : [];
  const cuisine = parts[0] || "其他餐飲";
  const shortAddress = parts.at(-1) || "";
  const closed = /(暫時關閉|永久關閉|已歇業|永久歇業|停業中)/.test(card.text);
  return {
    name,
    short_address: shortAddress,
    cuisine,
    rating,
    href: card.href,
    closed,
    card_text: card.text,
  };
}

const base = JSON.parse(fs.readFileSync(basePath, "utf8"));
const baseKeys = new Set((base.restaurants || []).map((item) => `${normalize(item.name)}||${normalize(item.address)}`));
const raw = fs.readFileSync(0, "utf8").trim();
const cards = JSON.parse(raw || "[]");
const selected = [];
const seenHrefs = new Set();
const seenNames = new Set();

for (const card of cards) {
  const parsed = parseCard(card);
  if (!parsed.href || seenHrefs.has(parsed.href) || parsed.closed || !parsed.name || parsed.rating === null) continue;
  if (!parsed.href.includes("google.com/maps/")) continue;
  const nameKey = normalize(parsed.name);
  if (seenNames.has(nameKey)) continue;
  if (baseKeys.has(`${nameKey}||${normalize(parsed.short_address)}`)) continue;
  seenHrefs.add(parsed.href);
  seenNames.add(nameKey);
  selected.push({
    ...parsed,
    city: cityName,
    district: districtName,
  });
  if (selected.length >= targetCount) break;
}

process.stdout.write(`${JSON.stringify({ city: cityName, district: districtName, hrefs: selected.map((item) => item.href), cards: selected })}\n`);
