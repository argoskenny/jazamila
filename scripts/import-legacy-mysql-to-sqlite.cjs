#!/usr/bin/env node

/**
 * Import legacy Laravel/MySQL data into the Next.js Prisma SQLite database.
 *
 * Required env:
 * - LEGACY_DATABASE_URL=mysql://user:pass@host:3306/legacy_db
 * - DATABASE_URL=file:./production.db
 *
 * Usage:
 *   npm run db:import:legacy:dry
 *   npm run db:import:legacy
 */

const mysql = require("mysql2/promise");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");
const batchSize = Number(process.env.MIGRATION_BATCH_SIZE || 500);

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function toInt(value, fallback = 0) {
  const number = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(number) ? number : fallback;
}

function toStringOrNull(value) {
  if (value === null || value === undefined) return null;
  const string = String(value);
  return string === "" ? null : string;
}

async function fetchAll(connection, tableName) {
  const [rows] = await connection.query(`SELECT * FROM \`${tableName}\` ORDER BY id ASC`);
  return rows;
}

function chunks(rows) {
  const result = [];
  for (let index = 0; index < rows.length; index += batchSize) {
    result.push(rows.slice(index, index + batchSize));
  }
  return result;
}

async function replaceTable(model, rows, label) {
  console.log(`${dryRun ? "[dry-run] " : ""}${label}: ${rows.length} rows`);
  if (dryRun) return;

  for (const group of chunks(rows)) {
    await model.createMany({ data: group, skipDuplicates: true });
  }
}

async function migrateRestaurants(connection) {
  const rows = await fetchAll(connection, "r_restaurant");
  const data = rows.map((row) => ({
    id: toInt(row.id),
    name: String(row.res_name || ""),
    areaNum: toStringOrNull(row.res_area_num),
    telNum: toStringOrNull(row.res_tel_num),
    region: toInt(row.res_region),
    section: toInt(row.res_section),
    address: toStringOrNull(row.res_address),
    foodType: toInt(row.res_foodtype),
    price: toInt(row.res_price),
    openTime: toInt(row.res_open_time),
    closeTime: toInt(row.res_close_time),
    note: toStringOrNull(row.res_note),
    imageUrl: toStringOrNull(row.res_img_url),
    originalImage: toStringOrNull(row.res_img_ori_url),
    updatedAtUnix: row.res_updatetime === null ? null : toInt(row.res_updatetime),
    postId: toInt(row.res_post_id),
    closed: toInt(row.res_close)
  }));

  await replaceTable(prisma.restaurant, data, "r_restaurant");
}

async function migratePosts(connection) {
  const rows = await fetchAll(connection, "r_post");
  const data = rows.map((row) => ({
    id: toInt(row.id),
    name: String(row.post_name || ""),
    areaNum: toStringOrNull(row.post_area_num),
    telNum: toStringOrNull(row.post_tel_num),
    region: toInt(row.post_region),
    section: toInt(row.post_section),
    address: toStringOrNull(row.post_address),
    foodType: toInt(row.post_foodtype),
    price: toInt(row.post_price),
    openTime: toInt(row.post_open_time),
    closeTime: toInt(row.post_close_time),
    note: toStringOrNull(row.post_note),
    updatedAtUnix: toInt(row.post_updatetime),
    imageUrl: toStringOrNull(row.post_img_url),
    originalImage: toStringOrNull(row.post_img_ori_url),
    status: toInt(row.post_prove)
  }));

  await replaceTable(prisma.post, data, "r_post");
}

async function migrateBlogLinks(connection) {
  const rows = await fetchAll(connection, "r_bloglink");
  const data = rows.map((row) => ({
    id: toInt(row.id),
    restaurantId: toInt(row.b_res_id),
    postId: toInt(row.b_post_id),
    name: toStringOrNull(row.b_blogname),
    url: toStringOrNull(row.b_bloglink),
    status: toInt(row.b_blog_show)
  }));

  await replaceTable(prisma.blogLink, data, "r_bloglink");
}

async function migrateFeedback(connection) {
  const rows = await fetchAll(connection, "r_feedback");
  const data = rows.map((row) => ({
    id: toInt(row.id),
    name: toStringOrNull(row.f_name),
    email: toStringOrNull(row.f_email),
    content: toStringOrNull(row.f_content),
    timeUnix: toInt(row.f_time),
    isRead: toInt(row.f_isread)
  }));

  await replaceTable(prisma.feedback, data, "r_feedback");
}

async function clearTarget() {
  await prisma.blogLink.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.post.deleteMany();
  await prisma.restaurant.deleteMany();
}

async function validateCounts(connection) {
  const tables = [
    ["r_restaurant", prisma.restaurant],
    ["r_post", prisma.post],
    ["r_bloglink", prisma.blogLink],
    ["r_feedback", prisma.feedback]
  ];

  for (const [table, model] of tables) {
    const [[legacy]] = await connection.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
    const target = dryRun ? "dry-run" : await model.count();
    console.log(`${table}: legacy=${legacy.count} sqlite=${target}`);
  }
}

async function main() {
  requiredEnv("DATABASE_URL");
  const legacyUrl = requiredEnv("LEGACY_DATABASE_URL");
  const legacy = await mysql.createConnection(legacyUrl);

  try {
    if (!dryRun) await clearTarget();

    await migrateRestaurants(legacy);
    await migratePosts(legacy);
    await migrateBlogLinks(legacy);
    await migrateFeedback(legacy);
    await validateCounts(legacy);
  } finally {
    await legacy.end();
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
