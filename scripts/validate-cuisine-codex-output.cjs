#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const Ajv = require("ajv");
const {
  validateClassificationResult,
  validateSchemaOnly: validateClassificationSchemaOnly,
} = require("../lib/ai/cuisine-classification-contract.cjs");
const {
  readJsonl,
  readManifest,
  requestKey,
  sha256File,
  validateRequestSet,
  writeJsonl,
} = require("../lib/ai/cuisine-codex-batch.cjs");
const {
  resultEnvelopeForProviderResult: resultEnvelopeForAi,
} = require("../lib/ai/cuisine-classification-pipeline.cjs");
const {
  resultEnvelopeForProviderResult: resultEnvelopeForWeb,
  parseCustomId: parseWebCustomId,
} = require("../lib/web-research/web-research-pipeline.cjs");
const { validateWebResearchResult } = require("../lib/web-research/web-research-contract.cjs");
const { publicEvidence } = require("../lib/web-research/web-research-sources.cjs");

const ROOT = path.resolve(__dirname, "..");

function usage() {
  return `Usage: node scripts/validate-cuisine-codex-output.cjs --stage <ai|web> --manifest <manifest.json>

This command validates Codex-produced JSONL and writes only the validated dry-run envelope.
It never calls Codex, the Web, an API, or SQLite.

Options:
  --stage <ai|web>       Output stage (required; must match manifest)
  --manifest <path>      Codex batch manifest (required)
  --help                 Show this help
`;
}

function parseArgs(argv) {
  const options = { stage: null, manifestPath: null, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument === "--stage" || argument.startsWith("--stage=")) {
      options.stage = argument.includes("=") ? argument.split("=", 2)[1] : argv[++index];
    } else if (argument === "--manifest" || argument.startsWith("--manifest=")) {
      options.manifestPath = argument.includes("=") ? argument.split("=", 2)[1] : argv[++index];
    } else throw new Error(`Unknown option: ${argument}`);
  }
  if (options.help) return options;
  if (options.stage !== "ai" && options.stage !== "web") throw new Error("--stage must be ai or web");
  if (!options.manifestPath) throw new Error("--manifest is required");
  options.manifestPath = path.resolve(ROOT, String(options.manifestPath));
  return options;
}

function cleanText(value) {
  return String(value ?? "").normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function errorText(value) {
  return cleanText(value).slice(0, 1000) || "Codex output failed validation";
}

function validationIssues(validation) {
  return validation?.error?.issues?.map((issue) => issue.message).join("; ") || "schema validation failed";
}

function rawKey(record) {
  return requestKey(record);
}

function indexRawResults(records, label) {
  const index = new Map();
  const duplicates = new Set();
  for (const record of records) {
    if (!record || typeof record !== "object") continue;
    const key = rawKey(record.result && typeof record.result === "object" ? record.result : record);
    if (!/^\d+:[a-f0-9]{64}$/u.test(key)) continue;
    if (index.has(key)) duplicates.add(key);
    else index.set(key, record);
  }
  return { index, duplicates, label };
}

function readAndValidateManifest(manifestPath) {
  const manifest = readManifest(manifestPath);
  if (path.resolve(manifest.manifestPath || manifestPath) !== path.resolve(manifestPath)) {
    throw new Error("manifestPath does not match the requested manifest file");
  }
  if (!manifest.batchId || !manifest.stage) throw new Error("manifest requires batchId and stage");
  const requests = readJsonl(manifest.requestPath);
  const requestMeta = validateRequestSet(manifest.stage, requests);
  if (sha256File(manifest.requestPath) !== manifest.requestSha256) throw new Error("request JSONL SHA-256 does not match manifest");
  if (Number(manifest.requestCount) !== requests.length) throw new Error("requestCount does not match request JSONL");
  if (manifest.snapshotHash !== requestMeta.snapshotHash) throw new Error("snapshotHash does not match request JSONL");
  if (manifest.promptVersion !== requestMeta.promptVersion) throw new Error("promptVersion does not match request JSONL");
  if (manifest.modelVersion !== requestMeta.modelVersion) throw new Error("modelVersion does not match request JSONL");
  if (manifest.schemaPath && manifest.schemaSha256 && sha256File(manifest.schemaPath) !== manifest.schemaSha256) {
    throw new Error("result schema SHA-256 does not match manifest");
  }
  if (!fs.existsSync(manifest.rawResultPath)) throw new Error(`raw result JSONL does not exist: ${manifest.rawResultPath}`);
  if (manifest.stage === "web" && !fs.existsSync(manifest.evidencePath)) throw new Error(`evidence JSONL does not exist: ${manifest.evidencePath}`);
  return { manifest, requests, requestMeta };
}

function aiEnvelopeForRequest(request, raw, duplicate = false) {
  if (!raw) {
    return resultEnvelopeForAi(request, {
      status: "invalid",
      customId: request.customId,
      attempts: 1,
      errorCode: "MISSING_CODEX_RESULT",
      errorMessage: "Codex did not return exactly one result for this request",
    });
  }
  if (duplicate) {
    return resultEnvelopeForAi(request, {
      status: "invalid",
      customId: request.customId,
      attempts: 1,
      errorCode: "DUPLICATE_CODEX_RESULT",
      errorMessage: "Codex returned more than one result for this request",
    });
  }
  const schemaOnly = validateClassificationSchemaOnly(raw);
  if (!schemaOnly.success) {
    return resultEnvelopeForAi(request, {
      status: "invalid",
      customId: request.customId,
      attempts: 1,
      errorCode: "CODEX_SCHEMA_INVALID",
      errorMessage: errorText(validationIssues(schemaOnly)),
    });
  }
  const validation = validateClassificationResult(raw, {
    restaurantId: request.restaurantId,
    inputFingerprint: request.inputFingerprint,
    suppliedCuisineTypes: request.suppliedCuisineTypes,
    currentTags: request.input.currentTags,
  });
  if (!validation.success) {
    return resultEnvelopeForAi(request, {
      status: "invalid",
      customId: request.customId,
      attempts: 1,
      errorCode: "CODEX_CONTRACT_INVALID",
      errorMessage: errorText(validationIssues(validation)),
    });
  }
  return resultEnvelopeForAi(request, {
    status: "ok",
    customId: request.customId,
    attempts: 1,
    result: validation.data,
  });
}

function evidenceSchemaValidator(schemaPath) {
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const validator = new Ajv({ allErrors: true, format: "full" }).compile(schema);
  return (value) => {
    if (validator(value)) return { success: true, data: value };
    return {
      success: false,
      error: {
        issues: (validator.errors ?? []).map((issue) => ({ message: `${issue.dataPath || "evidence"} ${issue.message || "invalid"}` })),
      },
    };
  };
}

function webEnvelopeForRequest(request, raw, evidenceRecord, duplicate = false) {
  const audit = evidenceRecord
    ? {
      ...(evidenceRecord.audit ?? {}),
      fetchedSources: evidenceRecord.fetchedSources.map(publicEvidence),
    }
    : null;
  if (!raw) {
    return resultEnvelopeForWeb(request, {
      status: "invalid",
      customId: request.customId,
      attempts: 1,
      errorCode: "MISSING_CODEX_RESULT",
      errorMessage: "Codex did not return exactly one Web result for this request",
      fetchedSources: evidenceRecord?.fetchedSources ?? [],
      audit,
    });
  }
  if (duplicate) {
    return resultEnvelopeForWeb(request, {
      status: "invalid",
      customId: request.customId,
      attempts: 1,
      errorCode: "DUPLICATE_CODEX_RESULT",
      errorMessage: "Codex returned more than one Web result for this request",
      fetchedSources: evidenceRecord?.fetchedSources ?? [],
      audit,
    });
  }
  const result = validateWebResearchResult(raw, {
    restaurantId: request.restaurantId,
    inputFingerprint: request.inputFingerprint,
    input: request.input,
    currentTags: request.currentTags,
    searchQueries: request.searchQueries,
    suppliedCuisineTypes: request.candidateCuisineTypes,
    fetchedSources: evidenceRecord?.fetchedSources ?? [],
  });
  if (!result.success) {
    return resultEnvelopeForWeb(request, {
      status: "invalid",
      customId: request.customId,
      attempts: 1,
      errorCode: "CODEX_CONTRACT_INVALID",
      errorMessage: errorText(validationIssues(result)),
      fetchedSources: evidenceRecord?.fetchedSources ?? [],
      audit,
    });
  }
  return resultEnvelopeForWeb(request, {
    status: "ok",
    customId: request.customId,
    attempts: 1,
    result: result.data,
    fetchedSources: evidenceRecord?.fetchedSources ?? [],
    audit,
  });
}

function validateEvidenceRecords(manifest, requests) {
  const evidenceRecords = readJsonl(manifest.evidencePath);
  const validator = evidenceSchemaValidator(manifest.evidenceSchemaPath);
  const index = new Map();
  const duplicates = new Set();
  const invalid = new Map();
  for (const record of evidenceRecords) {
    const validation = validator(record);
    if (!validation.success) {
      const key = record && typeof record === "object" ? requestKey(record) : "invalid";
      invalid.set(key, errorText(validationIssues(validation)));
      continue;
    }
    const parsedCustomId = parseWebCustomId(record.customId);
    if (!parsedCustomId
      || parsedCustomId.restaurantId !== Number(record.restaurantId)
      || parsedCustomId.inputFingerprint !== record.inputFingerprint) {
      invalid.set(requestKey(record), "evidence customId does not map to restaurantId and inputFingerprint");
      continue;
    }
    const key = requestKey(record);
    if (index.has(key)) duplicates.add(key);
    else index.set(key, record);
  }
  for (const request of requests) {
    const key = requestKey(request);
    const record = index.get(key);
    if (!record && !invalid.has(key)) invalid.set(key, "missing Web evidence sidecar");
    if (record && JSON.stringify(record.audit.searchQueries) !== JSON.stringify(request.searchQueries)) {
      invalid.set(key, "evidence audit searchQueries do not match the request");
    }
  }
  return { index, duplicates, invalid, count: evidenceRecords.length };
}

function countStatuses(records) {
  return records.reduce((counts, record) => {
    const status = String(record?.status || "unknown");
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(usage());
    return null;
  }
  const loaded = readAndValidateManifest(options.manifestPath);
  const { manifest, requests } = loaded;
  if (manifest.stage !== options.stage) throw new Error(`manifest stage ${manifest.stage} does not match --stage ${options.stage}`);
  const rawRecords = readJsonl(manifest.rawResultPath);
  const raw = indexRawResults(rawRecords, "raw");
  const evidence = manifest.stage === "web" ? validateEvidenceRecords(manifest, requests) : null;
  const envelopes = requests.map((request) => {
    const key = requestKey(request);
    const rawRecord = raw.index.get(key);
    if (manifest.stage === "ai") return aiEnvelopeForRequest(request, rawRecord, raw.duplicates.has(key));
    const evidenceRecord = evidence.index.get(key);
    const evidenceInvalid = evidence.invalid.has(key);
    return webEnvelopeForRequest(
      request,
      rawRecord,
      evidenceInvalid ? null : evidenceRecord,
      raw.duplicates.has(key) || evidence.duplicates.has(key) || evidenceInvalid,
    );
  });
  const outputPath = writeJsonl(manifest.validatedResultPath, envelopes);
  const summary = {
    mode: "codex-output-validated",
    readOnly: true,
    callsCodex: false,
    callsApi: false,
    writesDatabase: false,
    stage: manifest.stage,
    batchId: manifest.batchId,
    requestCount: requests.length,
    rawRecords: rawRecords.length,
    evidenceRecords: evidence?.count ?? null,
    validResults: envelopes.filter((record) => record.status === "ok").length,
    invalidResults: envelopes.filter((record) => record.status === "invalid").length,
    statuses: countStatuses(envelopes),
    outputPath,
    validatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(manifest.validationSummaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

module.exports = {
  aiEnvelopeForRequest,
  countStatuses,
  main,
  parseArgs,
  readAndValidateManifest,
  usage,
  validateEvidenceRecords,
  webEnvelopeForRequest,
};
