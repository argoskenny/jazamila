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

function chunks(rows, batchSize) {
  const result = [];
  for (let index = 0; index < rows.length; index += batchSize) {
    result.push(rows.slice(index, index + batchSize));
  }
  return result;
}

async function replaceTable(model, rows, label, { dryRun, batchSize, logger }) {
  logger.log(`${dryRun ? "[dry-run] " : ""}${label}: ${rows.length} rows`);
  if (dryRun) return;

  for (const group of chunks(rows, batchSize)) {
    await model.createMany({ data: group, skipDuplicates: true });
  }
}

async function migrateRestaurants(connection, prisma, options) {
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

  await replaceTable(prisma.restaurant, data, "r_restaurant", options);
}

async function migratePosts(connection, prisma, options) {
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

  await replaceTable(prisma.post, data, "r_post", options);
}

async function migrateBlogLinks(connection, prisma, options) {
  const rows = await fetchAll(connection, "r_bloglink");
  const data = rows.map((row) => ({
    id: toInt(row.id),
    restaurantId: toInt(row.b_res_id),
    postId: toInt(row.b_post_id),
    name: toStringOrNull(row.b_blogname),
    url: toStringOrNull(row.b_bloglink),
    status: toInt(row.b_blog_show)
  }));

  await replaceTable(prisma.blogLink, data, "r_bloglink", options);
}

async function migrateFeedback(connection, prisma, options) {
  const rows = await fetchAll(connection, "r_feedback");
  const data = rows.map((row) => ({
    id: toInt(row.id),
    name: toStringOrNull(row.f_name),
    email: toStringOrNull(row.f_email),
    content: toStringOrNull(row.f_content),
    timeUnix: toInt(row.f_time),
    isRead: toInt(row.f_isread)
  }));

  await replaceTable(prisma.feedback, data, "r_feedback", options);
}

async function clearTarget(prisma) {
  await prisma.blogLink.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.post.deleteMany();
  await prisma.restaurant.deleteMany();
}

async function validateCounts(connection, prisma, { dryRun, logger }) {
  const tables = [
    ["r_restaurant", prisma.restaurant],
    ["r_post", prisma.post],
    ["r_bloglink", prisma.blogLink],
    ["r_feedback", prisma.feedback]
  ];

  for (const [table, model] of tables) {
    const [[legacy]] = await connection.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
    const target = dryRun ? "dry-run" : await model.count();
    logger.log(`${table}: legacy=${legacy.count} sqlite=${target}`);
  }
}

async function runImport({ prisma, legacy, dryRun, batchSize, logger = console }) {
  const options = { dryRun, batchSize, logger };

  async function migrate(client) {
    if (!dryRun) await clearTarget(client);

    await migrateRestaurants(legacy, client, options);
    await migratePosts(legacy, client, options);
    await migrateBlogLinks(legacy, client, options);
    await migrateFeedback(legacy, client, options);
    await validateCounts(legacy, client, options);
  }

  if (dryRun) {
    await migrate(prisma);
    return;
  }

  await prisma.$transaction(async (tx) => {
    await migrate(tx);
  });
}

module.exports = {
  runImport
};
