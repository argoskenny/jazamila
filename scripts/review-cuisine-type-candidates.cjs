#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const {
  applyCandidateDecisions,
  buildCandidateReview,
} = require("../lib/domain/cuisine-candidate-review.cjs");

const ROOT = path.resolve(__dirname, "..");

function usage() {
  return `Usage: node scripts/review-cuisine-type-candidates.cjs [options]

Collect AI/Web proposed CuisineType values into a read-only review artifact.
This command never writes SQLite and never activates a candidate.

Options:
  --ai-results <path>       Phase 4 result JSONL
  --web-results <path>      Phase 5 result JSONL
  --ai-requests <path>      Phase 4 request JSONL for representative identity/source refs
  --web-requests <path>     Phase 5 request JSONL for representative identity/source refs
  --cuisine-types <path>    JSON array or { cuisineTypes: [...] } with active types
  --decision-file <path>    JSON array or { decisions: [...] } of approve/merge/reject decisions
  --output <path>           Write the complete review artifact
  --sample-size <number>    Number of candidates printed to stdout (default: 12)
  --help                    Show this help
`;
}

function parseArgs(argv) {
  const options = {
    aiResults: null,
    webResults: null,
    aiRequests: null,
    webRequests: null,
    cuisineTypes: null,
    decisionFile: null,
    output: null,
    sampleSize: 12,
    help: false,
  };
  const valueOptions = new Map([
    ["--ai-results", "aiResults"],
    ["--web-results", "webResults"],
    ["--ai-requests", "aiRequests"],
    ["--web-requests", "webRequests"],
    ["--cuisine-types", "cuisineTypes"],
    ["--decision-file", "decisionFile"],
    ["--output", "output"],
    ["--sample-size", "sampleSize"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") options.help = true;
    else {
      const [name, inlineValue] = argument.split("=", 2);
      const key = valueOptions.get(name);
      if (!key) throw new Error(`Unknown option: ${argument}`);
      const value = inlineValue ?? argv[++index];
      if (value === undefined) throw new Error(`Missing value for ${name}`);
      options[key] = value;
    }
  }
  for (const key of ["aiResults", "webResults", "aiRequests", "webRequests", "cuisineTypes", "decisionFile", "output"]) {
    if (options[key]) options[key] = path.resolve(ROOT, String(options[key]));
  }
  options.sampleSize = Number(options.sampleSize);
  if (!Number.isInteger(options.sampleSize) || options.sampleSize < 0 || options.sampleSize > 100) {
    throw new Error("--sample-size must be an integer between 0 and 100");
  }
  if (!options.aiResults && !options.webResults) throw new Error("at least one of --ai-results or --web-results is required");
  if (!options.cuisineTypes) throw new Error("--cuisine-types is required");
  return options;
}

function readJsonOrJsonl(filePath) {
  const text = fs.readFileSync(filePath, "utf8").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.results)) return parsed.results;
    if (Array.isArray(parsed.records)) return parsed.records;
    if (Array.isArray(parsed.requests)) return parsed.requests;
    return [parsed];
  } catch {
    return text.split(/\r?\n/u).filter((line) => line.trim()).map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`invalid JSONL at ${filePath}:${index + 1}: ${error instanceof Error ? error.message : error}`, { cause: error });
      }
    });
  }
}

function readCuisineTypes(filePath) {
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const types = Array.isArray(parsed) ? parsed : parsed?.cuisineTypes;
  if (!Array.isArray(types)) throw new Error("CuisineType file must contain an array or cuisineTypes array");
  return types;
}

function readDecisions(filePath) {
  if (!filePath) return [];
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const decisions = Array.isArray(parsed) ? parsed : parsed?.decisions;
  if (!Array.isArray(decisions)) throw new Error("decision file must contain a decisions array");
  return decisions;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(usage());
    return null;
  }
  const resultRecords = [
    ...(options.aiResults ? readJsonOrJsonl(options.aiResults) : []),
    ...(options.webResults ? readJsonOrJsonl(options.webResults) : []),
  ];
  const requestRecords = [
    ...(options.aiRequests ? readJsonOrJsonl(options.aiRequests) : []),
    ...(options.webRequests ? readJsonOrJsonl(options.webRequests) : []),
  ];
  const review = buildCandidateReview({
    resultRecords,
    requestRecords,
    cuisineTypes: readCuisineTypes(options.cuisineTypes),
  });
  const withDecisions = options.decisionFile
    ? applyCandidateDecisions(review, readDecisions(options.decisionFile), readCuisineTypes(options.cuisineTypes))
    : review;
  if (options.output) writeJson(options.output, withDecisions);
  const stdout = {
    reviewVersion: withDecisions.reviewVersion,
    mode: withDecisions.mode,
    readOnly: withDecisions.readOnly,
    writesDatabase: false,
    onlyApprovedOrMergedMayApply: true,
    summary: withDecisions.summary,
    candidates: withDecisions.candidates.slice(0, options.sampleSize),
    output: options.output,
  };
  process.stdout.write(`${JSON.stringify(stdout, null, 2)}\n`);
  return withDecisions;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

module.exports = { main, parseArgs, readJsonOrJsonl, usage };
