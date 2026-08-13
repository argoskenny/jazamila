#!/usr/bin/env node

const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");
const {
  TAXONOMY_VERSION,
  classifyRestaurant,
  parseSourceRefs,
  taxonomy,
} = require("../lib/domain/deterministic-cuisine-classifier.cjs");

const ROOT = path.resolve(__dirname, "..");

function cleanText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();
}

function uniqueText(values) {
  const result = [];
  const seen = new Set();
  for (const value of values) {
    const text = cleanText(value);
    const key = text.toLocaleLowerCase("en-US");
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

function sourceUrlsForRecord(record) {
  const rawValues = [
    record?.source_url,
    record?.sourceUrl,
    record?.url,
    ...(Array.isArray(record?.sources) ? record.sources : []),
    ...(Array.isArray(record?.source_urls) ? record.source_urls : []),
    ...(Array.isArray(record?.sourceUrls) ? record.sourceUrls : []),
  ];
  return uniqueText(rawValues).filter((value) => /^https?:\/\/[^\s]+$/u.test(value));
}

function usage() {
  return `Usage: node scripts/classify-cuisine-deterministic.cjs [options]

This command is always a read-only deterministic dry-run. It never writes SQLite.

Options:
  --dry-run              Explicitly confirm dry-run mode (the default)
  --data-dir <path>      Saved source JSON directory (default: docs/res_data)
  --report <path>        Write the complete per-restaurant JSON report
  --sample-size <n>      Number of deterministic sample rows in stdout (default: 12)
  --limit <n>            Read only the first n restaurants for a narrow audit
  --help                 Show this help
`;
}

function parseArgs(argv) {
  const options = {
    dryRun: true,
    dataDir: path.join(ROOT, "docs", "res_data"),
    reportPath: null,
    sampleSize: 12,
    limit: null,
    help: false,
  };
  const valueOptions = new Map([
    ["--data-dir", "dataDir"],
    ["--report", "reportPath"],
    ["--sample-size", "sampleSize"],
    ["--limit", "limit"],
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else {
      const [name, inlineValue] = argument.split("=", 2);
      const key = valueOptions.get(name);
      if (!key) throw new Error(`Unknown option: ${argument}`);
      const value = inlineValue ?? argv[++index];
      if (value === undefined) throw new Error(`Missing value for ${name}`);
      options[key] = value;
    }
  }

  options.dataDir = path.resolve(ROOT, String(options.dataDir));
  options.reportPath = options.reportPath ? path.resolve(ROOT, String(options.reportPath)) : null;
  options.sampleSize = Number(options.sampleSize);
  options.limit = options.limit === null ? null : Number(options.limit);
  if (!Number.isInteger(options.sampleSize) || options.sampleSize < 0 || options.sampleSize > 100) {
    throw new Error("--sample-size must be an integer between 0 and 100");
  }
  if (options.limit !== null && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new Error("--limit must be a positive integer");
  }
  return options;
}

function sourceKey(file, id) {
  return `${cleanText(file)}|${cleanText(id)}`;
}

function loadSavedSourceIndex(dataDir) {
  const index = new Map();
  const entries = new Map();
  const files = fs.readdirSync(dataDir)
    .filter((file) => file.endsWith(".json"))
    .sort();
  for (const file of files) {
    const filePath = path.join(dataDir, file);
    const document = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!document || !Array.isArray(document.restaurants)) continue;
    for (const record of document.restaurants) {
      const entry = {
        file,
        id: cleanText(record?.id),
        sourceId: cleanText(record?.source_id),
        name: cleanText(record?.name),
        address: cleanText(record?.address),
        phone: cleanText(record?.phone),
        cuisineTypes: Array.isArray(record?.cuisine_types)
          ? uniqueText(record.cuisine_types)
          : [],
        sourceUrls: sourceUrlsForRecord(record),
      };
      const entryKey = `${file}|${entry.id}|${entry.sourceId}`;
      entries.set(entryKey, entry);
      if (entry.id) index.set(sourceKey(file, entry.id), entry);
      if (entry.sourceId) index.set(sourceKey(file, `source:${entry.sourceId}`), entry);
    }
  }
  return { files, index, entries };
}

function sourceEvidenceFor(row, sourceIndex) {
  const refs = parseSourceRefs(row.sourceRefsJson);
  if (refs.length === 0 && (row.sourceFile || row.sourceId)) {
    refs.push({ file: cleanText(row.sourceFile), id: cleanText(row.sourceId), sourceId: cleanText(row.sourceId) });
  }
  const evidence = [];
  const seen = new Set();
  for (const ref of refs) {
    const entry = sourceIndex.get(sourceKey(ref.file, ref.id))
      ?? sourceIndex.get(sourceKey(ref.file, `source:${ref.sourceId}`));
    if (!entry) continue;
    const key = `${entry.file}|${entry.id}|${entry.sourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    evidence.push(entry);
  }
  evidence.sort((left, right) => `${left.file}|${left.id}`.localeCompare(`${right.file}|${right.id}`));
  const refsWithSourceUrls = refs.map((ref) => {
    const entry = sourceIndex.get(sourceKey(ref.file, ref.id))
      ?? sourceIndex.get(sourceKey(ref.file, `source:${ref.sourceId}`));
    return {
      ...ref,
      sourceUrls: entry?.sourceUrls ?? [],
    };
  });
  return { refs: refsWithSourceUrls, evidence };
}

async function readRestaurantRows(prisma) {
  const rawRows = await prisma.$queryRaw`
    SELECT
      r.id AS restaurant_id,
      r.res_name AS name,
      r.res_note AS note,
      r.res_area_num AS area_num,
      r.res_tel_num AS tel_num,
      r.res_address AS address,
      r.phone AS phone,
      r.res_foodtype AS food_type,
      r.source_file AS source_file,
      r.source_id AS source_id,
      r.source_refs_json AS source_refs_json,
      rt.position AS tag_position,
      t.name AS tag_name
    FROM r_restaurant r
    LEFT JOIN r_restaurant_tag rt ON rt.restaurant_id = r.id
    LEFT JOIN r_tag t ON t.id = rt.tag_id
    ORDER BY r.id ASC, rt.position ASC, t.id ASC
  `;
  const grouped = new Map();
  for (const rawRow of rawRows) {
    const restaurantId = Number(rawRow.restaurant_id);
    let row = grouped.get(restaurantId);
    if (!row) {
      row = {
        id: restaurantId,
        name: rawRow.name,
        note: rawRow.note,
        areaNum: rawRow.area_num,
        telNum: rawRow.tel_num,
        address: rawRow.address,
        phone: rawRow.phone,
        foodType: Number(rawRow.food_type ?? 0),
        sourceFile: rawRow.source_file,
        sourceId: rawRow.source_id,
        sourceRefsJson: rawRow.source_refs_json,
        tags: [],
      };
      grouped.set(restaurantId, row);
    }
    if (rawRow.tag_name !== null && rawRow.tag_name !== undefined) {
      row.tags.push({
        position: Number(rawRow.tag_position ?? 0),
        tag: { name: rawRow.tag_name },
      });
    }
  }
  return [...grouped.values()].sort((left, right) => left.id - right.id);
}

function inputForRow(row, sourceIndex) {
  const source = sourceEvidenceFor(row, sourceIndex);
  return {
    restaurantId: row.id,
    name: row.name,
    note: row.note,
    address: row.address,
    phone: row.phone ?? row.telNum,
    areaNum: row.areaNum,
    telNum: row.telNum,
    originalFoodType: row.foodType,
    originalTags: row.tags.map((relation) => relation.tag.name),
    sourceRefs: source.refs,
    sourceCuisineTypes: uniqueText(source.evidence.flatMap((entry) => entry.cuisineTypes)),
  };
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function buildSummary(results, sourceInfo, restaurantCount) {
  const byCuisineType = Object.fromEntries(taxonomy.cuisineTypes.map((cuisineType) => [cuisineType.code, 0]));
  const byDecisionReason = {};
  let classified = 0;
  let needsAi = 0;
  let needsWebResearch = 0;
  let removedCuisineTags = 0;
  let keptAuxiliaryTags = 0;
  let ambiguous = 0;
  let conflicts = 0;

  for (const result of results) {
    if (result.proposedCuisineType) {
      classified += 1;
      byCuisineType[result.proposedCuisineType.code] += 1;
    }
    if (result.needsAi) needsAi += 1;
    if (result.needsWebResearch) needsWebResearch += 1;
    removedCuisineTags += result.removedCuisineTags.length;
    keptAuxiliaryTags += result.keptAuxiliaryTags.length;
    if (result.ambiguousMatches.some((match) => !match.resolved)) ambiguous += 1;
    if (result.decisionReason === "conflicting-cuisine-evidence") conflicts += 1;
    byDecisionReason[result.decisionReason] = (byDecisionReason[result.decisionReason] ?? 0) + 1;
  }

  const total = results.length;
  return {
    restaurantsRead: restaurantCount,
    results: total,
    classified,
    unclassified: total - classified,
    classifiedRate: total === 0 ? 0 : round(classified / total),
    needsAi,
    needsWebResearch,
    ambiguous,
    conflicts,
    removedCuisineTags,
    keptAuxiliaryTags,
    byCuisineType,
    byDecisionReason: Object.fromEntries(Object.entries(byDecisionReason).sort(([left], [right]) => left.localeCompare(right))),
    savedSourceFiles: sourceInfo.files.length,
    savedSourceRecordsMatched: sourceInfo.matchedRecords,
    savedSourceRecordsWithUrls: [...sourceInfo.entries.values()].filter((entry) => entry.sourceUrls.length > 0).length,
    savedSourceRecordsMatchedWithUrls: sourceInfo.matchedRecordsWithUrls,
    savedSourceUrls: uniqueText([...sourceInfo.entries.values()].flatMap((entry) => entry.sourceUrls)).length,
  };
}

function selectSamples(results, sampleSize) {
  if (sampleSize === 0) return [];
  const selected = [];
  const selectedIds = new Set();
  const predicates = [
    (result) => result.proposedCuisineType !== null,
    (result) => result.removedCuisineTags.length > 0,
    (result) => result.ambiguousMatches.some((match) => !match.resolved),
    (result) => result.decisionReason === "conflicting-cuisine-evidence",
    (result) => result.proposedCuisineType === null,
  ];
  for (const predicate of predicates) {
    const result = results.find((candidate) => !selectedIds.has(candidate.restaurantId) && predicate(candidate));
    if (!result) continue;
    selected.push(result);
    selectedIds.add(result.restaurantId);
    if (selected.length >= sampleSize) return selected;
  }
  for (const result of results) {
    if (selectedIds.has(result.restaurantId)) continue;
    selected.push(result);
    selectedIds.add(result.restaurantId);
    if (selected.length >= sampleSize) break;
  }
  return selected;
}

function writeReport(reportPath, report) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function snapshotHashForResults(results) {
  const payload = results
    .map((result) => ({
      restaurantId: Number(result.restaurantId),
      inputFingerprint: String(result.inputFingerprint),
    }))
    .sort((left, right) => left.restaurantId - right.restaurantId);
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(usage());
    return null;
  }
  if (!fs.existsSync(options.dataDir)) throw new Error(`Data directory does not exist: ${options.dataDir}`);

  const sourceInfo = loadSavedSourceIndex(options.dataDir);
  sourceInfo.matchedRecords = 0;
  process.env.DATABASE_URL ||= "file:./dev.db";
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const allRows = await readRestaurantRows(prisma);
    const rows = options.limit === null ? allRows : allRows.slice(0, options.limit);
    sourceInfo.matchedRecordsWithUrls = 0;

    const results = rows.map((row) => {
      const input = inputForRow(row, sourceInfo.index);
      const sourceEvidence = sourceEvidenceFor(row, sourceInfo.index).evidence;
      if (sourceEvidence.length > 0) sourceInfo.matchedRecords += 1;
      if (sourceEvidence.some((entry) => entry.sourceUrls.length > 0)) sourceInfo.matchedRecordsWithUrls += 1;
      const sourceRefs = input.sourceRefs;
      const result = classifyRestaurant(input);
      return {
        ...result,
        aiInput: {
          name: input.name,
          note: input.note,
          address: input.address,
          phone: input.phone,
          currentFoodType: input.originalFoodType,
          currentTags: input.originalTags,
          knownSourceReferences: sourceRefs,
          savedSourceCuisineTypes: uniqueText(input.sourceCuisineTypes),
        },
        sourceRefs,
        savedSourceCuisineTypes: uniqueText(input.sourceCuisineTypes),
      };
    });

    const report = {
      mode: "dry-run",
      readOnly: true,
      taxonomyVersion: TAXONOMY_VERSION,
      source: {
        database: "Prisma Restaurant + RestaurantTag read query",
        savedSourceData: path.relative(ROOT, options.dataDir) || ".",
      },
      options: {
        sampleSize: options.sampleSize,
        limit: options.limit,
      },
      summary: buildSummary(results, sourceInfo, rows.length),
      snapshot: {
        capturedAt: new Date().toISOString(),
        restaurantCount: results.length,
        inputHash: snapshotHashForResults(results),
      },
      samples: selectSamples(results, options.sampleSize),
      results,
    };
    if (options.reportPath) writeReport(options.reportPath, report);

    const stdoutReport = {
      mode: report.mode,
      readOnly: report.readOnly,
      taxonomyVersion: report.taxonomyVersion,
      snapshot: report.snapshot,
      summary: report.summary,
      samples: report.samples,
      reportPath: options.reportPath,
      fullResults: options.reportPath ? `written:${results.length}` : "not-written; pass --report for every row",
    };
    process.stdout.write(`${JSON.stringify(stdoutReport, null, 2)}\n`);
    return report;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

module.exports = {
  buildSummary,
  inputForRow,
  loadSavedSourceIndex,
  main,
  parseArgs,
  selectSamples,
  snapshotHashForResults,
  sourceEvidenceFor,
  usage,
};
