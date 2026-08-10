#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const docsDir = path.resolve(__dirname, "../docs/res_data");
const expected = {
  newtaipei: ["新北市", 29],
  taoyuan: ["桃園市", 13],
  taichung: ["臺中市", 29],
  tainan: ["臺南市", 37],
  kaohsiung: ["高雄市", 38],
  keelung: ["基隆市", 7],
  "hsinchu-city": ["新竹市", 3],
  "chiayi-city": ["嘉義市", 2],
};

function filesFor(prefix) {
  return fs.readdirSync(docsDir)
    .filter((file) => file.startsWith(`${prefix}-`) && file.endsWith("-restaurants.json"))
    .sort()
    .map((file) => path.join(docsDir, file));
}

const errors = [];
const groupStats = {};
for (const [prefix, [city, expectedCount]] of Object.entries(expected)) {
  const files = filesFor(prefix);
  groupStats[prefix] = { files: files.length, complete: 0, partial: 0, restaurants: 0 };
  if (files.length !== expectedCount) errors.push(`${prefix}: expected ${expectedCount} files, found ${files.length}`);
  for (const file of files) {
    const short = path.basename(file);
    let document;
    try {
      document = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error) {
      errors.push(`${short}: invalid JSON (${error.message})`);
      continue;
    }
    const collection = document.collection || {};
    const restaurants = Array.isArray(document.restaurants) ? document.restaurants : [];
    if (collection.city !== city) errors.push(`${short}: collection.city=${collection.city}, expected ${city}`);
    if (collection.target_count !== 200) errors.push(`${short}: collection.target_count is not 200`);
    if (collection.record_count !== restaurants.length) errors.push(`${short}: record_count mismatch`);
    if (!['complete', 'partial'].includes(collection.status)) errors.push(`${short}: invalid status ${collection.status}`);
    const operationFiltered = Boolean(collection.operation_status_checked_at && Object.prototype.hasOwnProperty.call(collection, "record_count_after_operation_check"));
    if (collection.status === "complete" && restaurants.length !== 200 && !operationFiltered) errors.push(`${short}: complete but has ${restaurants.length}`);
    if (collection.status === "partial" && restaurants.length >= 200) errors.push(`${short}: partial but has ${restaurants.length}`);
    const ids = new Set();
    const keys = new Set();
    for (const [index, restaurant] of restaurants.entries()) {
      for (const field of ["id", "name", "address"]) {
        if (!restaurant[field]) errors.push(`${short}#${index + 1}: missing ${field}`);
      }
      if (!Object.prototype.hasOwnProperty.call(restaurant, "phone")) errors.push(`${short}#${index + 1}: missing phone field`);
      if (restaurant.phone !== null && !restaurant.phone) errors.push(`${short}#${index + 1}: invalid phone`);
      if (restaurant.physical_store !== true) errors.push(`${short}#${index + 1}: physical_store is not true`);
      if (!Array.isArray(restaurant.cuisine_types) || restaurant.cuisine_types.length === 0) errors.push(`${short}#${index + 1}: missing cuisine_types`);
      const imageStatuses = ["no_explicit_prohibition_found", "explicitly_prohibited", "no_candidate_found"];
      if (!Object.prototype.hasOwnProperty.call(restaurant, "image_url")) errors.push(`${short}#${index + 1}: missing image_url`);
      if (restaurant.image_url !== null && typeof restaurant.image_url !== "string") errors.push(`${short}#${index + 1}: invalid image_url`);
      if (!imageStatuses.includes(restaurant.image_usage_status)) errors.push(`${short}#${index + 1}: invalid image_usage_status`);
      if (restaurant.image_url && !restaurant.image_source_url) errors.push(`${short}#${index + 1}: image_url missing image_source_url`);
      if (restaurant.image_url && restaurant.image_usage_status !== "no_explicit_prohibition_found") errors.push(`${short}#${index + 1}: image_url has incompatible usage status`);
      if (!restaurant.online_rating || !Object.prototype.hasOwnProperty.call(restaurant.online_rating, "score") || !Array.isArray(restaurant.online_rating.review_summary) || restaurant.online_rating.review_summary.length === 0 || restaurant.online_rating.review_summary.some((item) => typeof item !== "string" || !item.trim())) {
        errors.push(`${short}#${index + 1}: incomplete online_rating`);
      }
      if (restaurant.online_rating?.score === null && restaurant.online_rating?.platform !== "未提供") {
        errors.push(`${short}#${index + 1}: null online_rating must be explicitly marked as unavailable`);
      }
      const normalizedAddress = String(restaurant.address).normalize("NFKC").replace(/台(?=中市|南市)/g, "臺");
      if (!normalizedAddress.includes(collection.city) || !normalizedAddress.includes(collection.district)) {
        errors.push(`${short}#${index + 1}: address outside collection scope`);
      }
      if (ids.has(restaurant.id)) errors.push(`${short}: duplicate id ${restaurant.id}`);
      ids.add(restaurant.id);
      const key = `${String(restaurant.name).replace(/\s/g, "")}||${String(restaurant.address).replace(/\s/g, "")}`;
      if (keys.has(key)) errors.push(`${short}: duplicate name/address ${restaurant.name}`);
      keys.add(key);
    }
    groupStats[prefix].restaurants += restaurants.length;
    if (collection.status === "complete") groupStats[prefix].complete += 1;
    if (collection.status === "partial") groupStats[prefix].partial += 1;
  }
}

console.log(JSON.stringify({ groups: groupStats, total_files: Object.values(groupStats).reduce((sum, item) => sum + item.files, 0), total_restaurants: Object.values(groupStats).reduce((sum, item) => sum + item.restaurants, 0), errors }, null, 2));
if (errors.length > 0) process.exitCode = 1;
